import { buildApp } from './app'
import { config } from './config'

const app = await buildApp()

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app.close().finally(() => process.exit(0))
  })
}
