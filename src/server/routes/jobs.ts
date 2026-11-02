import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import type { JobSnapshot } from '../../shared/api'
import { AppError } from '../lib/errors'
import type { JobManager } from '../core/job-manager'

interface JobRouteDeps {
  manager: JobManager
}

export function registerJobRoutes(app: FastifyInstance, deps: JobRouteDeps): void {
  app.get<{ Params: { jobId: string } }>('/api/jobs/:jobId', async (request) =>
    deps.manager.require(request.params.jobId),
  )

  app.get<{ Params: { jobId: string } }>(
    '/api/jobs/:jobId/events',
    async (request, reply) => {
      const initial = deps.manager.require(request.params.jobId)
      const { jobId } = request.params

      reply.hijack()
      const response = reply.raw
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      response.flushHeaders()

      let closed = false
      const connection: {
        unsubscribe?: () => void
        heartbeat?: NodeJS.Timeout
      } = {}

      const cleanup = () => {
        if (closed) return
        closed = true
        connection.unsubscribe?.()
        if (connection.heartbeat) clearInterval(connection.heartbeat)
      }

      const send = (snapshot: JobSnapshot) => {
        if (closed) return
        response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
        if (isTerminal(snapshot.status)) {
          cleanup()
          response.end()
        }
      }

      connection.unsubscribe = deps.manager.subscribe(jobId, send)
      connection.heartbeat = setInterval(() => {
        if (!closed) response.write(': ping\n\n')
      }, 15_000)
      connection.heartbeat.unref()
      request.raw.on('close', cleanup)

      send(initial)
    },
  )

  app.get<{ Params: { jobId: string } }>(
    '/api/jobs/:jobId/result',
    async (request, reply) => {
      const snapshot = deps.manager.require(request.params.jobId)

      if (snapshot.status === 'expired') {
        throw new AppError('EXPIRED', 'The result has expired', 410)
      }

      if (snapshot.status !== 'completed' || !snapshot.result) {
        throw new AppError('NOT_FOUND', 'The result is not ready', 409)
      }

      const artifactPath = deps.manager.getArtifactPath(request.params.jobId)
      if (!artifactPath) {
        throw new AppError('EXPIRED', 'The result has expired', 410)
      }

      const fileStat = await stat(artifactPath).catch(() => undefined)
      if (!fileStat) {
        throw new AppError('EXPIRED', 'The result has expired', 410)
      }

      reply
        .header('Content-Type', snapshot.result.mime)
        .header('Content-Length', fileStat.size)
        .header('Cache-Control', 'private, no-store')
        .header(
          'Content-Disposition',
          `attachment; filename="${snapshot.result.filename}"`,
        )
        .header('X-Content-Type-Options', 'nosniff')

      return reply.send(createReadStream(artifactPath))
    },
  )

  app.delete<{ Params: { jobId: string } }>('/api/jobs/:jobId', async (request) =>
    deps.manager.cancel(request.params.jobId),
  )
}

function isTerminal(status: JobSnapshot['status']): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'expired'
  )
}
