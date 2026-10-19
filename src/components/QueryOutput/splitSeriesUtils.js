import {
  AggTypes,
  ColumnTypes,
  DisplayTypes,
  formatElement,
  getDataFormatting,
  getLinearAxisTitle,
  isColumnDateType,
  isColumnNumberType,
} from 'autoql-fe-utils'

import { naturalCompare } from './pivotUtils'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../Charts/chartPropHelpers'

// "Split by" turns a list query's chart into one series per unique value of a column. The rows
// are only separated, not aggregated here: each series gets its own number column, appended
// after the original columns so their indices stay valid, and the chart aggregates those the
// same way it aggregates any list query (date buckets, column agg types, element limits).

export const SPLIT_SERIES_COUNT = SANKEY_VALUE_COUNT_SENTINEL
export const SPLIT_SERIES_MAX = 20
export const SPLIT_SERIES_OTHER_KEY = '__autoql_split_other__'
export const SPLIT_SERIES_BLANK_KEY = '__autoql_split_blank__'

export const getSplitSeriesDisplayTypes = () => [
  DisplayTypes.COLUMN,
  DisplayTypes.BAR,
  DisplayTypes.LINE,
  DisplayTypes.STACKED_COLUMN,
  DisplayTypes.STACKED_BAR,
  DisplayTypes.STACKED_LINE,
]

export const supportsSplitSeriesDisplayType = (displayType) => getSplitSeriesDisplayTypes().includes(displayType)

// Columns whose values can become series: visible categories, not numbers or dates (a raw
// date would make a series per timestamp), and not the column already on the x-axis.
export const getSplitSeriesColumnIndices = (columns, stringColumnIndex) => {
  if (!columns?.length) return []

  return columns.reduce((indices, column, index) => {
    if (
      column &&
      column.is_visible !== false &&
      index !== stringColumnIndex &&
      !isColumnNumberType(column) &&
      !isColumnDateType(column)
    ) {
      indices.push(index)
    }
    return indices
  }, [])
}

// Saved picks carry both the name and the index. The name wins because indices shift when
// columns are added; the index is the fallback for when a column has been renamed.
export const resolveSplitColumnIndex = (columns, saved) => {
  if (!saved || !columns?.length) return undefined

  if (saved.name) {
    const byName = columns.findIndex((column) => column?.name === saved.name)
    if (byName >= 0) return byName
  }

  if (Number.isInteger(saved.index) && columns[saved.index]) {
    return saved.index
  }

  return undefined
}

export const getSplitSeriesValueTitle = (columns, valueColumnIndex) => {
  if (valueColumnIndex === SPLIT_SERIES_COUNT) return 'Count'

  const valueColumn = columns?.[valueColumnIndex]
  if (!valueColumn) return undefined

  // Rows with no agg type are summed by the chart, so say so
  const column = { ...valueColumn, aggType: valueColumn.aggType ?? AggTypes.SUM }
  return getLinearAxisTitle({ numberColumns: [column], aggregated: true })
}

const isBlankValue = (value) => value === null || value === undefined || `${value}`.trim() === ''

const getSeriesLabel = ({ key, value, splitColumn, dataFormatting, otherCount }) => {
  if (key === SPLIT_SERIES_OTHER_KEY) {
    const count = new Intl.NumberFormat(getDataFormatting(dataFormatting).languageCode, {}).format(otherCount)
    return `Other (${count})`
  }

  if (key === SPLIT_SERIES_BLANK_KEY) {
    return '(Blank)'
  }

  const formatted = formatElement({ element: value, column: splitColumn, config: getDataFormatting(dataFormatting) })
  return `${formatted ?? value}`
}

/**
 * @returns {{ columns, rows, seriesColumnIndices, totalSeriesCount, otherSeriesCount } | undefined}
 *   `columns` and `rows` are the originals with one number column per series appended.
 *   Undefined when there is nothing to split.
 */
