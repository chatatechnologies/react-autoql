import React from 'react'
import PropTypes from 'prop-types'
import { formatElement } from 'autoql-fe-utils'

export class RegressionLine extends React.Component {
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
    color: '#4ecdc4',
    strokeWidth: 2,
    strokeDasharray: '0',
  }

  calculateLinearRegression = () => {
    const { data, columns, numberColumnIndex, visibleSeriesIndices, chartType } = this.props

    console.log('🔍 REGRESSION DEBUG - calculateLinearRegression called:', {
      dataLength: data?.length,
      chartType,
      numberColumnIndex,
      visibleSeriesIndices,
      columnsLength: columns?.length,
    })

    if (!data?.length) {
      console.log('🔍 REGRESSION DEBUG - No data, returning null')
      return null
    }

    // Determine which series indices to use for calculation
    let seriesIndices = [numberColumnIndex] // Default to single series

    if (visibleSeriesIndices?.length > 0) {
      // Use visible series if available (for multi-series charts)
      seriesIndices = visibleSeriesIndices
    }

    let points = []

    // Get the string column index for x-axis values
    const stringColumnIndex = this.props.stringColumnIndex || 0

    if (chartType === 'stacked_column' || chartType === 'stacked_bar') {
      // For stacked charts, use stack totals
      points = data
        .map((row, index) => {
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
          // Use the actual x-axis value (string) instead of index
          const xValue = row[stringColumnIndex]
          return { x: xValue, y: stackSum }
        })
        .filter((point) => point.y !== 0 && point.x !== null && point.x !== undefined) // Filter out rows with no valid data
    } else {
      // For regular charts, use individual series values
      points = []
      seriesIndices.forEach((columnIndex) => {
        if (columns?.[columnIndex]) {
          data.forEach((row, index) => {
            const value = row[columnIndex]
            const numValue = typeof value === 'string' ? parseFloat(value) : value
            if (!isNaN(numValue) && numValue !== null && numValue !== undefined) {
              // Use the actual x-axis value (string) instead of index
              const xValue = row[stringColumnIndex]
              if (xValue !== null && xValue !== undefined) {
                points.push({ x: xValue, y: numValue })
              }
            }
          })
        }
      })
    }

    console.log('🔍 REGRESSION DEBUG - Points calculated:', {
      pointsLength: points.length,
      firstFewPoints: points.slice(0, 3),
    })

    if (points.length < 2) {
      console.log('🔍 REGRESSION DEBUG - Not enough points for regression, returning null')
      return null
    }

    // Convert x-values to numeric positions for regression calculation
    // For categorical data, we'll use the position in the array as the numeric value
    const numericPoints = points.map((point, index) => ({
      x: index, // Use array position as numeric x
      y: point.y,
      originalX: point.x, // Keep original x-value for scale conversion
    }))

    // Calculate linear regression using least squares method
    const n = numericPoints.length
    const sumX = numericPoints.reduce((sum, point) => sum + point.x, 0)
    const sumY = numericPoints.reduce((sum, point) => sum + point.y, 0)
    const sumXY = numericPoints.reduce((sum, point) => sum + point.x * point.y, 0)
    const sumXX = numericPoints.reduce((sum, point) => sum + point.x * point.x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate R-squared for correlation strength
    const yMean = sumY / n
    const ssRes = numericPoints.reduce((sum, point) => {
      const predicted = slope * point.x + intercept
      return sum + Math.pow(point.y - predicted, 2)
    }, 0)
    const ssTot = numericPoints.reduce((sum, point) => sum + Math.pow(point.y - yMean, 2), 0)
    const rSquared = 1 - ssRes / ssTot

    return {
      slope,
      intercept,
      rSquared,
      startX: points[0].x, // Original x-value for first point
      endX: points[points.length - 1].x, // Original x-value for last point
      startY: intercept, // Y-value at x=0 (first position)
      endY: slope * (n - 1) + intercept, // Y-value at x=n-1 (last position)
    }
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
    } = this.props

    console.log('🔍 REGRESSION DEBUG - Render called:', {
      isVisible,
      hasXScale: !!xScale,
      hasYScale: !!yScale,
      width,
      height,
      dataLength: this.props.data?.length,
      columnsLength: columns?.length,
    })

    if (!isVisible) {
      console.log('🔍 REGRESSION DEBUG - Not visible, returning null')
      return null
    }

    const regression = this.calculateLinearRegression()
    console.log('🔍 REGRESSION DEBUG - Regression result:', regression)

    if (!regression) {
      console.log('🔍 REGRESSION DEBUG - No regression calculated, returning null')
      return null
    }

    // Convert regression points to SVG coordinates
    const startX = xScale(regression.startX)
    const endX = xScale(regression.endX)
    const startY = yScale(regression.startY)
    const endY = yScale(regression.endY)

    console.log('🔍 REGRESSION DEBUG - Scale conversions:', {
      startX,
      endX,
      startY,
      endY,
      chartWidth: width,
      chartHeight: height,
      regressionStartY: regression.startY,
      regressionEndY: regression.endY,
    })

    // Check if the line is within chart bounds
    if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
      console.log('🔍 REGRESSION DEBUG - NaN in scale conversion, returning null')
      return null
    }

    // Extend the regression line to the full chart width
    // Calculate the slope of the line in chart coordinates
    const chartSlope = (endY - startY) / (endX - startX)

    // Calculate extended endpoints at chart boundaries
    const extendedStartX = 0 // Left edge of chart
    const extendedEndX = width // Right edge of chart

    // Calculate corresponding Y values for the extended X positions
    const extendedStartY = startY - chartSlope * (startX - extendedStartX)
    const extendedEndY = endY + chartSlope * (extendedEndX - endX)

    console.log('🔍 REGRESSION DEBUG - Extended coordinates:', {
      originalStartX: startX,
      originalEndX: endX,
      extendedStartX,
      extendedEndX,
      originalStartY: startY,
      originalEndY: endY,
      extendedStartY,
      extendedEndY,
      chartSlope,
      regressionSlope: regression.slope,
      visualSlope: visualSlope,
      isSlopePositive: regression.slope > 0,
      isVisualSlopePositive: visualSlope > 0,
      isChartSlopePositive: chartSlope > 0,
      visualDirection: chartSlope > 0 ? 'down' : 'up', // In SVG, positive slope goes down
    })

    // Check if extended line is outside visible chart area
    const isOutsideChart =
      (extendedStartY < 0 && extendedEndY < 0) || (extendedStartY > height && extendedEndY > height)
    if (isOutsideChart) {
      console.log('🔍 REGRESSION DEBUG - Extended line outside chart bounds, returning null')
      return null
    }

    // Format the slope for display - use the visual slope (invert for intuitive display)
    const visualSlope = -regression.slope // Invert to match visual direction
    const formattedSlope = formatElement({
      element: visualSlope,
      column: columns[numberColumnIndex],
      config: dataFormatting,
    })

    // Format R-squared for display
    const rSquaredPercent = (regression.rSquared * 100).toFixed(1)

    // Create tooltip content
    const tooltipContent = `Trend: ${formattedSlope} per period (R² = ${rSquaredPercent}%)`

    // Position for trend label - use the middle of the extended line
    const midX = (extendedStartX + extendedEndX) / 2
    const midY = (extendedStartY + extendedEndY) / 2

    // Determine if text should go above or below the line
    // Use chartSlope for visual direction since SVG Y=0 is at top
    const isTrendUp = chartSlope < 0 // Negative slope = visually up in SVG
    const textY = isTrendUp ? midY - 10 : midY + 15

    return (
      <g className='regression-line-container'>
        {/* Invisible hover area with 5px buffer */}
        <line
          x1={Math.min(extendedStartX, extendedEndX)}
          y1={Math.min(extendedStartY, extendedEndY) - 5}
          x2={Math.max(extendedStartX, extendedEndX)}
          y2={Math.max(extendedStartY, extendedEndY) + 5}
          stroke='transparent'
          strokeWidth={10}
          className='regression-line-hover-area'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
          style={{ cursor: 'default' }}
        />

        {/* Visible regression line */}
        <line
          x1={extendedStartX}
          y1={extendedStartY}
          x2={extendedEndX}
          y2={extendedEndY}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className='regression-line'
        />

        {/* Text label */}
        <text
          x={midX}
          y={textY}
          fontSize='11'
          fontWeight='bold'
          fill='var(--react-autoql-text-color-primary)'
          stroke='var(--react-autoql-background-color)'
          strokeWidth='3'
          strokeLinejoin='round'
          strokeLinecap='round'
          textAnchor='middle'
          className='regression-line-label'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
        >
          {isTrendUp ? '↗' : '↘'} {formattedSlope}
        </text>
      </g>
    )
  }
}

export default RegressionLine
