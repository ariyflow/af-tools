<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  Ban,
  Check,
  Clock3,
  Download,
  FileVideo2,
  Film,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  X,
} from '@lucide/vue'
import {
  MP4_TO_GIF_TOOL_ID,
  mp4ToGifDefaults,
  mp4ToGifWidthPresets,
  type Mp4ToGifOptions,
} from '@/shared/tools/mp4-to-gif'
import { useJob } from '@/web/composables/useJob'
import { useCapabilities } from '@/web/composables/useCapabilities'
import { formatBytes, formatDuration, formatMegabytes } from '@/web/lib/format'

const { t } = useI18n()
const { capabilities } = useCapabilities(MP4_TO_GIF_TOOL_ID)
const {
  job,
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
} = useJob(MP4_TO_GIF_TOOL_ID)

const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const validationError = ref('')
const imageFailed = ref(false)
const videoMeta = ref<{
  duration: number
  width: number
  height: number
} | null>(null)

const options = reactive<Mp4ToGifOptions>({ ...mp4ToGifDefaults })
const durationMode = ref<'full' | 'custom'>('full')
const customDuration = ref(10)

const maxUploadBytes = computed(
  () => capabilities.value?.maxUploadBytes ?? 200 * 1024 * 1024,
)
const maxDuration = computed(() => capabilities.value?.maxDurationSeconds ?? 60)
const maxUploadLabel = computed(() => formatMegabytes(maxUploadBytes.value))
const ttlMinutes = computed(() =>
  Math.max(1, Math.round((capabilities.value?.resultTtlSeconds ?? 3600) / 60)),
)
const sourceDuration = computed(() => videoMeta.value?.duration ?? 0)

const maxClipDuration = computed(() => {
  const remaining = sourceDuration.value
    ? sourceDuration.value - options.startTime
    : maxDuration.value
  return Math.max(0.1, Math.min(remaining, maxDuration.value))
})

const fileMeta = computed(() => {
  if (!file.value) return ''
  const parts = [formatBytes(file.value.size)]
  if (videoMeta.value) {
    parts.unshift(
      `${videoMeta.value.width}×${videoMeta.value.height}`,
      formatDuration(videoMeta.value.duration),
    )
  }
  return parts.join(' · ')
})

const phaseLabel = computed(() => {
  if (isUploading.value) return t('mp4ToGif.progress.uploading')
  const phase = job.value?.phase ?? 'queued'
  return t(`mp4ToGif.progress.${phase}`)
})

const progressValue = computed(() =>
  isUploading.value ? uploadPercent.value : (job.value?.progress ?? 0),
)

const isCompleted = computed(() => job.value?.status === 'completed')
const isFailed = computed(() => job.value?.status === 'failed')
const isCancelled = computed(() => job.value?.status === 'cancelled')
const isExpired = computed(() => job.value?.status === 'expired')
const showProgress = computed(() => isUploading.value || isActive.value)

const statusLabel = computed(() => {
  if (imageFailed.value) return t('mp4ToGif.status.expired')
  if (!job.value) return ''
  return t(`mp4ToGif.status.${job.value.status}`)
})

const jobErrorMessage = computed(() => {
  if (imageFailed.value) return t('errors.EXPIRED')
  if (!job.value || (!isFailed.value && !isCancelled.value && !isExpired.value)) {
    return ''
  }
  return job.value.errorCode
    ? t(`errors.${job.value.errorCode}`)
    : (job.value.errorMessage ?? '')
})

const uploadErrorMessage = computed(() => {
  if (validationError.value) return validationError.value
  if (error.value) return t(`errors.${error.value.code}`)
  return ''
})

const expiryMinutes = computed(() => {
  if (!job.value?.expiresAt) return 0
  return Math.max(0, Math.round((Date.parse(job.value.expiresAt) - Date.now()) / 60_000))
})

watch(
  () => options.startTime,
  (startTime) => {
    if (!Number.isFinite(startTime) || startTime < 0) {
      options.startTime = 0
      return
    }
    if (sourceDuration.value && startTime >= sourceDuration.value) {
      options.startTime = Math.max(0, sourceDuration.value - 0.1)
    }
  },
)

watch(
  () => job.value?.id,
  () => {
    imageFailed.value = false
  },
)

function openPicker(): void {
  if (isBusy.value) return
  fileInput.value?.click()
}

function readMetadata(selected: File): void {
  videoMeta.value = null
  const url = URL.createObjectURL(selected)
  const video = document.createElement('video')
  video.preload = 'metadata'

  const release = () => {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }

  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      videoMeta.value = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      }
      options.startTime = 0
      customDuration.value = Math.max(
        0.1,
        Math.min(10, video.duration, maxDuration.value),
      )
    }
    release()
  }

  video.onerror = () => {
    videoMeta.value = null
    release()
  }

  video.src = url
}

