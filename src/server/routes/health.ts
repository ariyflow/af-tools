import type { FastifyInstance } from 'fastify'

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () => ({
    status: 'ok',
    uptime: Math.round(process.uptime()),
  }))
}
