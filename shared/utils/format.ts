// Auto-imported by Nuxt (files under shared/utils are isomorphic, client + server).

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

// For headline figures (stat tiles) that have limited width to work with —
// full precision (formatCurrency) truncates ($1,000,035.00 → "$1,000,035…")
// instead of just showing a shorter, still-accurate number ($1.0M).
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

// Backend LocalDateTime values arrive with no timezone suffix (e.g. "2026-08-08T14:09:07"),
// which the JS Date parser treats as local time — local to whichever environment reads it.
// That differs between SSR (the server's timezone) and the browser (the viewer's), shifting
// the displayed value and causing hydration mismatches. Appending 'Z' before parsing plus
// timeZone: 'UTC' on the formatter treats the string's digits as literal wall-clock values
// everywhere, independent of where it's parsed or rendered.
function parseBackendDateTime(value: string): Date {
  return new Date(value.endsWith('Z') ? value : `${value}Z`)
}

// Different Intl/ICU builds render the space before AM/PM differently (regular space vs.
// U+202F narrow no-break space) — normalized here so output is byte-identical regardless
// of which ICU version formatted it, another common, invisible hydration-mismatch source.
function normalizeSpaces(text: string): string {
  return text.replace(/[ \xa0]/g, ' ')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return normalizeSpaces(
    new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    })
  )
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return normalizeSpaces(
    parseBackendDateTime(value).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    })
  )
}

// 'PAST_DUE' / 'past_due' both become 'Past due' — shared by <ColumnValue>'s
// 'enum' column type and any backend enum value shown as plain text.
export function formatEnum(value: string | null | undefined): string {
  if (!value) return '—'
  return humanize(value)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 'dateOfBirth' / 'date_of_birth' both become 'Date of birth' — shared by
// <Field>'s label and <ColumnValue>/<DataTable>'s column header.
export function humanize(name: string): string {
  const words = name
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
