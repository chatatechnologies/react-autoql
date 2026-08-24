/**
 * Helpers for the free-form number inputs in the Data Alert builder (threshold constants).
 *
 * Users type thresholds the way they read them -- with thousands separators, currency symbols
 * and spaces (eg. "$5,000,000") -- so the input accepts all of that and the formatting is
 * stripped out before the value is sent to the backend, which only wants the number itself.
 * A trailing "%" is meaningful (percent of the compared value) and is preserved.
 */

/** Strips every character that isn't part of the number, keeping a leading sign and trailing %. */
export const stripNumberFormatting = (value) => {
  const str = String(value ?? '').trim()
  if (!str) {
    return ''
  }

  const isPercent = str.endsWith('%')
  const body = isPercent ? str.slice(0, -1) : str
  const isNegative = body.trimStart().startsWith('-')
  const digits = body.replace(/[^\d.]/g, '')

  return `${isNegative ? '-' : ''}${digits}${isPercent ? '%' : ''}`
}

/** Parses a formatted number into a float. A trailing "%" is dropped, not divided by 100. */
export const parseFormattedNumber = (value) => {
  if (typeof value === 'number') {
    return value
  }

  const stripped = stripNumberFormatting(value)
  return parseFloat(stripped.endsWith('%') ? stripped.slice(0, -1) : stripped)
}

/**
 * True while `value` could still become a number as the user types -- so partial entries like
 * "", "-", "1,", "1." and "$1,00" are all allowed through, but letters and stray decimal
 * points aren't.
 */
export const isPartialNumberInput = (value) => {
  const str = String(value ?? '')
  if (str === '') {
    return true
  }

  if (/[a-zA-Z]/.test(str)) {
    return false
  }

  return /^-?\d*(?:\.\d*)?%?$/.test(stripNumberFormatting(str))
}

/**
 * Normalizes a typed threshold into the plain numeric string sent to the backend,
 * eg. "$5,000,000" -> "5000000", "40.%" -> "40%". Returns the input untouched when it holds
 * no number at all, so nothing is silently swallowed.
 */
export const formatNumberTermValue = (value) => {
  const stripped = stripNumberFormatting(value)
  const isPercent = stripped.endsWith('%')
  const number = parseFormattedNumber(stripped)

  if (isNaN(number)) {
    return value
  }

  return isPercent ? `${number}%` : `${number}`
}
