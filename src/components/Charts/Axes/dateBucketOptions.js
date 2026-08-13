import { ColumnTypes, DateStringPrecisionTypes, PrecisionTypes } from 'autoql-fe-utils'

// Single source of truth for the cyclical/chronological date bucket options
// shown in StringAxisSelector's hover menu, and for the axis title precision
// label lookup in Axis.js. Keep both in sync by editing only this list.
export const dateBucketOptions = [
  { type: ColumnTypes.DATE, precision: PrecisionTypes.YEAR, label: 'Year' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.QUARTER, label: 'Quarter' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.MONTH, label: 'Month' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.WEEK, label: 'Week' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.DAY, label: 'Day' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.DATE_HOUR, label: 'Hour' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.DATE_MINUTE, label: 'Minute' },
  { type: ColumnTypes.DATE, precision: PrecisionTypes.DATE_SECOND, label: 'Second' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.QUARTERONLY, label: 'Quarter of Year' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.MONTHONLY, label: 'Month of Year' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.WEEKONLY, label: 'Week of Year' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.DOM, label: 'Day of Month' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.DOW, label: 'Day of Week' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.HOUR, label: 'Hour of Day' },
  { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.MINUTE, label: 'Minute of Hour' },
  // Disable for now because it's too granular and not useful for most use cases
  // { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.SECOND, label: 'Second of Minute' },
]
