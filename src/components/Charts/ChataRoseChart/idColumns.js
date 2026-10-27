import { ColumnTypes } from 'autoql-fe-utils'

// Number columns that are really identifiers (Customer Key, Transaction Number, ...). Adding them up
// means nothing, so they're left out of the measures picked by default; they can still be picked by hand.

// The last word of the display name, or the end of the raw name (eg. "sales.customer_id")
const ID_DISPLAY_NAME = /(^|\s)(id|key|number|no|num|code)$/i
const ID_RAW_NAME = /(^|[._])(id|key|number|no|num|code)$/i

// With at least this many values, nearly all distinct whole numbers reads as an identifier
const MIN_VALUES_TO_JUDGE = 20
const DISTINCT_SHARE = 0.95

const hasIdName = (column) =>
  ID_DISPLAY_NAME.test(`${column?.display_name ?? ''}`.trim()) || ID_RAW_NAME.test(`${column?.name ?? ''}`.trim())

const hasIdValues = (values) => {
  const numbers = values.filter((value) => value !== null && value !== undefined && value !== '').map(Number)
  if (numbers.length < MIN_VALUES_TO_JUDGE || !numbers.every(Number.isInteger)) {
    return false
  }
  return new Set(numbers).size / numbers.length >= DISTINCT_SHARE
}

// Only plain quantities can be identifiers: money, percentages and ratios are always real measures
export const isIdLikeColumn = (column, values = []) =>
  column?.type === ColumnTypes.QUANTITY && (hasIdName(column) || hasIdValues(values))
