import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { AppError } from '../lib/errors'
import { listToolCapabilities, getToolHandler } from '../tools/registry'
import { newJobId, type JobManager } from '../core/job-manager'
import type { TempStorage } from '../core/storage'

interface ToolRouteDeps {
  manager: JobManager
  storage: TempStorage
}

export function registerToolRoutes(app: FastifyInstance, deps: ToolRouteDeps): void {
  app.get('/api/tools', async () => listToolCapabilities())

  app.post<{ Params: { toolId: string } }>(
    '/api/tools/:toolId/jobs',
    async (request, reply) => {
      const handler = getToolHandler(request.params.toolId)
      if (!handler) {
        throw new AppError('NOT_FOUND', 'Unknown tool')
      }

      if (deps.manager.isSaturated) {
        throw new AppError(
          'QUEUE_FULL',
          'The conversion queue is full. Please try again shortly.',
        )
      }

      const jobId = newJobId()
      const workDir = await deps.storage.createWorkDir(jobId)
      const inputPath = path.join(workDir, 'input')
      let enqueued = false

      try {
        let optionsRaw = '{}'
        let receivedFile = false

        const parts = request.parts()

        for await (const part of parts) {
          if (part.type === 'file') {
            if (part.fieldname !== 'file' || receivedFile) {
              part.file.resume()
              throw new AppError(
                'INVALID_FILE',
                'Exactly one file must be uploaded in the "file" field',
              )
            }

            await pipeline(part.file, createWriteStream(inputPath))

            if (part.file.truncated) {
              throw new AppError(
                'FILE_TOO_LARGE',
                `The file exceeds the ${Math.round(handler.maxUploadBytes / 1024 / 1024)} MB limit`,
              )
            }

            receivedFile = true
            continue
          }

          if (part.fieldname === 'options') {
            optionsRaw = String(part.value ?? '{}')
          }
        }

        if (!receivedFile) {
          throw new AppError('INVALID_FILE', 'No video file was uploaded')
        }

        const fileStat = await stat(inputPath)
        if (fileStat.size === 0) {
          throw new AppError('INVALID_FILE', 'The uploaded file is empty')
        }
        if (fileStat.size > handler.maxUploadBytes) {
          throw new AppError(
            'FILE_TOO_LARGE',
            `The file exceeds the ${Math.round(handler.maxUploadBytes / 1024 / 1024)} MB limit`,
          )
        }

        let rawOptions: unknown
        try {
          rawOptions = JSON.parse(optionsRaw)
        } catch {
          throw new AppError('INVALID_OPTIONS', 'Invalid conversion options')
        }

        let options: unknown
        try {
          options = handler.parseOptions(rawOptions)
        } catch {
          throw new AppError('INVALID_OPTIONS', 'Invalid conversion options')
        }

        if (handler.preflight) {
          await handler.preflight(inputPath, options)
        }

        const snapshot = deps.manager.create({
          jobId,
          toolId: handler.id,
          inputPath,
          workDir,
          execute: (context) => handler.run(context, inputPath, options),
        })

        enqueued = true
        return reply.code(201).send({ jobId: snapshot.id })
      } finally {
        if (!enqueued) {
          await deps.storage.removeWorkDir(jobId).catch(() => undefined)
        }
      }
    },
  )
}
