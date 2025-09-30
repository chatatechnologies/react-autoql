import React from 'react'
import PropTypes from 'prop-types'
import { formatElement, getChartColorVars } from 'autoql-fe-utils'

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
    colorScale: PropTypes.func,
  }

  static defaultProps = {
    dataFormatting: {},
    color: '#27ae60', // Default green, will be overridden dynamically
    strokeWidth: 2,
    strokeDasharray: '5,5', // Dashed line
  }

  isBarChart = () => {
    const { chartType } = this.props
    return chartType === 'bar' || chartType === 'stacked_bar'
  }

  isScatterplot = () => {
    const { chartType } = this.props
    return chartType === 'scatterplot'
  }

  calculateLinearRegression = () => {
    const { data, columns, numberColumnIndex, visibleSeriesIndices, chartType, numberColumnIndex2 } = this.props

    if (!data?.length) {
      return null
    }

    // For scatterplots, use X and Y number columns directly
    if (chartType === 'scatterplot') {
      console.log('🔍 SCATTERPLOT REGRESSION DEBUG:', {
        chartType,
        dataLength: data?.length,
        numberColumnIndex,
        numberColumnIndex2,
        hasNumberColumnIndex2: numberColumnIndex2 !== undefined && numberColumnIndex2 !== null,
      })

      const points = data
        .map((row) => {
          const xValue = row[numberColumnIndex] // X-axis column
          const yValue = row[numberColumnIndex2] // Y-axis column
          const numX = typeof xValue === 'string' ? parseFloat(xValue) : xValue
          const numY = typeof yValue === 'string' ? parseFloat(yValue) : yValue

          if (
            !isNaN(numX) &&
            !isNaN(numY) &&
            numX !== null &&
            numY !== null &&
            numX !== undefined &&
            numY !== undefined
          ) {
            return { x: numX, y: numY }
          }
          return null
        })
        .filter((point) => point !== null)

      console.log('🔍 SCATTERPLOT REGRESSION DEBUG - points:', {
        pointsLength: points.length,
        samplePoints: points.slice(0, 3),
      })

      if (points.length < 2) {
        console.log('🔍 SCATTERPLOT REGRESSION DEBUG - Not enough points for regression')
        return null
      }

      const regression = this.calculateRegressionFromPoints(points)
      console.log('🔍 SCATTERPLOT REGRESSION DEBUG - calculated regression:', regression)
      return regression
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

    // Check if this is a multi-series chart (multiple visible series)
    const isMultiSeries = seriesIndices.length > 1

    if (
      chartType === 'stacked_column' ||
      chartType === 'stacked_bar' ||
      chartType === 'stacked_area' ||
      chartType === 'stacked_line'
    ) {
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
    } else if (isMultiSeries) {
      // For multi-series charts, return null to disable combined trend line
      // Individual trend lines should be used instead
      return null
    } else {
      // For single series charts, use individual series values
      points = data
        .map((row, index) => {
          const value = row[numberColumnIndex]
          const numValue = typeof value === 'string' ? parseFloat(value) : value
          if (!isNaN(numValue) && numValue !== null && numValue !== undefined) {
            // Use the actual x-axis value (string) instead of index
            const xValue = row[stringColumnIndex]
            if (xValue !== null && xValue !== undefined) {
              return { x: xValue, y: numValue }
            }
          }
          return null
        })
        .filter((point) => point !== null) // Filter out null points
    }

    if (points.length < 2) {
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
    console.log('🔍 REGRESSION LINE RENDER DEBUG:', {
      isVisible: this.props.isVisible,
      chartType: this.props.chartType,
      visibleSeriesIndices: this.props.visibleSeriesIndices?.length,
    })

    if (!this.props.isVisible) {
      console.log('🔍 REGRESSION LINE RENDER DEBUG - Not visible, returning null')
      return null
    }

    const { chartType, visibleSeriesIndices } = this.props
    const isMultiSeries = visibleSeriesIndices?.length > 1
    const isStacked =
      chartType === 'stacked_column' ||
      chartType === 'stacked_bar' ||
      chartType === 'stacked_area' ||
      chartType === 'stacked_line'

    console.log('🔍 REGRESSION LINE RENDER DEBUG - Logic:', {
      isMultiSeries,
      isStacked,
      willUseCombined: isStacked || !isMultiSeries,
    })

    if (isStacked || !isMultiSeries) {
      // Use combined trend line for stacked charts or single series
      console.log('🔍 REGRESSION LINE RENDER DEBUG - Using combined trend line')
      return this.renderCombinedTrendLine()
    } else {
      // Use individual trend lines for regular multi-series charts
      console.log('🔍 REGRESSION LINE RENDER DEBUG - Using individual trend lines')
      return this.renderIndividualTrendLines()
    }
  }

  renderCombinedTrendLine = () => {
    const { xScale, yScale, width, height, strokeWidth, strokeDasharray, dataFormatting } = this.props

    const regression = this.calculateLinearRegression()

    if (!regression) {
      return null
    }

    // Convert regression points to SVG coordinates
    const startX = xScale(regression.startX)
    const endX = xScale(regression.endX)
    const startY = yScale(regression.startY)
    const endY = yScale(regression.endY)

    // Check for NaN values in scale conversion
    if (isNaN(startX) || isNaN(endX) || isNaN(startY) || isNaN(endY)) {
      return null
    }

    // Extend the regression line to the full chart width
    const chartSlope = (endY - startY) / (endX - startX)
    const extendedStartX = 0
    const extendedEndX = width
    const extendedStartY = startY - chartSlope * (startX - extendedStartX)
    const extendedEndY = endY + chartSlope * (extendedEndX - endX)

    // Determine if trend is up or down based on chart slope (visual coordinates)
    // chartSlope is calculated from actual SVG coordinates where Y increases downward
    const isTrendUp = chartSlope < 0 // Negative chart slope = visual up (Y decreases as X increases)

    // Calculate displayed slope value to match visual direction
    // If trend is up, show positive value; if down, show negative value
    const displayedSlope = isTrendUp ? Math.abs(regression.slope) : -Math.abs(regression.slope)

    // Determine trend color based on direction
    const trendColor = isTrendUp ? '#2ecc71' : '#e74c3c' // Light green for up, light red for down

    // Position text above or below the line based on available space
    const midX = this.isBarChart() ? (extendedStartY + extendedEndY) / 2 : width / 2
    const midY = this.isBarChart() ? height / 2 : (extendedStartY + extendedEndY) / 2
    const textY = this.isBarChart() ? (midY < 20 ? midY + 15 : midY - 5) : midY < 20 ? midY + 15 : midY - 5
    // For scatterplots, use Y-column for formatting; for other charts, use main number column
    const columnForFormatting = this.isScatterplot()
      ? this.props.columns[this.props.numberColumnIndex2]
      : this.props.columns[this.props.numberColumnIndex]

    const formattedSlope = formatElement({
      element: displayedSlope,
      column: columnForFormatting,
      config: dataFormatting,
    })

    // Create tooltip content with R-squared and per-period terminology
    const rSquaredFormatted = (regression.rSquared * 100).toFixed(1)
    const tooltipContent = `${isTrendUp ? 'Up' : 'Down'} ${formattedSlope} per period (R² = ${rSquaredFormatted}%)`

    return (
      <g className='regression-line-container' style={{ outline: 'none' }}>
        {/* Invisible hover area for easier tooltip triggering */}
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
          x1={this.isBarChart() ? extendedStartY : extendedStartX}
          y1={this.isBarChart() ? extendedStartX : extendedStartY}
          x2={this.isBarChart() ? extendedEndY : extendedEndX}
          y2={this.isBarChart() ? extendedEndX : extendedEndY}
          stroke={trendColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className='regression-line'
        />

        {/* Text background rectangle - dynamically sized */}
        <rect
          x={midX - Math.max(30, formattedSlope.length * 4)}
          y={textY - 12}
          width={Math.max(60, formattedSlope.length * 8)}
          height='16'
          fill='var(--react-autoql-background-color)'
          fillOpacity='0.85'
          stroke={trendColor}
          strokeWidth='1'
          rx='3'
          className='regression-line-text-bg'
        />

        {/* Text label */}
        <text
          x={midX}
          y={textY}
          fontSize='11'
          fontWeight='bold'
          fill={trendColor}
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

  renderIndividualTrendLines = () => {
    const {
      visibleSeriesIndices,
      columns,
      data,
      xScale,
      yScale,
      width,
      height,
      strokeWidth,
      strokeDasharray,
      dataFormatting,
      chartType,
    } = this.props

    // Skip individual trend lines for stacked charts - they should use combined trend line
    const isStacked =
      chartType === 'stacked_column' ||
      chartType === 'stacked_bar' ||
      chartType === 'stacked_area' ||
      chartType === 'stacked_line'
    if (isStacked) {
      return null
    }

    if (!visibleSeriesIndices?.length) {
      return null
    }

    const stringColumnIndex = this.props.stringColumnIndex || 0

    return (
      <g className='individual-regression-lines-container' style={{ outline: 'none' }}>
        {visibleSeriesIndices.map((columnIndex, seriesIndex) => {
          // Calculate regression for this individual series
          const points = data
            .map((row) => {
              const value = row[columnIndex]
              const numValue = typeof value === 'string' ? parseFloat(value) : value
              if (!isNaN(numValue) && numValue !== null && numValue !== undefined) {
                const xValue = row[stringColumnIndex]
                if (xValue !== null && xValue !== undefined) {
                  return { x: xValue, y: numValue }
                }
              }
              return null
            })
            .filter((point) => point !== null)

          if (points.length < 2) {
            return null
          }

          // Convert x-values to numeric positions for regression calculation
          const numericPoints = points.map((point, index) => ({
            x: index, // Use index for regression calculation
            y: point.y,
            originalX: point.x, // Keep original x-value for scale conversion
          }))

          // Calculate regression
          const regression = this.calculateRegressionFromPoints(numericPoints)

          if (!regression) {
            return null
          }

          // Convert regression points to SVG coordinates using original x-values
          const startX = xScale(points[0].x) // Use first data point's x-value
          const endX = xScale(points[points.length - 1].x) // Use last data point's x-value
          const startY = yScale(regression.startY)
          const endY = yScale(regression.endY)

          // Check for NaN values in scale conversion
          if (isNaN(startX) || isNaN(endX) || isNaN(startY) || isNaN(endY)) {
            return null
          }

          // Extend the line to the full chart width
          const chartSlope = (endY - startY) / (endX - startX)
          const extendedStartX = 0
          const extendedEndX = width
          const extendedStartY = startY - chartSlope * (startX - extendedStartX)
          const extendedEndY = endY + chartSlope * (extendedEndX - endX)

          // Determine if trend is up or down based on chart slope (visual coordinates)
          const isTrendUp = chartSlope < 0 // Negative chart slope = visual up (Y decreases as X increases)

          // Get series color using the same logic as bars (colorScale with columnIndex)
          let seriesColor = '#666666' // Default fallback

          if (this.props.colorScale) {
            seriesColor = this.props.colorScale(columnIndex)
          } else {
            // Fallback to chart colors if colorScale is not available
            const { chartColors } = getChartColorVars()
            seriesColor = chartColors[seriesIndex % chartColors.length] || '#666666'
          }

          const trendColor = seriesColor

          // Position text at fixed intervals along the chart width
          // Use a cleaner distribution that keeps labels at consistent distances from their lines
          const labelSpacing = Math.max(100, width / Math.max(2, visibleSeriesIndices.length))
          const textX = 50 + seriesIndex * labelSpacing

          // Ensure text doesn't go beyond chart bounds
          const clampedTextX = Math.min(textX, width - 50)

          // Calculate Y position on the actual regression line at textX
          const lineY = extendedStartY + chartSlope * (clampedTextX - extendedStartX)

          // Position text at a consistent distance above or below the line
          const textOffset = seriesIndex % 2 === 0 ? -20 : 20 // Consistent 20px offset
          const textY = lineY + textOffset

          // Calculate displayed slope value to match visual direction
          const displayedSlope = isTrendUp ? Math.abs(regression.slope) : -Math.abs(regression.slope)

          // For scatterplots, use Y-column for formatting; for other charts, use series column
          const columnForFormatting = this.isScatterplot()
            ? this.props.columns[this.props.numberColumnIndex2]
            : columns[columnIndex]

          // Format the slope value
          const formattedSlope = formatElement({
            element: displayedSlope,
            column: columnForFormatting,
            config: dataFormatting,
          })

          // Create tooltip content with R-squared and per-period terminology
          const seriesName = columns[columnIndex]?.name || `Series ${seriesIndex + 1}`
          const rSquaredFormatted = (regression.rSquared * 100).toFixed(1)
          const tooltipContent = `${seriesName}: ${
            isTrendUp ? 'Up' : 'Down'
          } ${formattedSlope} per period (R² = ${rSquaredFormatted}%)`

          // Only show labels if there are 5 or fewer series to avoid clutter
          const shouldShowLabels = visibleSeriesIndices.length <= 5

          return (
            <g key={`individual-trend-${columnIndex}`} className={`individual-regression-line series-${seriesIndex}`}>
              {/* Invisible hover area for easier tooltip triggering */}
              <line
                x1={this.isBarChart() ? extendedStartY : extendedStartX}
                y1={this.isBarChart() ? extendedStartX : extendedStartY}
                x2={this.isBarChart() ? extendedEndY : extendedEndX}
                y2={this.isBarChart() ? extendedEndX : extendedEndY}
                stroke='transparent'
                strokeWidth={10}
                className='regression-line-hover-area'
                data-tooltip-content={tooltipContent}
                data-tooltip-id={this.props.chartTooltipID}
                style={{ cursor: 'default' }}
              />

              {/* Visible regression line */}
              <line
                x1={this.isBarChart() ? extendedStartY : extendedStartX}
                y1={this.isBarChart() ? extendedStartX : extendedStartY}
                x2={this.isBarChart() ? extendedEndY : extendedEndX}
                y2={this.isBarChart() ? extendedEndX : extendedEndY}
                stroke={trendColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                className='regression-line'
              />

              {/* Only render text labels if there are 5 or fewer series */}
              {shouldShowLabels && (
                <>
                  {/* Text background rectangle - dynamically sized */}
                  <rect
                    x={clampedTextX - Math.max(30, formattedSlope.length * 4)}
                    y={textY - 12}
                    width={Math.max(60, formattedSlope.length * 8)}
                    height='16'
                    fill='var(--react-autoql-background-color)'
                    fillOpacity='0.85'
                    stroke={seriesColor}
                    strokeWidth='1'
                    rx='3'
                    className='regression-line-text-bg'
                  />

                  {/* Text label */}
                  <text
                    x={clampedTextX}
                    y={textY}
                    fontSize='10'
                    fontWeight='bold'
                    fill={seriesColor}
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
                </>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  calculateRegressionFromPoints = (points) => {
    const n = points.length
    if (n < 2) return null

    const sumX = points.reduce((sum, p) => sum + p.x, 0)
    const sumY = points.reduce((sum, p) => sum + p.y, 0)
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate R-squared
    const yMean = sumY / n
    const ssRes = points.reduce((sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2), 0)
    const ssTot = points.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0)
    const rSquared = 1 - ssRes / ssTot

    // Visual slope (inverted for display)
    const visualSlope = -slope
    const isTrendUp = slope < 0 // Negative mathematical slope = visual up

    // Use actual x-axis positions for rendering
    const startX = 0
    const endX = points.length - 1
    const startY = intercept
    const endY = slope * endX + intercept

    return {
      slope,
      intercept,
      rSquared,
      startX,
      endX,
      startY,
      endY,
      isTrendUp,
      visualSlope,
    }
  }

  getSeriesColor = (index) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22']
    return colors[index % colors.length]
  }

  lightenColor = (color, factor) => {
    // Simple color lightening
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.floor(255 * factor))
      const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.floor(255 * factor))
      const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.floor(255 * factor))
      return `rgb(${r}, ${g}, ${b})`
    }
    return color
  }

  darkenColor = (color, factor) => {
    // Simple color darkening
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.floor(255 * factor))
      const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.floor(255 * factor))
      const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.floor(255 * factor))
      return `rgb(${r}, ${g}, ${b})`
    }
    return color
  }
}

export default RegressionLine
