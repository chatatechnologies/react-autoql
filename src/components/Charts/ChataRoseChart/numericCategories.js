import { bisectRight } from 'd3-array'
import { scaleLinear } from 'd3-scale'

const BLANK_KEY = JSON.stringify(null)

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return NaN
  }
  return Number(value)
}

// "Nice" boundaries (eg. 0, 100, 200...) covering min..max in at most maxRanges equal-width ranges
const getRangeBoundaries = (min, max, maxRanges) => {
  for (let count = maxRanges; count >= 1; count--) {
    const ticks = scaleLinear().domain([min, max]).nice(count).ticks(count)
    if (ticks.length >= 2 && ticks.length - 1 <= maxRanges && ticks[0] <= min && ticks[ticks.length - 1] >= max) {
      return ticks
    }
  }
  return [min, max]
}

// Categories for a number column picked as the rose's category: one per value when they fit, otherwise
// equal-width ranges like a histogram's, smallest first either way, and blanks last. Built from all of
// the data, so every time period shares them. getKey(row) gives the key of the category a row belongs to.
export const buildNumericCategories = (data, columnIndex, maxCategories) => {
  const values = []
  let hasBlank = false
  data?.forEach((row) => {
    if (!row) {
      return
    }
    const value = toNumber(row[columnIndex])
    if (Number.isFinite(value)) {
      values.push(value)
    } else {
      hasBlank = true
    }
  })

  if (!values.length) {
    return null
  }

  const blankCategories = hasBlank ? [{ key: BLANK_KEY, rawValue: null }] : []
  const slots = Math.max(1, maxCategories - blankCategories.length)
  const distinct = Array.from(new Set(values)).sort((a, b) => a - b)

  if (distinct.length <= slots) {
    return {
      categories: [...distinct.map((value) => ({ key: JSON.stringify(value), rawValue: value })), ...blankCategories],
      getKey: (row) => {
        const value = toNumber(row[columnIndex])
        return Number.isFinite(value) ? JSON.stringify(value) : BLANK_KEY
      },
    }
  }

  const boundaries = getRangeBoundaries(distinct[0], distinct[distinct.length - 1], slots)
  const lastRange = boundaries.length - 2
  const ranges = boundaries.slice(0, -1).map((x0, i) => ({
    key: `range:${i}`,
    rawValue: null,
    range: [x0, boundaries[i + 1]],
  }))

  return {
    categories: [...ranges, ...blankCategories],
    getKey: (row) => {
      const value = toNumber(row[columnIndex])
      if (!Number.isFinite(value)) {
        return BLANK_KEY
      }
      // Ranges include their start; the last one also includes its end
      const index = Math.min(lastRange, Math.max(0, bisectRight(boundaries, value) - 1))
      return `range:${index}`
    },
  }
}
