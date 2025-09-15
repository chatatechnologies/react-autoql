import { ColumnTypes } from 'autoql-fe-utils'
// Utility function to check if a column is numeric (QUANTITY or DOLLAR_AMT)
export function isNumericColumn(column) {
  return column?.type === ColumnTypes.QUANTITY || column?.type === ColumnTypes.DOLLAR_AMT
}
