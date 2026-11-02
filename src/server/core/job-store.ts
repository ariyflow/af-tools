import type { JobSnapshot } from '../../shared/api'

export interface JobRecord {
  snapshot: JobSnapshot
  inputPath: string
  workDir: string
  artifactPath?: string
  controller: AbortController
  expiryTimer?: NodeJS.Timeout
  removalTimer?: NodeJS.Timeout
}

export class InMemoryJobStore {
  private readonly jobs = new Map<string, JobRecord>()

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id)
  }

  set(record: JobRecord): void {
    this.jobs.set(record.snapshot.id, record)
  }

  delete(id: string): void {
    this.jobs.delete(id)
  }

  values(): JobRecord[] {
    return [...this.jobs.values()]
  }
}
