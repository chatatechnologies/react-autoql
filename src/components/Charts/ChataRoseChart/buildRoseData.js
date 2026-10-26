import { MAX_ROSE_CATEGORIES } from 'autoql-fe-utils'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

export const ROSE_OTHER_KEY = '__rose_other__'

const getMagnitude = (category) => category.values.reduce((sum, value) => sum + Math.abs(value), 0)

// Sum each value column (or count rows) per category. Categories keep the order they first appear in,
// so the wedges go around the circle in the same order as the table. When there are more than
// maxCategories, the largest by magnitude are kept and the rest are combined into an "Other" wedge.
export const buildRoseData = (data, categoryColumnIndex, valueColumnIndices, maxCategories = MAX_ROSE_CATEGORIES) => {
  if (!data?.length || categoryColumnIndex < 0 || !valueColumnIndices?.length) {
    return { categories: [], totalCategories: 0, isTruncated: false }
  }

  const categoryMap = new Map()
  data.forEach((row) => {
    if (!row) {
      return
    }

    const rawValue = row[categoryColumnIndex] ?? null
    const key = JSON.stringify(rawValue)
    let category = categoryMap.get(key)
    if (!category) {
      category = { key, rawValue, values: valueColumnIndices.map(() => 0) }
      categoryMap.set(key, category)
    }

    valueColumnIndices.forEach((columnIndex, layer) => {
      const value = columnIndex === SANKEY_VALUE_COUNT_SENTINEL ? 1 : Number(row[columnIndex] ?? NaN)
      if (Number.isFinite(value)) {
        category.values[layer] += value
      }
    })
  })

  let categories = Array.from(categoryMap.values())
  const totalCategories = categories.length
  const isTruncated = totalCategories > maxCategories

  if (isTruncated) {
    const kept = new Set(
      categories
        .slice()
        .sort((a, b) => getMagnitude(b) - getMagnitude(a))
        .slice(0, maxCategories - 1),
    )
    const rest = categories.filter((category) => !kept.has(category))
    const other = {
      key: ROSE_OTHER_KEY,
      rawValue: null,
      isOther: true,
      otherCount: rest.length,
      values: valueColumnIndices.map((_, layer) => rest.reduce((sum, category) => sum + category.values[layer], 0)),
    }
    categories = [...categories.filter((category) => kept.has(category)), other]
  }

  categories.forEach((category) => {
    category.total = category.values.reduce((sum, value) => sum + value, 0)
  })

  return { categories, totalCategories, isTruncated }
}