function selectFile(selected: File): void {
  validationError.value = ''

  const looksLikeVideo =
    selected.type.startsWith('video/') ||
    /\.(mp4|m4v|mov|webm|avi|mkv)$/i.test(selected.name)

  if (!looksLikeVideo) {
    validationError.value = t('mp4ToGif.errors.invalidType')
    return
  }

  if (selected.size > maxUploadBytes.value) {
    validationError.value = t('mp4ToGif.errors.tooLarge', {
      size: maxUploadLabel.value,
    })
    return
  }

  void reset()
  file.value = selected
  durationMode.value = 'full'
  Object.assign(options, mp4ToGifDefaults)
  readMetadata(selected)
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (selected) selectFile(selected)
  input.value = ''
}

function onDrop(event: DragEvent): void {
  isDragging.value = false
  const selected = event.dataTransfer?.files?.[0]
  if (selected) selectFile(selected)
}

function removeFile(): void {
  void reset()
  file.value = null
  videoMeta.value = null
  validationError.value = ''
  durationMode.value = 'full'
  Object.assign(options, mp4ToGifDefaults)
  imageFailed.value = false
}

function resetAll(): void {
  removeFile()
}

async function startConversion(): Promise<void> {
  if (!file.value || isBusy.value) return

  clearError()
  validationError.value = ''

  if (sourceDuration.value && options.startTime >= sourceDuration.value) {
    validationError.value = t('mp4ToGif.errors.startOutOfRange')
    return
  }

  if (durationMode.value === 'custom' && customDuration.value > maxDuration.value) {
    validationError.value = t('mp4ToGif.errors.durationTooLong', {
      seconds: maxDuration.value,
    })
    return
  }

  const payload: Mp4ToGifOptions = {
    fps: options.fps,
    width: options.width,
    startTime: options.startTime,
    duration:
      durationMode.value === 'full'
        ? 'full'
        : Math.min(customDuration.value, maxClipDuration.value),
    loop: options.loop,
  }

  await start(file.value, payload)
}
</script>

