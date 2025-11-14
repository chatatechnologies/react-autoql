import React from 'react'
import PropTypes from 'prop-types'
import {
  isSingleValueResponse,
  isListQuery,
  formatElement,
  getDataFormatting,
  getDateColumnIndex,
  getNumberColumnIndices,
  sortDataByDate,
  ColumnTypes,
} from 'autoql-fe-utils'
import { Icon } from '../../Icon'

export default class NotificationDataSummary extends React.Component {
  // Analyze notification data to determine summary type
  getNotificationSummaryType = () => {
    const queryResult = this.props.notification?.query_result
    if (!queryResult?.data?.columns || !queryResult?.data?.rows) {
      return null
    }

    const columns = queryResult.data.columns
    const rows = queryResult.data.rows
    const PERCENT = ColumnTypes.PERCENT || 'PERCENT'

    // Check for rows with PERCENT column - use the last column if it's PERCENT as the difference
    const lastColumnIndex = columns.length - 1
    const lastColumn = columns[lastColumnIndex]
    const isLastColumnPercent = lastColumn && (lastColumn.type === PERCENT || lastColumn.type === 'PERCENT')

    if (isLastColumnPercent && rows.length > 0) {
      // Check if any row has a non-null percent value in the last column
      const hasPercentValue = rows.some((row) => row[lastColumnIndex] !== null && row[lastColumnIndex] !== undefined)
      if (hasPercentValue) {
        return { type: 'percent-single-row', columns, rows, differenceColumnIndex: lastColumnIndex }
      }
    }

    // Check if single value
    if (isSingleValueResponse({ data: queryResult })) {
      return { type: 'single-value', columns, rows }
    }

    // Check if has DATE column
    const dateColumnIndex = getDateColumnIndex(columns)
    if (dateColumnIndex !== -1 && rows.length > 1) {
      return { type: 'trend', columns, rows, dateColumnIndex }
    }

    // List without DATE column
    if (rows.length > 0) {
      return { type: 'list', columns, rows }
    }

    return null
  }

