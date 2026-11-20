import { median } from 'd3-array'
import { formatElement, getDataFormatting, isColumnDateType, isColumnNumberType } from 'autoql-fe-utils'

// An example value for a column, taken from a data preview, for a sample query to
// filter on: the median for a number column (median rather than average, so it is a
// value the data could hold), otherwise the first value present.
//
// With a value, sample queries for a grouping column come out as filters ("total
// sales for Acme") rather than groupings ("total sales by customer"). Showing both
// would need work in the query builder service.
export const getExampleValue = ({ column, columnIndex, dataPreview, dataFormatting }) => {
  const columnData = dataPreview?.data?.data?.rows?.map((row) => row[columnIndex]).filter((value) => !!value) ?? []

  let value
  if (isColumnNumberType(column)) {
    value = formatElement({
      element: median(columnData),
      column,
      config: getDataFormatting(dataFormatting),
    })
  } else if (isColumnDateType(column)) {
    value = columnData.find((date) => !!date)
  } else {
    value = columnData.find((str) => !!str)
  }

  return value !== null && value !== undefined ? `${value}` : ''
}

/**
 * The `columns` a SampleQueryList asks for: the searched value (if any), plus each
 * column picked from the preview with an example value from it.
 *
 * @param {object} params
 * @param {object} [params.dataPreview] fetchDataPreview response for the topic
 * @param {number[]} [params.selectedColumns] indices into the preview's columns
 * @param {object} [params.valueLabel] a value searched for, as returned by the
 *   Data Explorer autocomplete
 * @param {object} [params.dataFormatting]
 * @returns {object|undefined} undefined when there is nothing to narrow by
 */
export const getSampleQueryColumns = ({ dataPreview, selectedColumns, valueLabel, dataFormatting }) => {
  let columns

  if (valueLabel?.column_name) {
    columns = { [valueLabel.column_name]: { value: valueLabel.keyword } }
  }

  selectedColumns?.forEach((columnIndex) => {
    const column = dataPreview?.data?.data?.columns?.[columnIndex]
    if (!column || columns?.[column.name]) {
      return
    }

    columns = columns ?? {}
    columns[column.name] = { value: getExampleValue({ column, columnIndex, dataPreview, dataFormatting }) }

    if (column.alt_name) {
      columns[column.name].alternative_column_names = [column.alt_name]
    }
  })

  return columns
}