<template>
  <form
    class="mt-8 grid items-start gap-6 lg:grid-cols-[1.08fr_0.92fr]"
    @submit.prevent="startConversion"
  >
    <div class="space-y-6">
      <section class="surface-card p-5 sm:p-6">
        <div class="flex items-center justify-between gap-3">
          <h2 class="section-title">
            <Film :size="18" class="text-accent" />
            {{ t('mp4ToGif.upload.title') }}
          </h2>
          <span class="limit-pill"> {{ t('common.max') }} {{ maxUploadLabel }} </span>
        </div>

        <div
          class="dropzone mt-5"
          :class="{
            'dropzone-active': isDragging,
            'dropzone-filled': file,
            'dropzone-disabled': isBusy,
          }"
          :role="file ? undefined : 'button'"
          :tabindex="file ? -1 : 0"
          :aria-label="t('mp4ToGif.upload.hint')"
          @click="openPicker"
          @keydown.enter.prevent="openPicker"
          @keydown.space.prevent="openPicker"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept="video/*,.mp4"
            class="hidden"
            @change="onFileChange"
          />

          <template v-if="file">
            <span class="dropzone-icon dropzone-icon-filled">
              <FileVideo2 :size="26" />
            </span>
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-sm font-semibold text-ink">
                {{ file.name }}
              </p>
              <p class="mt-1 text-xs text-muted">{{ fileMeta }}</p>
              <p class="mt-2 text-xs font-medium text-accent">
                {{ t('mp4ToGif.upload.change') }}
              </p>
            </div>
            <button
              type="button"
              class="icon-button shrink-0"
              :title="t('mp4ToGif.upload.remove')"
              @click.stop="removeFile"
            >
              <X :size="17" />
            </button>
          </template>

          <template v-else>
            <span class="dropzone-icon" :class="{ 'dropzone-icon-active': isDragging }">
              <UploadCloud :size="28" />
            </span>
            <div class="text-center">
              <p class="text-sm font-medium text-ink">
                {{ isDragging ? t('mp4ToGif.upload.drop') : t('mp4ToGif.upload.hint') }}
              </p>
              <p class="mt-1.5 text-xs text-muted">
                {{ t('common.max') }} {{ maxUploadLabel }}
              </p>
            </div>
          </template>
        </div>

        <p v-if="uploadErrorMessage" class="error-inline mt-4" role="alert">
          <AlertTriangle :size="15" />
          <span>{{ uploadErrorMessage }}</span>
        </p>
      </section>

      <section class="surface-card p-5 sm:p-6">
        <h2 class="section-title">
          <SlidersHorizontal :size="18" class="text-accent" />
          {{ t('mp4ToGif.options.title') }}
        </h2>

        <div class="mt-6 space-y-6">
          <div>
            <div class="flex items-center justify-between">
              <label for="fps" class="field-label">
                {{ t('mp4ToGif.options.fps') }}
              </label>
              <span class="value-pill">{{ options.fps }} fps</span>
            </div>
            <input
              id="fps"
              v-model.number="options.fps"
              type="range"
              min="5"
              max="30"
              step="1"
              class="range-input mt-3"
            />
            <p class="mt-2 text-xs text-muted">
              {{ t('mp4ToGif.options.fpsHint') }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="field">
              <span class="field-label">{{ t('mp4ToGif.options.width') }}</span>
              <select v-model="options.width" class="input-field">
                <option value="original">
                  {{ t('mp4ToGif.options.original') }}
                </option>
                <option v-for="width in mp4ToGifWidthPresets" :key="width" :value="width">
                  {{ width }} px
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">{{ t('mp4ToGif.options.start') }}</span>
              <span class="input-with-suffix">
                <input
                  v-model.number="options.startTime"
                  type="number"
                  min="0"
                  :max="sourceDuration || undefined"
                  step="0.1"
                  class="input-field"
                />
                <span>{{ t('common.seconds') }}</span>
              </span>
            </label>
          </div>

          <div>
            <span class="field-label">{{ t('mp4ToGif.options.duration') }}</span>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <div class="segmented-control">
                <button
                  type="button"
                  class="segmented-item"
                  :class="{ 'segmented-item-active': durationMode === 'full' }"
                  @click="durationMode = 'full'"
                >
                  {{ t('mp4ToGif.options.full') }}
                </button>
                <button
                  type="button"
                  class="segmented-item"
                  :class="{ 'segmented-item-active': durationMode === 'custom' }"
                  @click="durationMode = 'custom'"
                >
                  {{ t('mp4ToGif.options.custom') }}
                </button>
              </div>

              <span v-if="durationMode === 'custom'" class="input-with-suffix w-32">
                <input
                  v-model.number="customDuration"
                  type="number"
                  min="0.1"
                  :max="maxClipDuration"
                  step="0.1"
                  class="input-field"
                />
                <span>{{ t('common.seconds') }}</span>
              </span>
            </div>
          </div>

          <div
            class="flex items-center justify-between gap-4 rounded-2xl border border-line bg-[var(--surface-muted)] px-4 py-3.5"
          >
            <div>
              <p class="text-sm font-medium text-ink">
                {{ t('mp4ToGif.options.loop') }}
              </p>
              <p class="mt-0.5 text-xs text-muted">
                {{ t('mp4ToGif.options.loopHint') }}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="options.loop"
              class="switch"
              :class="{ 'switch-on': options.loop }"
              @click="options.loop = !options.loop"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>
        </div>

        <p class="mt-5 text-xs leading-5 text-muted">
          {{
            t('mp4ToGif.options.maxNote', {
              seconds: maxDuration,
              size: maxUploadLabel,
            })
          }}
        </p>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="submit" class="btn-primary flex-1" :disabled="!file || isBusy">
            <LoaderCircle v-if="isBusy" :size="17" class="animate-spin" />
            <Play v-else :size="17" />
            {{
              isBusy ? t('mp4ToGif.actions.converting') : t('mp4ToGif.actions.convert')
            }}
          </button>
          <button
            type="button"
            class="btn-secondary"
            :disabled="!file && !job"
            @click="resetAll"
          >
            <RotateCcw :size="16" />
            {{ t('mp4ToGif.actions.reset') }}
          </button>
        </div>
      </section>

      <section class="surface-card p-5 sm:p-6">
        <h2 class="section-title">
          <Lightbulb :size="18" class="text-accent" />
          {{ t('mp4ToGif.tips.title') }}
        </h2>
        <ul class="mt-4 space-y-2.5 text-sm leading-6 text-muted">
          <li class="flex gap-2.5">
            <span class="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]"></span>
            {{ t('mp4ToGif.tips.one') }}
          </li>
          <li class="flex gap-2.5">
            <span class="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]"></span>
            {{ t('mp4ToGif.tips.two') }}
          </li>
          <li class="flex gap-2.5">
            <span class="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]"></span>
            {{ t('mp4ToGif.tips.three') }}
          </li>
        </ul>
      </section>
    </div>

    <aside class="lg:sticky lg:top-6">
      <section class="surface-card overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 border-b border-line px-5 py-4"
        >
          <h2 class="section-title">
            <Sparkles :size="18" class="text-accent" />
            {{ t('mp4ToGif.result.title') }}
          </h2>
          <span
            v-if="statusLabel"
            class="status-pill"
            :class="{
              'status-pill-success': isCompleted && !imageFailed,
              'status-pill-error': isFailed || isExpired || imageFailed,
              'status-pill-muted': isCancelled,
            }"
          >
            <Check v-if="isCompleted" :size="13" />
            <LoaderCircle v-else-if="showProgress" :size="13" class="animate-spin" />
            <AlertTriangle v-else-if="isFailed || isExpired" :size="13" />
            <Ban v-else :size="13" />
            {{ statusLabel }}
          </span>
        </div>

        <div class="p-5">
          <div v-if="showProgress" class="space-y-5">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-ink">{{ phaseLabel }}</p>
                <p class="mt-1 truncate text-xs text-muted">
                  {{ file?.name }}
                </p>
              </div>
              <span class="text-2xl font-semibold tracking-tight text-ink">
                {{ progressValue }}<span class="text-sm text-muted">%</span>
              </span>
            </div>

            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${progressValue}%` }"></div>
            </div>

            <div
              class="rounded-2xl border border-line bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-muted"
            >
              <Clock3 :size="14" class="mr-1.5 inline-block align-[-2px] text-accent" />
              {{ t('mp4ToGif.result.expires', { minutes: ttlMinutes }) }}
            </div>

            <button type="button" class="btn-danger-ghost w-full" @click="cancel">
              <Ban :size="16" />
              {{ t('mp4ToGif.actions.cancel') }}
            </button>
          </div>

          <div v-else-if="isCompleted && resultUrl && !imageFailed" class="space-y-4">
            <div class="checkerboard overflow-hidden rounded-2xl border border-line p-2">
              <img
                :src="resultUrl"
                :alt="job?.result?.filename ?? 'GIF result'"
                class="mx-auto block max-h-[420px] w-auto max-w-full rounded-lg"
                @error="imageFailed = true"
              />
            </div>

            <div class="flex items-center justify-between gap-3 text-xs text-muted">
              <span>{{ t('mp4ToGif.result.size') }}</span>
              <span class="value-pill">
                {{ formatBytes(job?.result?.size ?? 0) }}
              </span>
            </div>

            <a
              :href="resultUrl"
              :download="job?.result?.filename ?? 'result.gif'"
              class="btn-primary w-full"
            >
              <Download :size="17" />
              {{ t('mp4ToGif.result.download') }}
            </a>

            <button type="button" class="btn-secondary w-full" @click="startConversion">
              <RotateCcw :size="16" />
              {{ t('mp4ToGif.actions.again') }}
            </button>

            <p
              v-if="expiryMinutes > 0"
              class="text-center text-[11px] leading-5 text-muted"
            >
              {{
                t('mp4ToGif.result.expires', {
                  minutes: expiryMinutes,
                })
              }}
            </p>
          </div>

          <div
            v-else-if="isFailed || isCancelled || isExpired || imageFailed"
            class="space-y-4 text-center"
          >
            <span
              class="mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-[var(--danger-soft)] text-[var(--danger)]"
            >
              <AlertTriangle :size="24" />
            </span>
            <div>
              <p class="text-sm font-semibold text-ink">{{ statusLabel }}</p>
              <p class="mt-1.5 text-xs leading-5 text-muted">
                {{ jobErrorMessage }}
              </p>
            </div>
            <button
              v-if="file && !isBusy"
              type="button"
              class="btn-secondary w-full"
              @click="startConversion"
            >
              <RotateCcw :size="16" />
              {{ t('common.retry') }}
            </button>
          </div>

          <div v-else class="preview-empty">
            <span class="preview-empty-icon">
              <Sparkles :size="26" />
            </span>
            <p class="mt-4 text-sm font-semibold text-ink">
              {{ t('mp4ToGif.result.emptyTitle') }}
            </p>
            <p class="mt-2 max-w-[260px] text-xs leading-5 text-muted">
              {{ t('mp4ToGif.result.emptyHint') }}
            </p>
          </div>
        </div>
      </section>

      <div class="mt-4 flex items-start gap-2.5 px-1 text-[11px] leading-5 text-muted">
        <Clock3 :size="14" class="mt-0.5 shrink-0" />
        <span>{{ t('mp4ToGif.result.expires', { minutes: ttlMinutes }) }}</span>
      </div>
    </aside>
  </form>
</template>
