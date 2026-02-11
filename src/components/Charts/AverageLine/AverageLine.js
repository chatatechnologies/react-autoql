import React from 'react'
import PropTypes from 'prop-types'
import { mean } from 'd3-array'
import { DisplayTypes, formatElement, getChartColorVars, getThemeValue } from 'autoql-fe-utils'
import './AverageLine.scss'

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
    strokeWidth: PropTypes.number,
    strokeDasharray: PropTypes.string,
    chartTooltipID: PropTypes.string,
    chartType: PropTypes.string,
    numberColumnIndex2: PropTypes.number,
    colorScale: PropTypes.func,
  }

  static defaultProps = {
    dataFormatting: {},
    strokeWidth: 2,
    strokeDasharray: '5,5', // Dashed line
  }

  constructor(props) {
    super(props)
    this.textRef = React.createRef()
    this.state = {
      textBBox: null,
    }

    this.labelInlineStyles = {
      fontSize: '11px',
      fontWeight: 'bold',
      fill: 'currentColor',
      fontFamily: 'var(--react-autoql-font-family)',
    }
  }

  componentDidMount() {
    this.updateTextBBox()
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

  isBarChart = () => {
    const { chartType } = this.props
    return chartType === DisplayTypes.BAR || chartType === DisplayTypes.STACKED_BAR
  }

  calculateAverage = () => {
    const { data, columns, numberColumnIndex, visibleSeriesIndices, chartType, numberColumnIndex2 } = this.props

    if (!data?.length) {
      return null
    }

    // For scatterplots, calculate average of Y-values (second number column)
    if (chartType === DisplayTypes.SCATTERPLOT) {
      const yValues = data
        .map((row) => {
          const value = row[numberColumnIndex2] // Y-axis column for scatterplot
          const numValue = typeof value === 'string' ? parseFloat(value) : value
          return isNaN(numValue) ? null : numValue
        })
        .filter((value) => value !== null && value !== undefined)

      if (yValues.length === 0) {
        return null
      }

      return mean(yValues)
    }

    // Determine which series indices to use for calculation
    let seriesIndices = [numberColumnIndex] // Default to single series

    if (visibleSeriesIndices?.length > 0) {
      // Use visible series if available (for multi-series charts)
      seriesIndices = visibleSeriesIndices
    }

    // For stacked charts, calculate average of the sum of each stack
    if (chartType === 'stacked_column' || chartType === 'stacked_bar' || chartType === 'stacked_line') {
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

  calculateIndividualSeriesAverage = (columnIndex) => {
    const { data, columns, chartType, numberColumnIndex2 } = this.props

    if (!data?.length || !columns?.[columnIndex]) {
      return null
    }

    // For scatterplots, calculate average of Y-values (second number column)
    if (chartType === DisplayTypes.SCATTERPLOT) {
      const yValues = data
        .map((row) => {
          const value = row[numberColumnIndex2] // Y-axis column for scatterplot
          const numValue = typeof value === 'string' ? parseFloat(value) : value
          return isNaN(numValue) ? null : numValue
        })
        .filter((value) => value !== null && value !== undefined)

      if (yValues.length === 0) {
        return null
      }

      return mean(yValues)
    }

    // For regular charts, calculate average for this specific series
    const columnValues = data
      .map((row) => {
        const value = row[columnIndex]
        const numValue = typeof value === 'string' ? parseFloat(value) : value
        return isNaN(numValue) ? null : numValue
      })
      .filter((value) => value !== null && value !== undefined)

    if (columnValues.length === 0) {
      return null
    }

    return mean(columnValues)
  }

  renderIndividualAverageLines = () => {
    const {
      visibleSeriesIndices,
      columns,
      data,
      xScale,
      yScale,
      width,
      height,
      dataFormatting,
      numberColumnIndex,
      numberColumnIndex2,
      chartType,
      strokeWidth,
      strokeDasharray,
      chartTooltipID,
    } = this.props

    if (!visibleSeriesIndices?.length || visibleSeriesIndices.length <= 1) {
      return null
    }

    // Only show labels if there are 5 or fewer series to avoid clutter
    const shouldShowLabels = visibleSeriesIndices.length <= 5

    // Calculate dynamic font size based on number of series and chart size
    const getFontSize = () => {
      const baseFontSize = 11
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

    // First, collect all series data
    const seriesData = visibleSeriesIndices
      .map((columnIndex, seriesIndex) => {
        const averageValue = this.calculateIndividualSeriesAverage(columnIndex)

        if (averageValue === null || averageValue === undefined) {
          return null
        }

        // Get series color using the same logic as bars (colorScale with columnIndex)
        let seriesColor = '#666666' // Default fallback

        if (this.props.colorScale) {
          seriesColor = this.props.colorScale(columnIndex)
        } else {
          // Fallback to chart colors if colorScale is not available
          const { chartColors } = getChartColorVars()
          seriesColor = chartColors[seriesIndex % chartColors.length] || '#666666'
        }

        // For scatterplots, use the Y-column for formatting; for other charts, use the main number column
        const columnForFormatting =
          chartType === DisplayTypes.SCATTERPLOT ? columns[numberColumnIndex2] : columns[columnIndex]

        // Format the average value with proper units
        const formattedAverage = formatElement({
          element: averageValue,
          column: columnForFormatting,
          config: dataFormatting,
        })

        // Convert the average value to coordinate using the correct scale
        const position = this.isBarChart() ? xScale(averageValue) : yScale(averageValue)

        // Check if the position is valid and within chart bounds
        const maxBound = this.isBarChart() ? width : height
        if (isNaN(position) || position < 0 || position > maxBound) {
          return null
        }

        // Create tooltip content
        const tooltipContent = `Average (${
          columns[columnIndex]?.display_name || `Series ${seriesIndex + 1}`
        }): ${formattedAverage}`

        // Determine text position - different logic for bar charts vs column charts
        let textX, textY
        if (this.isBarChart()) {
          // For bar charts (vertical line), position text horizontally
          const isNearLeft = position < 50
          textX = isNearLeft ? position + 10 : position - 10
          // Spread labels vertically for multiple series
          const labelSpacing = Math.max(30, height / Math.max(2, visibleSeriesIndices.length))
          textY = 30 + seriesIndex * labelSpacing

          // Clamp Y position to stay within chart bounds
          textY = Math.max(20, Math.min(textY, height - 20))
        } else {
          // For column charts (horizontal line), position text vertically
          const isNearTop = position < 20
          // Spread labels horizontally for multiple series
          const labelSpacing = Math.max(80, width / Math.max(2, visibleSeriesIndices.length))
          textX = width - 10 - seriesIndex * labelSpacing
          textY = isNearTop ? position + 15 : position - 5

          // Clamp X position to stay within chart bounds
          textX = Math.max(50, Math.min(textX, width - 50))
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

        const { textBBox } = this.state
        const padding = 4 // Padding inside the rect around the text

        // Calculate rect dimensions based on text content
        // For multi-series, we can't rely on a single textBBox, so estimate based on text length
        const labelText = `Avg: ${formattedAverage}`
        const estimatedCharWidth = fontSize * 0.6 // Approximate character width for bold font
        const estimatedTextWidth = labelText.length * estimatedCharWidth

        let rectX, rectY, rectWidth, rectHeight

        // Use estimated dimensions based on text length and font size
        rectWidth = Math.max(estimatedTextWidth + padding * 4, 60) // Ensure minimum width
        rectHeight = fontSize + padding * 2

        // Text anchor is "middle" for bar charts, "end" for column charts
        if (this.isBarChart()) {
          // textAnchor="middle" - center the rect on textX
          rectX = textX - rectWidth / 2
        } else {
          // textAnchor="end" - align rect to end at textX
          rectX = textX - rectWidth + padding
        }

        // Y position: center the rect on textY
        rectY = textY - rectHeight / 2 - padding / 2

        // Clamp rectangle bounds to stay within chart area
        rectX = Math.max(5, Math.min(rectX, width - rectWidth - 5))
        rectY = Math.max(5, Math.min(rectY, height - rectHeight - 5))

        // Adjust text position to align with clamped rectangle
        if (this.isBarChart()) {
          // For bar charts, text is centered horizontally on the rectangle
          textX = rectX + rectWidth / 2
        } else {
          // For column charts, text is aligned to the end of the rectangle
          textX = rectX + rectWidth - padding
        }
        // Text Y position is vertically centered in the rectangle
        textY = rectY + rectHeight / 2 + fontSize * 0.35 // Adjust for baseline

        return {
          columnIndex,
          seriesIndex,
          seriesColor,
          formattedAverage,
          tooltipContent,
          textX,
          textY,
          lineProps,
          hoverAreaProps,
          rectX,
          rectY,
          rectWidth,
          rectHeight,
        }
      })
      .filter(Boolean) // Remove null entries

    // Collect labels during the first map iteration
    seriesData.forEach(
      ({
        columnIndex,
        seriesColor,
        formattedAverage,
        tooltipContent,
        textX,
        textY,
        rectX,
        rectY,
        rectWidth,
        rectHeight,
      }) => {
        if (shouldShowLabels) {
          labelElements.push(
            <g
              key={`avg-label-${columnIndex}`}
              className='individual-average-label-container'
              style={{ outline: 'none' }}
            >
              {/* Text background rectangle */}
              <rect
                x={rectX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                fillOpacity='0.85'
                stroke={seriesColor}
                strokeWidth='1'
                rx='3'
                className='average-line-text-bg'
                style={{
                  outline: 'none',
                  fill: getThemeValue('background-color-secondary'),
                }}
              />

              {/* Text label */}
              <text
                ref={this.textRef}
                x={textX}
                y={textY}
                strokeWidth={0}
                strokeLinejoin='round'
                strokeLinecap='round'
                textAnchor={this.isBarChart() ? 'middle' : 'end'}
                className='average-line-label'
                data-tooltip-content={tooltipContent}
                data-tooltip-id={chartTooltipID}
                style={{
                  ...this.labelInlineStyles,
                  fill: seriesColor,
                  outline: 'none',
                }}
              >
                Avg: {formattedAverage}
              </text>
            </g>,
          )
        }
      },
    )

    return (
      <g className='individual-average-lines-container' style={{ outline: 'none' }}>
        {/* First render all lines */}
        {seriesData.map(({ columnIndex, seriesColor, lineProps, hoverAreaProps, tooltipContent }) => (
          <g key={`avg-line-${columnIndex}`} className='individual-average-line-container' style={{ outline: 'none' }}>
            {/* Invisible hover area with 5px buffer */}
            <line
              {...hoverAreaProps}
              stroke='transparent'
              strokeWidth={10}
              className='average-line-hover-area'
              data-tooltip-content={tooltipContent}
              data-tooltip-id={chartTooltipID}
              style={{ cursor: 'default', outline: 'none' }}
            />

            {/* Visible average line */}
            <line
              {...lineProps}
              stroke={seriesColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              className='average-line'
              style={{ outline: 'none' }}
            />
          </g>
        ))}

        {/* Render all labels on top */}
        {labelElements}
      </g>
    )
  }

  render = () => {
    const {
      xScale,
      yScale,
      width,
      height,
      isVisible,
      strokeWidth,
      strokeDasharray,
      dataFormatting,
      columns,
      numberColumnIndex,
      numberColumnIndex2,
      chartType,
      visibleSeriesIndices,
    } = this.props

    if (!isVisible) {
      return null
    }

    // Check if we should render individual series averages or single average
    const isMultiSeries = visibleSeriesIndices?.length > 1
    const isStacked = chartType === 'stacked_column' || chartType === 'stacked_bar' || chartType === 'stacked_line'
    const isScatterplot = chartType === DisplayTypes.SCATTERPLOT

    // For scatterplots, always render a single average line
    // For multi-series non-stacked charts, render individual average lines
    if (isMultiSeries && !isStacked && !isScatterplot) {
      return this.renderIndividualAverageLines()
    }

    // Calculate dynamic font size for single series based on chart size
    const getSingleSeriesFontSize = () => {
      const baseFontSize = 11
      const chartArea = width * height
      const isSmallChart = chartArea < 200000 // Less than ~447x447 pixels

      return isSmallChart ? 10.5 : baseFontSize
    }

    const fontSize = getSingleSeriesFontSize()

    // Single series - render the traditional single average line
    const averageValue = this.calculateAverage()

    if (averageValue === null || averageValue === undefined) {
      return null
    }

    // For scatterplots, use the Y-column for formatting; for other charts, use the main number column
    const columnForFormatting =
      chartType === DisplayTypes.SCATTERPLOT ? columns[numberColumnIndex2] : columns[numberColumnIndex]

    // Format the average value with proper units
    const formattedAverage = formatElement({
      element: averageValue,
      column: columnForFormatting,
      config: dataFormatting,
      isChart: true,
    })

    // Convert the average value to coordinate using the correct scale
    // For bar charts, use xScale (horizontal axis); for column charts, use yScale (vertical axis)
    const position = this.isBarChart() ? xScale(averageValue) : yScale(averageValue)

    // Check if the position is valid and within chart bounds
    const maxBound = this.isBarChart() ? width : height
    if (isNaN(position) || position < 0 || position > maxBound) {
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

      // Clamp Y position to stay within chart bounds
      textY = Math.max(20, Math.min(textY, height - 20))
    } else {
      // For column charts (horizontal line), position text vertically
      const isNearTop = position < 20
      textX = width - 10
      textY = isNearTop ? position + 15 : position - 5

      // Clamp X position to stay within chart bounds
      textX = Math.max(50, Math.min(textX, width - 50))
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

    const { textBBox } = this.state
    const padding = 4 // Padding inside the rect around the text

    // Calculate rect dimensions based on text content
    const labelText = `Avg: ${formattedAverage}`
    const estimatedCharWidth = fontSize * 0.6 // Approximate character width for bold font
    const estimatedTextWidth = labelText.length * estimatedCharWidth

    let rectX, rectY, rectWidth, rectHeight

    // Use estimated dimensions based on text length and font size
    rectWidth = Math.max(estimatedTextWidth + padding * 4, 60) // Ensure minimum width
    rectHeight = fontSize + padding * 2

    // Text anchor is "middle" for bar charts, "end" for column charts
    if (this.isBarChart()) {
      // textAnchor="middle" - center the rect on textX
      rectX = textX - rectWidth / 2
    } else {
      // textAnchor="end" - align rect to end at textX
      rectX = textX - rectWidth + padding
    }

    // Y position: center the rect on textY
    rectY = textY - rectHeight / 2 - padding / 2

    // Clamp rectangle bounds to stay within chart area
    rectX = Math.max(5, Math.min(rectX, width - rectWidth - 5))
    rectY = Math.max(5, Math.min(rectY, height - rectHeight - 5))

    // Adjust text position to align with clamped rectangle
    if (this.isBarChart()) {
      // For bar charts, text is centered horizontally on the rectangle
      textX = rectX + rectWidth / 2
    } else {
      // For column charts, text is aligned to the end of the rectangle
      textX = rectX + rectWidth - padding
    }
    // Text Y position is vertically centered in the rectangle
    textY = rectY + rectHeight / 2 + fontSize * 0.35 // Adjust for baseline

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
          style={{ cursor: 'default', outline: 'none' }}
        />

        {/* Visible average line */}
        <line
          {...lineProps}
          stroke={this.labelInlineStyles.fill}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          className='average-line'
          style={{ outline: 'none' }}
        />

        {/* Text background rectangle - sized based on actual text bounding box */}
        <rect
          x={rectX}
          y={rectY}
          width={rectWidth}
          height={rectHeight}
          fillOpacity='0.85'
          stroke={this.labelInlineStyles.fill}
          strokeWidth='1'
          rx='3'
          className='average-line-text-bg'
          style={{
            outline: 'none',
            fill: getThemeValue('background-color-secondary'),
          }}
        />

        {/* Text label */}
        <text
          ref={this.textRef}
          x={textX}
          y={textY}
          strokeWidth={0}
          strokeLinejoin='round'
          strokeLinecap='round'
          textAnchor={this.isBarChart() ? 'middle' : 'end'}
          className='average-line-label'
          data-tooltip-content={tooltipContent}
          data-tooltip-id={this.props.chartTooltipID}
          style={this.labelInlineStyles}
        >
          Avg: {formattedAverage}
        </text>
      </g>
    )
  }
}

export default AverageLine
