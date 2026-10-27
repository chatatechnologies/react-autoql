import { MAX_ROSE_CATEGORIES } from 'autoql-fe-utils'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

export const ROSE_OTHER_KEY = '__rose_other__'

const getMagnitude = (category) => category.values.reduce((sum, value) => sum + Math.abs(value), 0)

const getCategoryKey = (row, categoryColumnIndex) => JSON.stringify(row[categoryColumnIndex] ?? null)

const addRowValues = (category, row, valueColumnIndices) => {
  valueColumnIndices.forEach((columnIndex, layer) => {
    const value = columnIndex === SANKEY_VALUE_COUNT_SENTINEL ? 1 : Number(row[columnIndex] ?? NaN)
    if (Number.isFinite(value)) {
      category.values[layer] += value
    }
  })
}

const addTotals = (categories) => {
  categories.forEach((category) => {
    category.total = category.values.reduce((sum, value) => sum + value, 0)
  })
}

// Sums the rows into a set of categories decided beforehand (eg. from all of the data, when showing one
// time period), so every period has the same wedges in the same places. Rows in a category that isn't in
// the set go to "Other", if there is one. getKey maps a row to its category's key (eg. a number range).
const buildWithFixedCategories = (data, valueColumnIndices, fixedCategories, getKey) => {
  const categories = fixedCategories.map((category) => ({ ...category, values: valueColumnIndices.map(() => 0) }))
  const categoryByKey = new Map(categories.map((category) => [category.key, category]))
  const other = categoryByKey.get(ROSE_OTHER_KEY)

  data.forEach((row) => {
    if (!row) {
      return
    }
    const category = categoryByKey.get(getKey(row)) ?? other
    if (category) {
      addRowValues(category, row, valueColumnIndices)
    }
  })

  addTotals(categories)
  const realCount = categories.filter((category) => !category.isOther).length
  return {
    categories,
    totalCategories: realCount + (other?.otherCount ?? 0),
    isTruncated: !!other,
  }
}

// Sum each value column (or count rows) per category. Categories keep the order they first appear in,
// so the wedges go around the circle in the same order as the table. When there are more than
// maxCategories, the largest by magnitude are kept and the rest are combined into an "Other" wedge.
// Passing fixedCategories (the categories of an earlier build, or number ranges) sums into exactly those
// instead, using getCategoryKeyForRow when the categories aren't plain column values.
export const buildRoseData = (
  data,
  categoryColumnIndex,
  valueColumnIndices,
  maxCategories = MAX_ROSE_CATEGORIES,
  fixedCategories,
  getCategoryKeyForRow,
) => {
  if (categoryColumnIndex < 0 || !valueColumnIndices?.length) {
    return { categories: [], totalCategories: 0, isTruncated: false }
  }

  if (fixedCategories) {
    const getKey = getCategoryKeyForRow ?? ((row) => getCategoryKey(row, categoryColumnIndex))
    return buildWithFixedCategories(data || [], valueColumnIndices, fixedCategories, getKey)
  }

  if (!data?.length) {
    return { categories: [], totalCategories: 0, isTruncated: false }
  }

  const categoryMap = new Map()
  data.forEach((row) => {
    if (!row) {
      return
    }

    const rawValue = row[categoryColumnIndex] ?? null
    const key = getCategoryKey(row, categoryColumnIndex)
    let category = categoryMap.get(key)
    if (!category) {
      category = { key, rawValue, values: valueColumnIndices.map(() => 0) }
      categoryMap.set(key, category)
    }

    addRowValues(category, row, valueColumnIndices)
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

  addTotals(categories)

  return { categories, totalCategories, isTruncated }
}
