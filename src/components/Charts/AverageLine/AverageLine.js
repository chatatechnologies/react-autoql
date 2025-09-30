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
    xScale: PropTypes.func.isRequired,
    yScale: PropTypes.func.isRequired,
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
    color: 'var(--react-autoql-text-color-primary)',
    strokeWidth: 2,
    strokeDasharray: '5,5', // Dashed line
  }

  isBarChart = () => {
    const { chartType } = this.props
    return chartType === 'bar' || chartType === 'stacked_bar'
  }

  calculateAverage = () => {
    const { data, columns, numberColumnIndex, visibleSeriesIndices, chartType, numberColumnIndex2 } = this.props

    if (!data?.length) {
      return null
    }

    // For scatterplots, calculate average of Y-values (second number column)
    if (chartType === 'scatterplot') {
      console.log('🔍 SCATTERPLOT AVERAGE DEBUG:', {
        chartType,
        dataLength: data?.length,
        numberColumnIndex2,
        hasNumberColumnIndex2: numberColumnIndex2 !== undefined && numberColumnIndex2 !== null,
      })

      const yValues = data
        .map((row) => {
          const value = row[numberColumnIndex2] // Y-axis column for scatterplot
          const numValue = typeof value === 'string' ? parseFloat(value) : value
          return isNaN(numValue) ? null : numValue
        })
        .filter((value) => value !== null && value !== undefined)

      console.log('🔍 SCATTERPLOT AVERAGE DEBUG - yValues:', {
        yValuesLength: yValues.length,
        sampleValues: yValues.slice(0, 5),
      })

      if (yValues.length === 0) {
        console.log('🔍 SCATTERPLOT AVERAGE DEBUG - No valid Y values found')
        return null
      }

      const average = mean(yValues)
      console.log('🔍 SCATTERPLOT AVERAGE DEBUG - calculated average:', average)
      return average
    }

    // Determine which series indices to use for calculation
    let seriesIndices = [numberColumnIndex] // Default to single series

    if (visibleSeriesIndices?.length > 0) {
      // Use visible series if available (for multi-series charts)
      seriesIndices = visibleSeriesIndices
    }

    // For stacked charts, calculate average of the sum of each stack
    if (
      chartType === 'stacked_column' ||
      chartType === 'stacked_bar' ||
      chartType === 'stacked_area' ||
      chartType === 'stacked_line'
    ) {
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
      numberColumnIndex2,
      chartType,
    } = this.props

    console.log('🔍 AVERAGE LINE RENDER DEBUG:', {
      isVisible,
      chartType,
      hasYScale: !!yScale,
      hasWidth: !!width,
      hasHeight: !!height,
    })

    if (!isVisible) {
      console.log('🔍 AVERAGE LINE RENDER DEBUG - Not visible, returning null')
      return null
    }

    const averageValue = this.calculateAverage()

    console.log('🔍 AVERAGE LINE RENDER DEBUG - averageValue:', averageValue)

    if (averageValue === null || averageValue === undefined) {
      console.log('🔍 AVERAGE LINE RENDER DEBUG - No average value, returning null')
      return null
    }

    // For scatterplots, use the Y-column for formatting; for other charts, use the main number column
    const columnForFormatting = chartType === 'scatterplot' ? columns[numberColumnIndex2] : columns[numberColumnIndex]

    // Format the average value with proper units
    const formattedAverage = formatElement({
      element: averageValue,
      column: columnForFormatting,
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
      <g className='average-line-container' style={{ outline: 'none' }}>
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

        {/* Text background rectangle - properly positioned for right-aligned text */}
        <rect
          x={width - 10 - Math.max(70, formattedAverage.length * 8)}
          y={textY - 12}
          width={Math.max(70, formattedAverage.length * 8) + 8}
          height='16'
          fill='var(--react-autoql-background-color)'
          fillOpacity='0.85'
          stroke={color}
          strokeWidth='1'
          rx='3'
          className='average-line-text-bg'
        />

        {/* Text label */}
        <text
          x={width - 10}
          y={textY}
          fontSize='11'
          fontWeight='bold'
          fill={color}
          stroke='var(--react-autoql-background-color)'
          strokeWidth='3'
          strokeLinejoin='round'
          strokeLinecap='round'
          textAnchor='end'
          className='average-line-label'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
        >
          Avg: {formattedAverage}
        </text>
      </g>
    )
  }
}

export default AverageLine
