import { computed, onBeforeUnmount, ref } from 'vue'
import type {
  ApiErrorBody,
  CreateJobResponse,
  ErrorCode,
  JobSnapshot,
} from '@/shared/api'

class UploadError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

export function useJob(toolId: string) {
  const job = ref<JobSnapshot | null>(null)
  const jobId = ref<string | null>(null)
  const uploadPercent = ref(0)
  const isUploading = ref(false)
  const errorCode = ref<ErrorCode | null>(null)
  const errorMessage = ref('')

  let source: EventSource | null = null
  let pollTimer: number | undefined
  let activeXhr: XMLHttpRequest | null = null

  const isActive = computed(
    () => job.value?.status === 'queued' || job.value?.status === 'processing',
  )
  const isBusy = computed(() => isUploading.value || isActive.value)
  const error = computed(() =>
    errorCode.value ? { code: errorCode.value, message: errorMessage.value } : null,
  )
  const resultUrl = computed(() =>
    jobId.value && job.value?.status === 'completed'
      ? `/api/jobs/${jobId.value}/result`
      : '',
  )

  function setError(code: ErrorCode, message = ''): void {
    errorCode.value = code
    errorMessage.value = message
  }

  function clearError(): void {
    errorCode.value = null
    errorMessage.value = ''
  }

  function stopWatching(): void {
    source?.close()
    source = null
    if (pollTimer !== undefined) {
      window.clearTimeout(pollTimer)
      pollTimer = undefined
    }
  }

  function applySnapshot(snapshot: JobSnapshot): void {
    job.value = snapshot
    jobId.value = snapshot.id
    if (isTerminal(snapshot.status)) {
      stopWatching()
    }
  }

  function connect(id: string): void {
    stopWatching()

    if (typeof EventSource === 'undefined') {
      startPolling(id)
      return
    }

    const stream = new EventSource(`/api/jobs/${id}/events`)
    source = stream

    stream.addEventListener('snapshot', (event) => {
      try {
        applySnapshot(JSON.parse((event as MessageEvent<string>).data))
      } catch {
        // Ignore malformed events and let the polling fallback recover.
      }
    })

    stream.onerror = () => {
      if (source !== stream) return
      stream.close()
      source = null
      if (!job.value || isActiveStatus(job.value.status)) {
        startPolling(id)
      }
    }
  }

  function startPolling(id: string): void {
    if (pollTimer !== undefined) window.clearTimeout(pollTimer)

    const tick = async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`)
        if (response.status === 404) {
          setError('EXPIRED', 'The job no longer exists')
          return
        }
        if (!response.ok) {
          setError('INTERNAL_ERROR', 'Could not fetch job status')
          return
        }
        const snapshot = (await response.json()) as JobSnapshot
        applySnapshot(snapshot)
        if (isActiveStatus(snapshot.status)) {
          pollTimer = window.setTimeout(tick, 1000)
        }
      } catch {
        setError('NETWORK', 'Could not reach the server')
      }
    }

    pollTimer = window.setTimeout(tick, 800)
  }

  function upload(form: FormData): Promise<CreateJobResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      activeXhr = xhr
      xhr.open('POST', `/api/tools/${toolId}/jobs`)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        uploadPercent.value = Math.round((event.loaded / event.total) * 100)
      }

      xhr.onload = () => {
        activeXhr = null
        const body = parseJson(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && body) {
          const result = body as CreateJobResponse
          if (typeof result.jobId === 'string') {
            resolve(result)
            return
          }
        }
        const apiError = body as ApiErrorBody | null
        reject(
          new UploadError(
            apiError?.error?.code ?? 'INTERNAL_ERROR',
            apiError?.error?.message ?? `Upload failed (${xhr.status})`,
          ),
        )
      }

      xhr.onerror = () => {
        activeXhr = null
        reject(new UploadError('NETWORK', 'Could not reach the server'))
      }

      xhr.onabort = () => {
        activeXhr = null
        reject(new UploadError('CANCELLED', 'Upload cancelled'))
      }

      xhr.send(form)
    })
  }

  async function start(file: File, options: unknown): Promise<boolean> {
    if (isUploading.value) return false

    if (isActive.value) {
      await cancel()
    }

    stopWatching()
    job.value = null
    jobId.value = null
    uploadPercent.value = 0
    isUploading.value = true
    clearError()

    const form = new FormData()
    form.append('options', JSON.stringify(options))
    form.append('file', file)

    try {
      const result = await upload(form)
      uploadPercent.value = 100
      jobId.value = result.jobId
      connect(result.jobId)
      return true
    } catch (caught) {
      if (caught instanceof UploadError) {
        if (caught.code !== 'CANCELLED') {
          setError(caught.code, caught.message)
        }
      } else {
        setError('INTERNAL_ERROR', 'Upload failed')
      }
      return false
    } finally {
      isUploading.value = false
    }
  }

  async function cancel(): Promise<void> {
    if (isUploading.value) {
      activeXhr?.abort()
      return
    }

    const id = jobId.value
    if (!id || !isActive.value) return

    try {
      const response = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
      if (response.ok) {
        applySnapshot((await response.json()) as JobSnapshot)
      }
    } catch {
      setError('NETWORK', 'Could not cancel the job')
    }
    stopWatching()
  }

  async function reset(): Promise<void> {
    const id = jobId.value
    const shouldCancel = isActive.value || isUploading.value

    stopWatching()
    if (isUploading.value) {
      activeXhr?.abort()
    }

    if (shouldCancel && id) {
      try {
        await fetch(`/api/jobs/${id}`, { method: 'DELETE', keepalive: true })
      } catch {
        // Best-effort cleanup.
      }
    }

    job.value = null
    jobId.value = null
    uploadPercent.value = 0
    isUploading.value = false
    clearError()
  }

  onBeforeUnmount(() => {
    stopWatching()
    const id = jobId.value
    if (id && (isActive.value || isUploading.value)) {
      fetch(`/api/jobs/${id}`, { method: 'DELETE', keepalive: true }).catch(
        () => undefined,
      )
    }
  })

  return {
    job,
    jobId,
    uploadPercent,
    isUploading,
    isActive,
    isBusy,
    error,
    resultUrl,
    start,
    cancel,
    reset,
    clearError,
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isActiveStatus(status: JobSnapshot['status']): boolean {
  return status === 'queued' || status === 'processing'
}

function isTerminal(status: JobSnapshot['status']): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'expired'
  )
}
