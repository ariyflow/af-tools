import { stat, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import type { ErrorCode, JobPhase, JobSnapshot } from '../../shared/api'
import type { Artifact, JobContext } from '../../shared/tool'
import { AppError } from '../lib/errors'
import { InMemoryJobStore, type JobRecord } from './job-store'
import { JobQueue } from './job-queue'
import { TempStorage } from './storage'

export interface JobDefinition {
  jobId: string
  toolId: string
  inputPath: string
  workDir: string
  execute: (context: JobContext) => Promise<Artifact>
}

interface JobManagerOptions {
  queue: JobQueue
  storage: TempStorage
  logger: FastifyBaseLogger
  ttlMs: number
  maxQueuedJobs: number
}

type SnapshotListener = (snapshot: JobSnapshot) => void

const EXPIRED_RETENTION_MS = 5 * 60 * 1000

export class JobManager {
  private readonly store = new InMemoryJobStore()
  private readonly listeners = new Map<string, Set<SnapshotListener>>()
  private readonly queue: JobQueue
  private readonly storage: TempStorage
  private readonly logger: FastifyBaseLogger
  private readonly ttlMs: number
  private readonly maxQueuedJobs: number

  constructor(options: JobManagerOptions) {
    this.queue = options.queue
    this.storage = options.storage
    this.logger = options.logger
    this.ttlMs = options.ttlMs
    this.maxQueuedJobs = options.maxQueuedJobs
  }

  get load(): number {
    return this.queue.running + this.queue.pending
  }

  get isSaturated(): boolean {
    return this.load >= this.maxQueuedJobs
  }

  create(definition: JobDefinition): JobSnapshot {
    const now = new Date()
    const record: JobRecord = {
      snapshot: {
        id: definition.jobId,
        toolId: definition.toolId,
        status: 'queued',
        progress: 0,
        phase: 'queued',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      },
      inputPath: definition.inputPath,
      workDir: definition.workDir,
      controller: new AbortController(),
    }

    this.store.set(record)
    this.emit(record)

    void this.queue
      .run(() => this.process(record, definition))
      .catch((error: unknown) => {
        this.logger.error({ err: error, jobId: definition.jobId }, 'job crashed')
      })

    return this.clone(record.snapshot)
  }

  get(id: string): JobSnapshot | undefined {
    const record = this.store.get(id)
    return record ? this.clone(record.snapshot) : undefined
  }

  require(id: string): JobSnapshot {
    const snapshot = this.get(id)
    if (!snapshot) {
      throw new AppError('NOT_FOUND', 'Job not found or already expired')
    }
    return snapshot
  }

  getArtifactPath(id: string): string | undefined {
    return this.store.get(id)?.artifactPath
  }

  subscribe(id: string, listener: SnapshotListener): () => void {
    let listeners = this.listeners.get(id)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(id, listeners)
    }
    listeners.add(listener)

    return () => {
      const current = this.listeners.get(id)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) this.listeners.delete(id)
    }
  }

  async cancel(id: string): Promise<JobSnapshot> {
    const record = this.store.get(id)
    if (!record) {
      throw new AppError('NOT_FOUND', 'Job not found or already expired')
    }

    if (isTerminal(record.snapshot.status)) {
      return this.clone(record.snapshot)
    }

    record.controller.abort()
    this.clearTimers(record)
    this.patch(record, {
      status: 'cancelled',
      errorCode: 'CANCELLED',
      errorMessage: 'The job was cancelled',
      result: undefined,
    })

    await rm(record.inputPath, { force: true }).catch(() => undefined)
    await this.storage.removeWorkDir(id).catch(() => undefined)
    this.scheduleRemoval(record)
    return this.clone(record.snapshot)
  }

  private async process(record: JobRecord, definition: JobDefinition): Promise<void> {
    if (record.snapshot.status === 'cancelled') {
      await this.cleanup(record)
      return
    }

    this.patch(record, {
      status: 'processing',
      phase: 'probe',
      progress: 1,
    })

    const context: JobContext = {
      jobId: record.snapshot.id,
      workDir: record.workDir,
      signal: record.controller.signal,
      report: (progress: number, phase: JobPhase) => {
        if (record.snapshot.status !== 'processing') return
        this.patch(record, {
          progress: Math.max(0, Math.min(99, Math.round(progress))),
          phase,
        })
      },
      log: {
        info: (message) => this.logger.info({ jobId: record.snapshot.id }, message),
        warn: (message) => this.logger.warn({ jobId: record.snapshot.id }, message),
        error: (message) => this.logger.error({ jobId: record.snapshot.id }, message),
      },
    }

    try {
      const artifact = await definition.execute(context)
      const artifactStat = await stat(artifact.path)

      record.artifactPath = artifact.path
      this.patch(record, {
        status: 'completed',
        progress: 100,
        phase: 'done',
        result: {
          filename: artifact.filename,
          size: artifactStat.size,
          mime: artifact.mime,
        },
        errorCode: undefined,
        errorMessage: undefined,
      })

      await rm(record.inputPath, { force: true }).catch(() => undefined)
      this.scheduleExpiry(record)
      this.logger.info({ jobId: record.snapshot.id }, 'job completed')
    } catch (error) {
      if (isCancelledStatus(record.snapshot.status) || record.controller.signal.aborted) {
        await this.cleanup(record)
        return
      }

      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              'PROCESS_FAILED',
              'The conversion failed. Please try another file.',
            )

      this.patch(record, {
        status: 'failed',
        errorCode: appError.code,
        errorMessage: appError.message,
      })
      this.logger.error({ jobId: record.snapshot.id, err: error }, 'job failed')
      await this.cleanup(record)
      this.scheduleRemoval(record)
    }
  }

  private async cleanup(record: JobRecord): Promise<void> {
    await rm(record.inputPath, { force: true }).catch(() => undefined)
    if (record.snapshot.status !== 'completed') {
      await this.storage.removeWorkDir(record.snapshot.id).catch(() => undefined)
    }
  }

  private scheduleExpiry(record: JobRecord): void {
    this.clearTimers(record)
    const expiresAt = Date.now() + this.ttlMs
    record.snapshot.expiresAt = new Date(expiresAt).toISOString()
    record.expiryTimer = setTimeout(() => {
      if (record.snapshot.status !== 'completed') return
      record.artifactPath = undefined
      this.patch(record, {
        status: 'expired',
        progress: 100,
        result: undefined,
        errorCode: 'EXPIRED',
        errorMessage: 'The result has expired',
      })
      void this.storage.removeWorkDir(record.snapshot.id).catch(() => undefined)
      record.removalTimer = setTimeout(() => {
        this.listeners.delete(record.snapshot.id)
        this.store.delete(record.snapshot.id)
      }, EXPIRED_RETENTION_MS)
      record.removalTimer.unref()
    }, this.ttlMs)
    record.expiryTimer.unref()
  }

  private scheduleRemoval(record: JobRecord): void {
    this.clearTimers(record)
    record.removalTimer = setTimeout(() => {
      this.listeners.delete(record.snapshot.id)
      this.store.delete(record.snapshot.id)
    }, this.ttlMs)
    record.removalTimer.unref()
  }

  private clearTimers(record: JobRecord): void {
    if (record.expiryTimer) clearTimeout(record.expiryTimer)
    if (record.removalTimer) clearTimeout(record.removalTimer)
    record.expiryTimer = undefined
    record.removalTimer = undefined
  }

  private patch(record: JobRecord, patch: Partial<JobSnapshot>): void {
    record.snapshot = {
      ...record.snapshot,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    this.store.set(record)
    this.emit(record)
  }

  private emit(record: JobRecord): void {
    const listeners = this.listeners.get(record.snapshot.id)
    if (!listeners) return
    const snapshot = this.clone(record.snapshot)
    for (const listener of listeners) {
      try {
        listener(snapshot)
      } catch (error) {
        this.logger.warn({ err: error, jobId: record.snapshot.id }, 'job listener failed')
      }
    }
  }

  private clone(snapshot: JobSnapshot): JobSnapshot {
    return {
      ...snapshot,
      result: snapshot.result ? { ...snapshot.result } : undefined,
    }
  }
}

function isCancelledStatus(status: string): boolean {
  return status === 'cancelled'
}

function isTerminal(status: JobSnapshot['status']): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'expired'
  )
}

export function newJobId(): string {
  return randomUUID()
}

export function errorCodeOf(error: unknown): ErrorCode {
  return error instanceof AppError ? error.code : 'INTERNAL_ERROR'
}
