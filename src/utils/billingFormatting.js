const MICROS_PER_DOLLAR = 1000000

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export const formatMicrosAsCurrency = (micros, emptyLabel = 'Not set') => {
  if (micros === null || micros === undefined) {
    return emptyLabel
  }

  return currencyFormatter.format(micros / MICROS_PER_DOLLAR)
}

export const microsFromCurrencyInput = (value) => {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * MICROS_PER_DOLLAR)
}

export const currencyInputFromMicros = (micros) => {
  if (micros === null || micros === undefined) {
    return ''
  }

  return (micros / MICROS_PER_DOLLAR).toFixed(2)
}

export const formatBillingPeriod = (period) => {
  if (!period) {
    return 'Not available'
  }

  const [year, month] = period.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) {
    return period
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export const getDefaultBillingHistoryRange = () => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const to = `${year}-${String(month + 1).padStart(2, '0')}`
  const fromDate = new Date(Date.UTC(year, month - 5, 1))
  const from = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, '0')}`

  return { from, to }
}
