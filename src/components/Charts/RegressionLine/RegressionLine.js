import React from 'react'
import PropTypes from 'prop-types'
import { DisplayTypes, formatElement, getChartColorVars, getThemeValue } from 'autoql-fe-utils'

import './RegressionLine.scss'

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

  constructor(props) {
    super(props)
    this.textRef = React.createRef()
    this.individualTextRefs = {}
    this.state = {
      textBBox: null,
      individualTextBBoxes: {},
    }

    this.labelInlineStyles = {
      fontSize: '11px',
      fontWeight: 'bold',
      fill: 'currentColor',
      fontFamily: 'var(--react-autoql-font-family)',
    }

    this.individualLabelInlineStyles = {
      fontSize: '10px',
      fontWeight: 'bold',
      fill: 'currentColor',
      fontFamily: 'var(--react-autoql-font-family)',
    }
  }

  componentDidMount() {
    this.updateTextBBox()
    this.updateIndividualTextBBoxes()
  }

  componentDidUpdate(prevProps) {
    // Re-measure if data, formatting, or visibility changes
    if (
      prevProps.data !== this.props.data ||
      prevProps.dataFormatting !== this.props.dataFormatting ||
      prevProps.numberColumnIndex !== this.props.numberColumnIndex ||
      prevProps.visibleSeriesIndices !== this.props.visibleSeriesIndices ||
      prevProps.stringColumnIndex !== this.props.stringColumnIndex ||
      prevProps.columns !== this.props.columns ||
      prevProps.isVisible !== this.props.isVisible
    ) {
      // Use setTimeout to ensure DOM is updated before measuring
      setTimeout(() => {
        this.updateTextBBox()
        this.updateIndividualTextBBoxes()
      }, 0)
    }
  }

  updateTextBBox = () => {
    if (this.textRef.current) {
      try {
        const bbox = this.textRef.current.getBBox()
        this.setState({ textBBox: bbox })
      } catch (error) {
        // getBBox can fail in some browsers/contexts, fail silently
        console.warn('Failed to get text bounding box:', error)
      }
    }
  }

  updateIndividualTextBBoxes = () => {
    const bboxes = {}
    Object.keys(this.individualTextRefs).forEach((key) => {
      const ref = this.individualTextRefs[key]
      if (ref) {
        try {
          bboxes[key] = ref.getBBox()
        } catch (error) {
          console.warn(`Failed to get text bounding box for ${key}:`, error)
        }
      }
    })
    if (Object.keys(bboxes).length > 0) {
      this.setState({ individualTextBBoxes: bboxes })
    }
  }

  isBarChart = () => {
    const { chartType } = this.props
    return chartType === 'bar' || chartType === 'stacked_bar'
  }

  isScatterplot = () => {
    const { chartType } = this.props
    return chartType === DisplayTypes.SCATTERPLOT
  }

  calculateLinearRegression = () => {
    const { data, columns, numberColumnIndex, visibleSeriesIndices, chartType, numberColumnIndex2 } = this.props

    if (!data?.length) {
      return null
    }

    // For scatterplots, use X and Y number columns directly
    if (chartType === DisplayTypes.SCATTERPLOT) {
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

      if (points.length < 2) {
        return null
      }

      const regression = this.calculateRegressionFromPoints(points)
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

    if (chartType === 'stacked_column' || chartType === 'stacked_bar' || chartType === 'stacked_line') {
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
          const xValue = row[stringColumnIndex]

          if (!isNaN(numValue) && numValue !== null && numValue !== undefined) {
            // Use the actual x-axis value (string) instead of index
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

    const result = {
      slope,
      intercept,
      rSquared,
      startX: points[0].x, // Original x-value for first point
      endX: points[points.length - 1].x, // Original x-value for last point
      startY: intercept, // Y-value at x=0 (first position)
      endY: slope * (n - 1) + intercept, // Y-value at x=n-1 (last position)
    }

    return result
  }

  render = () => {
    if (!this.props.isVisible) {
      return null
    }

    const { chartType, visibleSeriesIndices } = this.props
    const isMultiSeries = visibleSeriesIndices?.length > 1
    const isStacked = chartType === 'stacked_column' || chartType === 'stacked_bar' || chartType === 'stacked_line'
    const isScatterplot = this.isScatterplot()

    // For scatterplots, stacked charts, or single series, use combined trend line
    // For multi-series non-stacked regular charts, use individual trend lines
    if (isScatterplot || isStacked || !isMultiSeries) {
      return this.renderCombinedTrendLine()
    } else {
      return this.renderIndividualTrendLines()
    }
  }

  renderCombinedTrendLine = () => {
    const { xScale, yScale, width, height, strokeWidth, strokeDasharray, dataFormatting, visibleSeriesIndices } =
      this.props

    const regression = this.calculateLinearRegression()

    if (!regression) {
      return null
    }

    // Calculate dynamic font size for combined trend line based on chart size
    const getCombinedFontSize = () => {
      const baseFontSize = 11
      const chartArea = width * height
      const isSmallChart = chartArea < 200000 // Less than ~447x447 pixels

      return isSmallChart ? 11 : baseFontSize
    }

    const fontSize = getCombinedFontSize()

    // Convert regression points to SVG coordinates
    // For bar charts, center the line through the middle of the bars
    // Use getValue method if available (for custom scales), otherwise use direct call
    let startX = xScale.getValue ? xScale.getValue(regression.startX) : xScale(regression.startX)
    let endX = xScale.getValue ? xScale.getValue(regression.endX) : xScale(regression.endX)

    // If this is a band scale (bar charts), add half bandwidth to center the line
    if (xScale.bandwidth && typeof xScale.bandwidth === 'function') {
      const bandwidth = xScale.bandwidth()
      startX += bandwidth / 2
      endX += bandwidth / 2
    }

    const startY = yScale.getValue ? yScale.getValue(regression.startY) : yScale(regression.startY)
    const endY = yScale.getValue ? yScale.getValue(regression.endY) : yScale(regression.endY)

    // Check for NaN values in scale conversion
    if (isNaN(startX) || isNaN(endX) || isNaN(startY) || isNaN(endY)) {
      return null
    }

    // Extend the regression line to the full chart width
    const chartSlope = (endY - startY) / (endX - startX)

    const extendedStartX = 0
    const extendedEndX = width

    // Calculate the extended Y coordinates
    const extendedStartY = startY - chartSlope * (startX - extendedStartX)
    const extendedEndY = endY + chartSlope * (extendedEndX - endX)

    // Get chart bounds from yScale range to clip the line
    const yScaleRange = yScale.range()
    const topBound = Math.min(yScaleRange[0], yScaleRange[1]) // Top of chart (smaller Y coordinate)
    const bottomBound = Math.max(yScaleRange[0], yScaleRange[1]) // Bottom of chart (larger Y coordinate)

    // Calculate where the line intersects the chart bounds to maintain correct slope
    let clippedStartX = extendedStartX
    let clippedStartY = extendedStartY
    let clippedEndX = extendedEndX
    let clippedEndY = extendedEndY

    // If the line goes outside bounds, find intersection points
    if (
      extendedStartY < topBound ||
      extendedStartY > bottomBound ||
      extendedEndY < topBound ||
      extendedEndY > bottomBound
    ) {
      // Calculate intersection with top and bottom bounds
      const intersectTopX =
        chartSlope !== 0 ? extendedStartX + (topBound - extendedStartY) / chartSlope : extendedStartX
      const intersectBottomX =
        chartSlope !== 0 ? extendedStartX + (bottomBound - extendedStartY) / chartSlope : extendedStartX

      // Determine which intersections are within the chart width
      const validIntersections = []
      if (intersectTopX >= 0 && intersectTopX <= width) {
        validIntersections.push({ x: intersectTopX, y: topBound })
      }
      if (intersectBottomX >= 0 && intersectBottomX <= width) {
        validIntersections.push({ x: intersectBottomX, y: bottomBound })
      }

      if (validIntersections.length >= 2) {
        // Line intersects both bounds within chart width
        clippedStartX = validIntersections[0].x
        clippedStartY = validIntersections[0].y
        clippedEndX = validIntersections[1].x
        clippedEndY = validIntersections[1].y
      } else if (validIntersections.length === 1) {
        // Line intersects one bound, use original endpoints if they're within bounds
        const intersection = validIntersections[0]
        if (extendedStartY >= topBound && extendedStartY <= bottomBound) {
          clippedStartX = extendedStartX
          clippedStartY = extendedStartY
          clippedEndX = intersection.x
          clippedEndY = intersection.y
        } else {
          clippedStartX = intersection.x
          clippedStartY = intersection.y
          clippedEndX = extendedEndX
          clippedEndY = extendedEndY
        }
      }
    }

    // Determine if trend is up or down based on chart slope (visual coordinates)
    // chartSlope is calculated from actual SVG coordinates where Y increases downward
    const isTrendUp = chartSlope < 0 // Negative chart slope = visual up (Y decreases as X increases)

    // Calculate displayed slope value to match visual direction
    // If trend is up, show positive value; if down, show negative value
    const displayedSlope = isTrendUp ? Math.abs(regression.slope) : -Math.abs(regression.slope)

    // Determine trend color based on direction
    const trendColor = isTrendUp ? '#2ecc71' : '#e74c3c' // Light green for up, light red for down

    // Position text above or below the line based on available space
    const midX = this.isBarChart() ? (clippedStartY + clippedEndY) / 2 : (clippedStartX + clippedEndX) / 2
    const midY = this.isBarChart() ? height / 2 : (clippedStartY + clippedEndY) / 2
    const textY = this.isBarChart() ? (midY < 20 ? midY + 15 : midY - 5) : midY < 20 ? midY + 15 : midY - 5

    // Clamp text position to stay within chart bounds
    const clampedMidX = Math.max(50, Math.min(midX, width - 50))
    const clampedTextY = Math.max(20, Math.min(textY, height - 20))
    // For scatterplots, use Y-column for formatting; for other charts, use main number column
    const columnForFormatting = this.isScatterplot()
      ? this.props.columns[this.props.numberColumnIndex2]
      : this.props.columns[this.props.numberColumnIndex]

    const formattedSlope = formatElement({
      element: displayedSlope,
      column: columnForFormatting,
      config: dataFormatting,
      isChart: true,
    })

    // Create tooltip content with R-squared and per-period terminology
    const rSquaredFormatted = (regression.rSquared * 100).toFixed(1)
    const tooltipContent = `${isTrendUp ? 'Up' : 'Down'} ${formattedSlope} per period (R² = ${rSquaredFormatted}%)`

    const { textBBox } = this.state
    const padding = 4

    // Calculate rect dimensions based on actual text bounding box if available
    let rectX, rectY, rectWidth, rectHeight
    if (textBBox) {
      // Use width and height from bbox, but calculate position based on text anchor
      rectWidth = textBBox.width + padding * 2
      rectHeight = textBBox.height + padding * 2

      // textAnchor="middle" - center the rect on clampedMidX
      rectX = clampedMidX - rectWidth / 2

      // Y position: text baseline is at clampedTextY
      // For typical fonts, about 75% of the height is above the baseline, 25% below (for descenders)
      rectY = clampedTextY - textBBox.height * 0.75 - padding
    } else {
      // Fallback to estimated dimensions if bbox not yet available
      rectX = clampedMidX - Math.max(30, formattedSlope.length * 4)
      rectY = clampedTextY - 12
      rectWidth = Math.max(60, formattedSlope.length * 8)
      rectHeight = 16
    }

    // Clamp rectangle bounds to stay within chart area
    rectX = Math.max(5, Math.min(rectX, width - rectWidth - 5))
    rectY = Math.max(5, Math.min(rectY, height - rectHeight - 5))

    return (
      <g className='regression-line-container' style={{ outline: 'none' }}>
        {/* Invisible hover area for easier tooltip triggering */}
        <line
          x1={this.isBarChart() ? clippedStartY : clippedStartX}
          y1={this.isBarChart() ? clippedStartX : clippedStartY}
          x2={this.isBarChart() ? clippedEndY : clippedEndX}
          y2={this.isBarChart() ? clippedEndX : clippedEndY}
          stroke='transparent'
          strokeWidth={10}
          className='regression-line-hover-area'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
          style={{ cursor: 'default', outline: 'none' }}
        />

        {/* Visible regression line */}
        <line
          x1={this.isBarChart() ? clippedStartY : clippedStartX}
          y1={this.isBarChart() ? clippedStartX : clippedStartY}
          x2={this.isBarChart() ? clippedEndY : clippedEndX}
          y2={this.isBarChart() ? clippedEndX : clippedEndY}
          stroke={trendColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className='regression-line'
          style={{ outline: 'none' }}
        />

        {/* Text background rectangle - sized based on actual text bounding box */}
        <rect
          x={rectX}
          y={rectY}
          width={rectWidth}
          height={rectHeight}
          fillOpacity='0.85'
          stroke={trendColor}
          strokeWidth='1'
          rx='3'
          className='regression-line-text-bg'
          style={{
            outline: 'none',
            fill: getThemeValue('background-color-secondary'),
          }}
        />

        {/* Text label */}
        <text
          ref={this.textRef}
          x={clampedMidX}
          y={clampedTextY}
          strokeWidth={0}
          strokeLinejoin='round'
          strokeLinecap='round'
          textAnchor='middle'
          className='regression-line-label'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
          style={{
            ...this.labelInlineStyles,
            outline: 'none',
            fill: trendColor,
            stroke: getThemeValue('background-color-secondary'),
          }}
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
    const isStacked = chartType === 'stacked_column' || chartType === 'stacked_bar' || chartType === 'stacked_line'
    if (isStacked) {
      return null
    }

    if (!visibleSeriesIndices?.length) {
      return null
    }

    const stringColumnIndex = this.props.stringColumnIndex || 0

    // Only show labels if there are 5 or fewer series to avoid clutter
    const shouldShowLabels = visibleSeriesIndices.length <= 5

    // Calculate dynamic font size based on number of series and chart size
    const getFontSize = () => {
      const baseFontSize = 10
      const seriesCount = visibleSeriesIndices.length

      // Consider chart size - smaller charts need smaller fonts
      const chartArea = width * height
      const isSmallChart = chartArea < 200000 // Less than ~447x447 pixels

      // Reduce font size for multiple series to prevent overlap (but keep minimum readable)
      if (seriesCount >= 4) {return isSmallChart ? 9 : 10}
      if (seriesCount >= 3) {return isSmallChart ? 10 : 11}
      if (seriesCount >= 2) {return isSmallChart ? 10.5 : 11}

      // Single series - still consider chart size
      return isSmallChart ? 10.5 : baseFontSize
    }

    const fontSize = getFontSize()

    // Collect all labels to render at the end
    const labelElements = []

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
          // For bar charts, center the line through the middle of the bars
          // Use getValue method if available (for custom scales), otherwise use direct call
          let startX = xScale.getValue ? xScale.getValue(points[0].x) : xScale(points[0].x) // Use first data point's x-value
          let endX = xScale.getValue
            ? xScale.getValue(points[points.length - 1].x)
            : xScale(points[points.length - 1].x) // Use last data point's x-value

          // If this is a band scale (bar charts), add half bandwidth to center the line
          if (xScale.bandwidth && typeof xScale.bandwidth === 'function') {
            const bandwidth = xScale.bandwidth()
            startX += bandwidth / 2
            endX += bandwidth / 2
          }

          const startY = yScale.getValue ? yScale.getValue(regression.startY) : yScale(regression.startY)
          const endY = yScale.getValue ? yScale.getValue(regression.endY) : yScale(regression.endY)

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

          // Get chart bounds from yScale range to clip the line
          const yScaleRange = yScale.range()
          const topBound = Math.min(yScaleRange[0], yScaleRange[1]) // Top of chart (smaller Y coordinate)
          const bottomBound = Math.max(yScaleRange[0], yScaleRange[1]) // Bottom of chart (larger Y coordinate)

          // Calculate where the line intersects the chart bounds to maintain correct slope
          let clippedStartX = extendedStartX
          let clippedStartY = extendedStartY
          let clippedEndX = extendedEndX
          let clippedEndY = extendedEndY

          // If the line goes outside bounds, find intersection points
          if (
            extendedStartY < topBound ||
            extendedStartY > bottomBound ||
            extendedEndY < topBound ||
            extendedEndY > bottomBound
          ) {
            // Calculate intersection with top and bottom bounds
            const intersectTopX =
              chartSlope !== 0 ? extendedStartX + (topBound - extendedStartY) / chartSlope : extendedStartX
            const intersectBottomX =
              chartSlope !== 0 ? extendedStartX + (bottomBound - extendedStartY) / chartSlope : extendedStartX

            // Determine which intersections are within the chart width
            const validIntersections = []
            if (intersectTopX >= 0 && intersectTopX <= width) {
              validIntersections.push({ x: intersectTopX, y: topBound })
            }
            if (intersectBottomX >= 0 && intersectBottomX <= width) {
              validIntersections.push({ x: intersectBottomX, y: bottomBound })
            }

            if (validIntersections.length >= 2) {
              // Line intersects both bounds within chart width
              clippedStartX = validIntersections[0].x
              clippedStartY = validIntersections[0].y
              clippedEndX = validIntersections[1].x
              clippedEndY = validIntersections[1].y
            } else if (validIntersections.length === 1) {
              // Line intersects one bound, use original endpoints if they're within bounds
              const intersection = validIntersections[0]
              if (extendedStartY >= topBound && extendedStartY <= bottomBound) {
                clippedStartX = extendedStartX
                clippedStartY = extendedStartY
                clippedEndX = intersection.x
                clippedEndY = intersection.y
              } else {
                clippedStartX = intersection.x
                clippedStartY = intersection.y
                clippedEndX = extendedEndX
                clippedEndY = extendedEndY
              }
            }
          }

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
          const lineY = clippedStartY + chartSlope * (clampedTextX - clippedStartX)

          // Position text at a consistent distance above or below the line
          const textOffset = seriesIndex % 2 === 0 ? -20 : 20 // Consistent 20px offset
          const textY = lineY + textOffset

          // Clamp Y position to stay within chart bounds
          const clampedTextY = Math.max(20, Math.min(textY, height - 20))

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
            isChart: true,
          })

          // Create tooltip content with R-squared and per-period terminology
          const seriesName = columns[columnIndex]?.display_name || `Series ${seriesIndex + 1}`
          const rSquaredFormatted = (regression.rSquared * 100).toFixed(1)
          const tooltipContent = `${seriesName}: ${
            isTrendUp ? 'Up' : 'Down'
          } ${formattedSlope} per period (R² = ${rSquaredFormatted}%)`

          // Only show labels if there are 5 or fewer series to avoid clutter
          const shouldShowLabels = visibleSeriesIndices.length <= 5

          // Get the bounding box for this specific series if available
          const refKey = `series-${columnIndex}`
          const textBBox = this.state.individualTextBBoxes[refKey]
          const padding = 4

          // Calculate rect dimensions based on actual text bounding box if available
          let rectX, rectY, rectWidth, rectHeight
          if (textBBox) {
            // Use width and height from bbox, but calculate position based on text anchor
            rectWidth = textBBox.width + padding * 2
            rectHeight = textBBox.height + padding * 2

            // textAnchor="middle" - center the rect on clampedTextX
            rectX = clampedTextX - rectWidth / 2

            // Y position: text baseline is at clampedTextY
            // For typical fonts, about 75% of the height is above the baseline, 25% below (for descenders)
            rectY = clampedTextY - textBBox.height * 0.75 - padding
          } else {
            // Fallback to estimated dimensions
            rectX = clampedTextX - Math.max(30, formattedSlope.length * 4)
            rectY = clampedTextY - 12
            rectWidth = Math.max(60, formattedSlope.length * 8)
            rectHeight = 16
          }

          // Clamp rectangle bounds to stay within chart area
          rectX = Math.max(5, Math.min(rectX, width - rectWidth - 5))
          rectY = Math.max(5, Math.min(rectY, height - rectHeight - 5))

          return (
            <g key={`individual-trend-${columnIndex}`} className={`individual-regression-line series-${seriesIndex}`}>
              {/* Invisible hover area for easier tooltip triggering */}
              <line
                x1={this.isBarChart() ? clippedStartY : clippedStartX}
                y1={this.isBarChart() ? clippedStartX : clippedStartY}
                x2={this.isBarChart() ? clippedEndY : clippedEndX}
                y2={this.isBarChart() ? clippedEndX : clippedEndY}
                stroke='transparent'
                strokeWidth={10}
                className='regression-line-hover-area'
                data-tooltip-content={tooltipContent}
                data-tooltip-id={this.props.chartTooltipID}
                style={{ cursor: 'default', outline: 'none' }}
              />

              {/* Visible regression line */}
              <line
                x1={this.isBarChart() ? clippedStartY : clippedStartX}
                y1={this.isBarChart() ? clippedStartX : clippedStartY}
                x2={this.isBarChart() ? clippedEndY : clippedEndX}
                y2={this.isBarChart() ? clippedEndX : clippedEndY}
                stroke={trendColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                className='regression-line'
                style={{ outline: 'none' }}
              />

              {/* Only render text labels if there are 5 or fewer series */}
              {shouldShowLabels && (
                <>
                  {/* Text background rectangle - sized based on actual text bounding box */}
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    fillOpacity='0.85'
                    stroke={seriesColor}
                    strokeWidth='1'
                    rx='3'
                    className='regression-line-text-bg'
                    style={{
                      outline: 'none',
                      fill: getThemeValue('background-color-secondary'),
                    }}
                  />

                  {/* Text label */}
                  <text
                    ref={(ref) => (this.individualTextRefs[refKey] = ref)}
                    x={clampedTextX}
                    y={clampedTextY}
                    strokeWidth={0}
                    strokeLinejoin='round'
                    strokeLinecap='round'
                    textAnchor='middle'
                    className='regression-line-label'
                    data-tooltip-content={tooltipContent}
                    data-tooltip-id={this.props.chartTooltipID}
                    style={{
                      ...this.individualLabelInlineStyles,
                      fill: seriesColor,
                    }}
                  >
                    {isTrendUp ? '↗' : '↘'} {formattedSlope}
                  </text>
                </>
              )}
            </g>
          )
        })}
        {/* Render all labels on top */}
        {labelElements}
      </g>
    )
  }

  calculateRegressionFromPoints = (points) => {
    const n = points.length
    if (n < 2) {return null}

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
