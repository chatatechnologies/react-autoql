const MICROS_PER_DOLLAR = 1000000

// BillingQuotaUpdateResponse carries a currency code per-account, so these accept an optional
// currency/locale now (defaulting to the USD/en-US behavior this shipped with) rather than
// locking the signature to USD and having to add the parameter as a breaking change later.
const currencyFormatterCache = new Map()

const getCurrencyFormatter = (currency, locale) => {
  const cacheKey = `${locale}:${currency}`
  if (!currencyFormatterCache.has(cacheKey)) {
    currencyFormatterCache.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }),
    )
  }

  return currencyFormatterCache.get(cacheKey)
}

export const formatMicrosAsCurrency = (micros, emptyLabel = 'Not set', currency = 'USD', locale = 'en-US') => {
  if (micros === null || micros === undefined) {
    return emptyLabel
  }

  return getCurrencyFormatter(currency, locale).format(micros / MICROS_PER_DOLLAR)
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

export const currencyInputFromMicros = (micros, currency = 'USD') => {
  if (micros === null || micros === undefined) {
    return ''
  }

  const fractionDigits = getCurrencyFormatter(currency, 'en-US').resolvedOptions().maximumFractionDigits
  return (micros / MICROS_PER_DOLLAR).toFixed(fractionDigits)
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
