import React from 'react'
import PropTypes from 'prop-types'
import { mean } from 'd3-array'
import { formatElement } from 'autoql-fe-utils'

export class AverageLine extends React.Component {
  static propTypes = {
    data: PropTypes.array.isRequired,
    columns: PropTypes.array.isRequired,
    numberColumnIndex: PropTypes.number.isRequired,
    visibleSeriesIndices: PropTypes.array,
    xScale: PropTypes.object.isRequired,
    yScale: PropTypes.object.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    isVisible: PropTypes.bool.isRequired,
    dataFormatting: PropTypes.object,
    color: PropTypes.string,
    strokeWidth: PropTypes.number,
    strokeDasharray: PropTypes.string,
    chartTooltipID: PropTypes.string,
    chartType: PropTypes.string,
  }

  static defaultProps = {
    dataFormatting: {},
    color: '#ff6b6b',
    strokeWidth: 2,
    strokeDasharray: '5,5',
  }

  calculateAverage = () => {
    const { data, columns, numberColumnIndex, visibleSeriesIndices, chartType } = this.props

    if (!data?.length) {
      return null
    }

    // Determine which series indices to use for calculation
    let seriesIndices = [numberColumnIndex] // Default to single series

    if (visibleSeriesIndices?.length > 0) {
      // Use visible series if available (for multi-series charts)
      seriesIndices = visibleSeriesIndices
    }

    // For stacked charts, calculate average of the sum of each stack
    if (chartType === 'stacked_column' || chartType === 'stacked_bar') {
      const stackTotals = data
        .map((row) => {
          let stackSum = 0
          seriesIndices.forEach((columnIndex) => {
            if (columns?.[columnIndex]) {
              const value = row[columnIndex]
              const numValue = typeof value === 'string' ? parseFloat(value) : value
              if (!isNaN(numValue) && numValue !== null && numValue !== undefined) {
                stackSum += numValue
              }
            }
          })
          return stackSum
        })
        .filter((sum) => sum !== 0) // Filter out rows with no valid data

      if (stackTotals.length === 0) {
        return null
      }

      return mean(stackTotals)
    }

    // For regular (non-stacked) charts, calculate average across all series values
    const allValues = []

    seriesIndices.forEach((columnIndex) => {
      if (columns?.[columnIndex]) {
        const columnValues = data
          .map((row) => {
            const value = row[columnIndex]
            // Convert to number, filtering out null/undefined/NaN
            const numValue = typeof value === 'string' ? parseFloat(value) : value
            return isNaN(numValue) ? null : numValue
          })
          .filter((value) => value !== null && value !== undefined)

        allValues.push(...columnValues)
      }
    })

    if (allValues.length === 0) {
      return null
    }

    return mean(allValues)
  }

  render = () => {
    const {
      yScale,
      width,
      height,
      isVisible,
      color,
      strokeWidth,
      strokeDasharray,
      dataFormatting,
      columns,
      numberColumnIndex,
    } = this.props

    if (!isVisible) {
      return null
    }

    const averageValue = this.calculateAverage()

    if (averageValue === null || averageValue === undefined) {
      return null
    }

    // Format the average value with proper units
    const formattedAverage = formatElement({
      element: averageValue,
      column: columns[numberColumnIndex],
      config: dataFormatting,
    })

    // Convert the average value to y-coordinate using the scale
    const yPosition = yScale(averageValue)

    // Check if the yPosition is valid and within chart bounds
    if (isNaN(yPosition) || yPosition < 0 || yPosition > height) {
      return null
    }

    // Create tooltip content
    const tooltipContent = `Average: ${formattedAverage}`

    // Determine text position - if line is near the top, put text below
    const isNearTop = yPosition < 20
    const textY = isNearTop ? yPosition + 15 : yPosition - 5

    return (
      <g className='average-line-container'>
        {/* Invisible hover area with 5px buffer */}
        <line
          x1={0}
          y1={yPosition - 5}
          x2={width}
          y2={yPosition + 5}
          stroke='transparent'
          strokeWidth={10}
          className='average-line-hover-area'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
          style={{ cursor: 'default' }}
        />

        {/* Visible average line */}
        <line
          x1={0}
          y1={yPosition}
          x2={width}
          y2={yPosition}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className='average-line'
        />

        {/* Text label */}
        <text
          x={width - 10}
          y={textY}
          fontSize='11'
          fill='var(--react-autoql-text-color-primary)'
          stroke='var(--react-autoql-background-color)'
          strokeWidth='3'
          strokeLinejoin='round'
          strokeLinecap='round'
          textAnchor='end'
          className='average-line-label'
        >
          Avg: {formattedAverage}
        </text>
      </g>
    )
  }
}

export default AverageLine
