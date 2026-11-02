export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  const value = bytes / 1024 ** exponent
  const digits = value >= 100 || exponent === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[exponent]}`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}