  // Render PERCENT column summary (shows number value and percent change)
  renderPercentSingleRowSummary = (summaryData) => {
    const { columns, rows, differenceColumnIndex } = summaryData
    const PERCENT = ColumnTypes.PERCENT || 'PERCENT'

    // Get the most recent row (sorted by date, or use only row if there's just one)
    let mostRecentRow = rows[0]
    if (rows.length > 1) {
      const sortedRows = sortDataByDate(rows, columns, 'desc') || rows
      mostRecentRow = sortedRows[0]
    }

    // Use the last column (difference column) for the percent change indicator
    const differenceColumn = columns[differenceColumnIndex]
    const differenceValue = mostRecentRow?.[differenceColumnIndex]

    // Find the last number column (excluding the last PERCENT column) for the main big number
    // Iterate backwards from the difference column to find the last number column before it
    // This can include PERCENT type columns as long as they're not the last PERCENT column
    let numberColumnIndex = null
    let numberColumn = null

    // Start from the column just before the difference column and work backwards
    for (let i = differenceColumnIndex - 1; i >= 0; i--) {
      const col = columns[i]
      if (col) {
        const isNumberType =
          col.type === 'QUANTITY' ||
          col.type === 'DOLLAR_AMT' ||
          col.type === 'RATIO' ||
          col.type === 'PERCENT' ||
          col.type === 'INTEGER' ||
          col.type === 'DECIMAL' ||
          col.type === 'FLOAT'

        // If it's a number type (including PERCENT), use it
        if (isNumberType) {
          numberColumnIndex = i
          numberColumn = col
          break
        }
      }
    }

    const numberValue = numberColumnIndex !== null ? mostRecentRow?.[numberColumnIndex] : null

    // Format difference value for percent change
    let formattedDifferenceValue = null
    let isNegative = false
    let isPositive = false

    if (differenceValue !== null && differenceValue !== undefined && differenceColumn) {
      const numDifferenceValue = parseFloat(differenceValue)
      isNegative = !isNaN(numDifferenceValue) && numDifferenceValue < 0
      isPositive = !isNaN(numDifferenceValue) && numDifferenceValue > 0

      formattedDifferenceValue = formatElement({
        element: differenceValue,
        column: differenceColumn,
        config: getDataFormatting(this.props.dataFormatting),
      })
    }

    // Format number value
    let formattedNumberValue = null
    if (numberValue !== null && numberValue !== undefined && numberColumn) {
      formattedNumberValue = formatElement({
        element: numberValue,
        column: numberColumn,
        config: getDataFormatting(this.props.dataFormatting),
      })
    }

    return (
      <div className='react-autoql-notification-summary-single-value'>
        <div className='react-autoql-notification-summary-value-container'>
          <div className='react-autoql-notification-summary-value-content'>
            {formattedNumberValue && (
              <div
                className={`react-autoql-notification-summary-value-number ${
                  this.props.isUnread ? 'react-autoql-notification-summary-value-unread' : ''
                }`}
              >
                {formattedNumberValue}
              </div>
            )}
            {formattedDifferenceValue && (
              <div
                className={`react-autoql-notification-summary-value-percent ${
                  isNegative
                    ? 'react-autoql-notification-summary-value-negative'
                    : isPositive
                    ? 'react-autoql-notification-summary-value-positive'
                    : ''
                }`}
              >
                <span>{formattedDifferenceValue}</span>
                {(isNegative || isPositive) && (
                  <Icon
                    type={isPositive ? 'caret-up' : 'caret-down'}
                    className={`react-autoql-notification-summary-percent-icon ${
                      isPositive
                        ? 'react-autoql-notification-summary-percent-icon-up'
                        : 'react-autoql-notification-summary-percent-icon-down'
                    }`}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render single value summary
  renderSingleValueSummary = (summaryData) => {
    const { columns, rows } = summaryData

    // Default behavior for single values
    const column = columns.find((col) => col.is_visible) || columns[0]
    const columnIndex = columns.findIndex((col) => col === column)
    const value = rows[0]?.[columnIndex]

    if (value === null || value === undefined) {
      return null
    }

    return (
      <div className='react-autoql-notification-summary-single-value'>
        <div
          className={`react-autoql-notification-summary-value ${
            this.props.isUnread ? 'react-autoql-notification-summary-value-unread' : ''
          }`}
        >
          {formatElement({
            element: value,
            column,
            config: getDataFormatting(this.props.dataFormatting),
          })}
        </div>
        {column?.display_name && <div className='react-autoql-notification-summary-label'>{column.display_name}</div>}
      </div>
    )
  }

  // Render trend sparkline (mini line graph)
  renderTrendSummary = (summaryData) => {
    const { columns, rows, dateColumnIndex } = summaryData

    // Column types are stored as strings, so compare with string values
    const DOLLAR_AMT = ColumnTypes.DOLLAR_AMT || 'DOLLAR_AMT'
    const QUANTITY = ColumnTypes.QUANTITY || 'QUANTITY'
    const RATIO = ColumnTypes.RATIO || 'RATIO'
    const PERCENT = ColumnTypes.PERCENT || 'PERCENT'

    // If it's a list query and doesn't have a PERCENT column, show record count instead of sparkline
    if (isListQuery(columns)) {
      const hasPercentColumn = columns.some((col) => col.type === PERCENT || col.type === 'PERCENT')
      if (!hasPercentColumn) {
        const count = rows.length
        return (
          <div className='react-autoql-notification-summary-list'>
            <div className='react-autoql-notification-summary-value'>
              <span className='react-autoql-notification-summary-count'>{count}</span>
            </div>
            <div className='react-autoql-notification-summary-label'>{count === 1 ? 'record' : 'records'}</div>
          </div>
        )
      }
    }

    const numberColumnIndicesResult = getNumberColumnIndices(columns)
    // getNumberColumnIndices returns an object, extract the array property
    const numberColumnIndices = Array.isArray(numberColumnIndicesResult)
      ? numberColumnIndicesResult
      : numberColumnIndicesResult?.numberColumnIndices || []

    // Ensure numberColumnIndices is an array
    if (!Array.isArray(numberColumnIndices) || numberColumnIndices.length === 0) {
      return null
    }

    // Use the last number column (excluding the last PERCENT column if it exists)
    let numberColumnIndex = null
    let numberColumn = null

    // Check if the last column is PERCENT
    const lastColumnIndex = columns.length - 1
    const lastColumn = columns[lastColumnIndex]
    const isLastColumnPercent = lastColumn && (lastColumn.type === PERCENT || lastColumn.type === 'PERCENT')

    // Filter out PERCENT columns (including the last one if it's PERCENT) and use the last remaining one
    const validNumberIndices = numberColumnIndices.filter((idx) => {
      const isPercent = columns[idx]?.type === PERCENT || columns[idx]?.type === 'PERCENT'
      // Exclude if it's PERCENT, or if it's the last column and that column is PERCENT
      return !isPercent && !(idx === lastColumnIndex && isLastColumnPercent)
    })
    if (validNumberIndices.length > 0) {
      // Get the highest index value (last number column before the PERCENT column)
      numberColumnIndex = Math.max(...validNumberIndices)
      numberColumn = columns[numberColumnIndex]
    }

    if (!numberColumn || numberColumnIndex === null) {
      return null
    }

    // Sort by date ascending for sparkline
    const sortedRows = sortDataByDate(rows, columns, 'asc') || rows

    // Extract values for sparkline
    const values = sortedRows
      .map((row) => {
        const numValue = parseFloat(row[numberColumnIndex])
        return isNaN(numValue) ? 0 : numValue
      })
      .filter((val) => val !== null && val !== undefined)

    if (values.length === 0) {
      return null
    }

    // Calculate min/max for scaling
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1

    // Sparkline dimensions
    const width = 80
    const height = 30
    const padding = 2
    const bottomPadding = 4 // Extra padding at bottom to show more fill area
    const extraFillHeight = 8 // Extra fill area underneath the lowest point
    const svgHeight = height + extraFillHeight // Total SVG height including extra fill

    // Generate path - handle single point case
    let pathData = ''
    let fillPathData = ''
    if (values.length === 1) {
      // For single point, draw a horizontal line
      const x = width / 2
      const y = height / 2
      pathData = `M ${padding} ${y} L ${width - padding} ${y}`
      // Fill area for single point (horizontal line) - extend to bottom with extra fill
      fillPathData = `M ${padding} ${y} L ${width - padding} ${y} L ${
        width - padding
      } ${svgHeight} L ${padding} ${svgHeight} Z`
    } else {
      const pathPoints = values.map((value, index) => {
        const x = padding + (index / (values.length - 1)) * (width - padding * 2)
        // Adjust y calculation to leave space at bottom - lowest point will be above bottomPadding
        const availableHeight = height - padding - bottomPadding
        const y = height - padding - ((value - minValue) / range) * availableHeight
        return { x, y }
      })

      // Find the lowest point (highest y value)
      const lowestY = Math.max(...pathPoints.map((p) => p.y))

      // Line path
      pathData = pathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

      // Fill path (line + extend below lowest point + bottom corners + close)
      const firstPoint = pathPoints[0]
      const lastPoint = pathPoints[pathPoints.length - 1]
      // Extend fill below the lowest point by extraFillHeight
      fillPathData = `${pathData} L ${lastPoint.x} ${lowestY + extraFillHeight} L ${firstPoint.x} ${
        lowestY + extraFillHeight
      } Z`
    }

    // Calculate percent change between the 2 most recent rows
    let percentChange = null
    let isNegative = false
    let isPositive = false
    let formattedPercentChange = null

    if (values.length >= 2) {
      // Get the last 2 values (most recent first, since we sorted ascending)
      const previousValue = values[values.length - 2]
      const currentValue = values[values.length - 1]

      if (previousValue !== 0 && previousValue !== null && previousValue !== undefined) {
        percentChange = ((currentValue - previousValue) / previousValue) * 100
        isNegative = percentChange < 0
        isPositive = percentChange > 0

        // Create a synthetic PERCENT column for formatting
        const percentColumn = {
          type: ColumnTypes.PERCENT || 'PERCENT',
          name: 'percent_change',
          display_name: 'Percent Change',
        }

        formattedPercentChange = formatElement({
          element: percentChange,
          column: percentColumn,
          config: getDataFormatting(this.props.dataFormatting),
        })
      }
    }

    // Generate unique gradient ID for this sparkline
    const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className='react-autoql-notification-summary-trend'>
        <div className='react-autoql-notification-summary-trend-content'>
          <svg
            width={width}
            height={svgHeight}
            viewBox={`0 0 ${width} ${svgHeight}`}
            preserveAspectRatio='none'
            style={{ display: 'block' }}
          >
            <defs>
              <linearGradient id={gradientId} x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' stopColor='var(--react-autoql-accent-color)' stopOpacity='0.2' />
                <stop offset='70%' stopColor='var(--react-autoql-accent-color)' stopOpacity='0.2' />
                <stop offset='100%' stopColor='var(--react-autoql-accent-color)' stopOpacity='0' />
              </linearGradient>
            </defs>
            {/* Fill area under the line */}
            {fillPathData && <path d={fillPathData} fill={`url(#${gradientId})`} />}
            {/* Line on top */}
            <path
              d={pathData}
              fill='none'
              stroke='var(--react-autoql-accent-color)'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          {formattedPercentChange && (
            <div className='react-autoql-notification-summary-trend-value-container'>
              <div
                className={`react-autoql-notification-summary-trend-value-wrapper ${
                  isNegative
                    ? 'react-autoql-notification-summary-trend-value-negative'
                    : isPositive
                    ? 'react-autoql-notification-summary-trend-value-positive'
                    : ''
                }`}
              >
                <span className='react-autoql-notification-summary-trend-value'>{formattedPercentChange}</span>
                {(isNegative || isPositive) && (
                  <Icon
                    type={isPositive ? 'caret-up' : 'caret-down'}
                    className={`react-autoql-notification-summary-trend-icon ${
                      isPositive
                        ? 'react-autoql-notification-summary-trend-icon-up'
                        : 'react-autoql-notification-summary-trend-icon-down'
                    }`}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render list summary (count or top items)
  renderListSummary = (summaryData) => {
    const { rows } = summaryData
    const count = rows.length

    // Show count for now - could be enhanced to show top items
    return (
      <div className='react-autoql-notification-summary-list'>
        <div
          className={`react-autoql-notification-summary-value ${
            this.props.isUnread ? 'react-autoql-notification-summary-value-unread' : ''
          }`}
        >
          <span className='react-autoql-notification-summary-count'>{count}</span>
        </div>
        <div className='react-autoql-notification-summary-label'>{count === 1 ? 'record' : 'records'}</div>
      </div>
    )
  }

  // Render data summary based on type
  renderDataSummary = () => {
    const summaryData = this.getNotificationSummaryType()
    if (!summaryData) {
      return null
    }

    switch (summaryData.type) {
      case 'percent-single-row':
        return this.renderPercentSingleRowSummary(summaryData)
      case 'single-value':
        return this.renderSingleValueSummary(summaryData)
      case 'trend':
        return this.renderTrendSummary(summaryData)
      case 'list':
        return this.renderListSummary(summaryData)
      default:
        return null
    }
  }

  render() {
    return this.renderDataSummary()
  }
}

NotificationDataSummary.propTypes = {
  notification: PropTypes.object,
  dataFormatting: PropTypes.object,
  isUnread: PropTypes.bool,
}

NotificationDataSummary.defaultProps = {
  notification: null,
  dataFormatting: null,
  isUnread: false,
}
