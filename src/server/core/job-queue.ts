export class JobQueue {
  private active = 0
  private readonly waiting: Array<() => void> = []

  constructor(private readonly concurrency: number) {}

  get pending(): number {
    return this.waiting.length
  }

  get running(): number {
    return this.active
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.active += 1
        resolve()
      })
    })
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.waiting.shift()
    next?.()
  }
}
