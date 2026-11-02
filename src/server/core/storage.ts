import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'

export class TempStorage {
  constructor(private readonly root: string) {}

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    const entries = await readdir(this.root).catch(() => [])
    await Promise.all(
      entries.map((entry) =>
        rm(path.join(this.root, entry), { recursive: true, force: true }),
      ),
    )
  }

  async createWorkDir(jobId: string): Promise<string> {
    const dir = path.join(this.root, jobId)
    await mkdir(dir, { recursive: true })
    return dir
  }

  async removeWorkDir(jobId: string): Promise<void> {
    await rm(path.join(this.root, jobId), { recursive: true, force: true })
  }
}
