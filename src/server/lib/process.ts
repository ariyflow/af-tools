import { spawn } from 'node:child_process'
import { AbortError, AppError } from './errors'

const STDERR_LIMIT = 24 * 1024

export interface RunProcessOptions {
  signal?: AbortSignal
  timeoutMs?: number
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
  onSpawn?: (pid: number | undefined) => void
}

export interface ProcessResult {
  stdout: string
  stderr: string
}

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new AbortError())
      return
    }

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let timeout: NodeJS.Timeout | undefined

    const cleanup = () => {
      if (timeout) clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
    }

    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      action()
    }

    const onAbort = () => {
      child.kill('SIGKILL')
      finish(() => reject(new AbortError()))
    }

    options.signal?.addEventListener('abort', onAbort, { once: true })
    options.onSpawn?.(child.pid)

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        child.kill('SIGKILL')
        finish(() =>
          reject(new AppError('PROCESS_FAILED', 'The media process timed out')),
        )
      }, options.timeoutMs)
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      options.onStdout?.(chunk)
    })

    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-STDERR_LIMIT)
      options.onStderr?.(chunk)
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(() => {
        if (error.code === 'ENOENT') {
          reject(
            new AppError(
              'PROCESS_FAILED',
              `Media binary not found: ${command}. Install FFmpeg or set FFMPEG_PATH.`,
            ),
          )
          return
        }
        reject(error)
      })
    })

    child.on('close', (code) => {
      finish(() => {
        if (code === 0) {
          resolve({ stdout, stderr })
          return
        }
        reject(
          new AppError(
            'PROCESS_FAILED',
            stderr.trim().split('\n').slice(-3).join(' ') ||
              `${command} exited with code ${code ?? 'unknown'}`,
          ),
        )
      })
    })
  })
}