export const buildSplitSeriesData = ({
  rows,
  columns,
  splitColumnIndex,
  valueColumnIndex,
  hiddenSeriesKeys = [],
  dataFormatting,
  maxSeries = SPLIT_SERIES_MAX,
}) => {
  const splitColumn = columns?.[splitColumnIndex]
  const isCount = valueColumnIndex === SPLIT_SERIES_COUNT
  const valueColumn = isCount ? undefined : columns?.[valueColumnIndex]

  if (!rows?.length || !splitColumn || (!isCount && !valueColumn)) {
    return undefined
  }

  const getRowValue = (row) => {
    if (isCount) return 1
    const value = row?.[valueColumnIndex]
    return value === undefined ? null : value
  }

  // Group by the raw value; series size decides which ones survive the series limit
  const groups = new Map()
  rows.forEach((row) => {
    const raw = row?.[splitColumnIndex]
    const key = isBlankValue(raw) ? SPLIT_SERIES_BLANK_KEY : `${raw}`

    if (!groups.has(key)) {
      groups.set(key, { key, value: isBlankValue(raw) ? null : raw, magnitude: 0 })
    }

    const number = Number(getRowValue(row))
    if (Number.isFinite(number)) {
      groups.get(key).magnitude += Math.abs(number)
    }
  })

  let keptGroups = [...groups.values()]
  let droppedGroups = []
  if (keptGroups.length > maxSeries) {
    const bySize = [...keptGroups].sort((a, b) => b.magnitude - a.magnitude)
    keptGroups = bySize.slice(0, maxSeries)
    droppedGroups = bySize.slice(maxSeries)
  }

  // Display order: values in natural order (Round 2 before Round 10), blanks last
  keptGroups.sort((a, b) => {
    if (a.key === SPLIT_SERIES_BLANK_KEY) return 1
    if (b.key === SPLIT_SERIES_BLANK_KEY) return -1
    return naturalCompare(a.value, b.value)
  })

  if (droppedGroups.length) {
    keptGroups.push({ key: SPLIT_SERIES_OTHER_KEY, value: null })
  }

  const firstSeriesIndex = columns.length
  const slotByKey = new Map()
  keptGroups.forEach((group, i) => slotByKey.set(group.key, i))
  droppedGroups.forEach((group) => slotByKey.set(group.key, keptGroups.length - 1))

  const baseColumn = isCount
    ? {
        name: 'count',
        type: ColumnTypes.QUANTITY,
        aggType: AggTypes.SUM,
        precision: undefined,
        isNumberType: true,
        drill_down: undefined,
      }
    : valueColumn

  const seriesColumns = keptGroups.map((group, i) => {
    const index = firstSeriesIndex + i
    const label = getSeriesLabel({
      key: group.key,
      value: group.value,
      splitColumn,
      dataFormatting,
      otherCount: droppedGroups.length,
    })

    return {
      ...baseColumn,
      id: `split-series-${i}`,
      index,
      field: `${index}`,
      name: baseColumn.name,
      display_name: label,
      title: label,
      tooltipTitle: label,
      is_visible: true,
      visible: true,
      groupable: false,
      isSeriesHidden: hiddenSeriesKeys.includes(group.key),
      isSplitSeries: true,
      splitSeriesKey: group.key,
      splitSeriesValue: group.value,
      // Drilldowns skip this column, the same as the pivot's "Other" column
      isPivotOtherColumn: group.key === SPLIT_SERIES_OTHER_KEY,
    }
  })

  const seriesCount = seriesColumns.length
  const splitRows = rows.map((row) => {
    const raw = row?.[splitColumnIndex]
    const key = isBlankValue(raw) ? SPLIT_SERIES_BLANK_KEY : `${raw}`
    const seriesCells = new Array(seriesCount).fill(null)
    seriesCells[slotByKey.get(key)] = getRowValue(row)
    // Series cells must start at firstSeriesIndex even if a row is short
    const originalCells = Array.from({ length: firstSeriesIndex }, (_, i) => row?.[i] ?? null)
    return [...originalCells, ...seriesCells]
  })

  return {
    columns: [...columns, ...seriesColumns],
    rows: splitRows,
    seriesColumnIndices: seriesColumns.map((column) => column.index),
    totalSeriesCount: groups.size,
    otherSeriesCount: droppedGroups.length,
  }
}
