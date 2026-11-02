import { describe, expect, it } from 'vitest'
import { JobQueue } from '../../src/server/core/job-queue'

describe('JobQueue', () => {
  it('never exceeds the configured concurrency', async () => {
    const queue = new JobQueue(2)
    let running = 0
    let peak = 0

    const task = () =>
      queue.run(async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 10))
        running -= 1
      })

    await Promise.all([task(), task(), task(), task(), task()])

    expect(peak).toBe(2)
    expect(queue.running).toBe(0)
    expect(queue.pending).toBe(0)
  })

  it('propagates task errors and keeps processing the queue', async () => {
    const queue = new JobQueue(1)

    await expect(
      queue.run(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    await expect(queue.run(async () => 'ok')).resolves.toBe('ok')
  })
})
