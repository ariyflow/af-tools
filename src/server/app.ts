import { existsSync } from 'node:fs'
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { config } from './config'
import { AppError } from './lib/errors'
import { JobManager } from './core/job-manager'
import { JobQueue } from './core/job-queue'
import { TempStorage } from './core/storage'
import { registerHealthRoutes } from './routes/health'
import { registerToolRoutes } from './routes/tools'
import { registerJobRoutes } from './routes/jobs'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: process.env.TRUST_PROXY === 'true',
    bodyLimit: 1024 * 1024,
  })

  await app.register(helmet, {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })

  await app.register(multipart, {
    limits: {
      fileSize: config.maxUploadBytes,
      files: 1,
      fields: 5,
      parts: 10,
      fieldSize: 1024 * 1024,
    },
  })

  const storage = new TempStorage(config.tempDir)
  await storage.init()

  const manager = new JobManager({
    queue: new JobQueue(config.concurrency),
    storage,
    logger: app.log,
    ttlMs: config.jobTtlMs,
    maxQueuedJobs: config.maxQueuedJobs,
  })

  registerHealthRoutes(app)
  registerToolRoutes(app, { manager, storage })
  registerJobRoutes(app, { manager })

  const webEnabled = existsSync(config.webDist)
  if (webEnabled) {
    await app.register(fastifyStatic, {
      root: config.webDist,
      prefix: '/',
      index: ['index.html'],
    })
  }

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      })
    }
    if (webEnabled) {
      return reply.sendFile('index.html')
    }
    return reply.code(404).send({ error: 'Not found' })
  })

  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const appError = toAppError(error)

      if (appError.statusCode >= 500) {
        request.log.error({ err: error }, 'request failed')
      } else {
        request.log.warn({ code: appError.code, url: request.url }, appError.message)
      }

      return reply.code(appError.statusCode).send({
        error: {
          code: appError.code,
          message:
            appError.statusCode >= 500
              ? 'An unexpected server error occurred'
              : appError.message,
        },
      })
    },
  )

  return app
}

function toAppError(error: FastifyError): AppError {
  if (error instanceof AppError) return error

  const code = (error as FastifyError & { code?: string }).code

  if (code === 'FST_REQ_FILE_TOO_LARGE' || error.statusCode === 413) {
    return new AppError('FILE_TOO_LARGE', 'The uploaded file is too large', 413)
  }

  if (
    code === 'FST_FILES_LIMIT' ||
    code === 'FST_FIELDS_LIMIT' ||
    code === 'FST_PARTS_LIMIT' ||
    code === 'FST_INVALID_MULTIPART_CONTENT_TYPE'
  ) {
    return new AppError('INVALID_FILE', 'The upload was rejected', 400)
  }

  if (error.statusCode === 429) {
    return new AppError('RATE_LIMITED', 'Too many requests. Please slow down.', 429)
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return new AppError('INVALID_OPTIONS', error.message, error.statusCode)
  }

  return new AppError('INTERNAL_ERROR', error.message, 500)
}
