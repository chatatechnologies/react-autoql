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
    numberColumnIndex2: PropTypes.number,
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

    console.log('🔍 AVERAGE CALCULATION DEBUG:', {
      chartType,
      dataLength: data?.length,
      numberColumnIndex,
      numberColumnIndex2,
      visibleSeriesIndices: visibleSeriesIndices?.length,
    })

    if (!data?.length) {
      console.log('🔍 AVERAGE CALCULATION DEBUG - No data, returning null')
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

    console.log('🔍 REGULAR CHART AVERAGE DEBUG:', {
      chartType,
      seriesIndices,
      allValuesLength: allValues.length,
      sampleValues: allValues.slice(0, 5),
    })

    if (allValues.length === 0) {
      console.log('🔍 REGULAR CHART AVERAGE DEBUG - No valid values, returning null')
      return null
    }

    const average = mean(allValues)
    console.log('🔍 REGULAR CHART AVERAGE DEBUG - calculated average:', average)
    return average
  }

  render = () => {
    const {
      xScale,
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
      hasXScale: !!xScale,
      hasYScale: !!yScale,
      hasWidth: !!width,
      hasHeight: !!height,
      numberColumnIndex,
      numberColumnIndex2,
      visibleSeriesIndices: this.props.visibleSeriesIndices?.length,
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

    // Convert the average value to coordinate using the correct scale
    // For bar charts, use xScale (horizontal axis); for column charts, use yScale (vertical axis)
    const position = this.isBarChart() ? xScale(averageValue) : yScale(averageValue)

    console.log('🔍 AVERAGE LINE POSITION DEBUG:', {
      averageValue,
      position,
      isNaN: isNaN(position),
      withinBounds: this.isBarChart() ? position >= 0 && position <= width : position >= 0 && position <= height,
      width,
      height,
      isBarChart: this.isBarChart(),
    })

    // Check if the position is valid and within chart bounds
    const maxBound = this.isBarChart() ? width : height
    if (isNaN(position) || position < 0 || position > maxBound) {
      console.log('🔍 AVERAGE LINE POSITION DEBUG - Position invalid, returning null')
      return null
    }

    // Create tooltip content
    const tooltipContent = `Average: ${formattedAverage}`

    // Determine text position - different logic for bar charts vs column charts
    let textX, textY
    if (this.isBarChart()) {
      // For bar charts (vertical line), position text horizontally
      const isNearLeft = position < 50
      textX = isNearLeft ? position + 10 : position - 10
      textY = height / 2
    } else {
      // For column charts (horizontal line), position text vertically
      const isNearTop = position < 20
      textX = width - 10
      textY = isNearTop ? position + 15 : position - 5
    }

    const lineProps = {
      x1: this.isBarChart() ? position : 0,
      y1: this.isBarChart() ? 0 : position,
      x2: this.isBarChart() ? position : width,
      y2: this.isBarChart() ? height : position,
    }

    const hoverAreaProps = {
      x1: this.isBarChart() ? position - 5 : 0,
      y1: this.isBarChart() ? 0 : position - 5,
      x2: this.isBarChart() ? position + 5 : width,
      y2: this.isBarChart() ? height : position + 5,
    }

    console.log('🔍 AVERAGE LINE RENDERING DEBUG:', {
      isBarChart: this.isBarChart(),
      lineProps,
      hoverAreaProps,
      color,
      strokeWidth,
      strokeDasharray,
    })

    return (
      <g className='average-line-container' style={{ outline: 'none' }}>
        {/* Invisible hover area with 5px buffer */}
        <line
          {...hoverAreaProps}
          stroke='transparent'
          strokeWidth={10}
          className='average-line-hover-area'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
          style={{ cursor: 'default' }}
        />

        {/* Visible average line */}
        <line
          {...lineProps}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className='average-line'
        />

        {/* Text background rectangle - positioned based on chart type */}
        <rect
          x={
            this.isBarChart()
              ? textX - Math.max(35, formattedAverage.length * 4)
              : textX - Math.max(70, formattedAverage.length * 8)
          }
          y={textY - 12}
          width={
            this.isBarChart()
              ? Math.max(70, formattedAverage.length * 8)
              : Math.max(70, formattedAverage.length * 8) + 8
          }
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
          x={textX}
          y={textY}
          fontSize='11'
          fontWeight='bold'
          fill={color}
          stroke='var(--react-autoql-background-color)'
          strokeWidth='3'
          strokeLinejoin='round'
          strokeLinecap='round'
          textAnchor={this.isBarChart() ? 'middle' : 'end'}
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
