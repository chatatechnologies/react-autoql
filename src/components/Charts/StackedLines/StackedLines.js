import React, { PureComponent } from 'react'
import { getAutoQLConfig, getKey, getTooltipContent, formatElement, getThemeValue, createSVGPath } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

// Module-level helpers (pure, no dependencies on instance)
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null
}

const parseRgb = (rgbStr) => {
  const match = rgbStr.match(/\d+/g)
  return match && match.length >= 3
    ? { r: parseInt(match[0], 10), g: parseInt(match[1], 10), b: parseInt(match[2], 10) }
    : null
}

const getLabelThemeColors = (backgroundColor) => {
  let rgb = hexToRgb(backgroundColor)
  if (!rgb && backgroundColor?.includes('rgb')) rgb = parseRgb(backgroundColor)
  rgb = rgb || { r: 255, g: 255, b: 255 }
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5
    ? { textFill: '#000', textStroke: '#fff' }
    : { textFill: '#fff', textStroke: '#000' }
}

const HOVER_LABEL_TEXT_STYLE = { fontWeight: 500 }

export default class StackedLines extends PureComponent {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
    hoveredPolygonIndex: null,
  }

  onDotClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)
    const { columns, stringColumnIndex, dataFormatting } = this.props

    // Create date drilldown filter if string axis is a DATE column
    const stringColumn = columns[stringColumnIndex]
    const filter = createDateDrilldownFilter({
      stringColumn,
      dateValue: row[stringColumnIndex],
      dataFormatting,
    })

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns,
      stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey: newActiveKey,
      filter, // Pass filter if date column, otherwise let QueryOutput construct it
    })

    this.setState({ activeKey: newActiveKey })
  }

  createPolygonVertexDot = (d, i, x, y, colIndex, index, color) => {
    const tooltip = getTooltipContent({
      row: d,
      columns: this.props.columns,
      colIndex,
      colIndex2: this.props.stringColumnIndex,
      legendColumn: this.props.legendColumn,
      dataFormatting: this.props.dataFormatting,
      aggregated: this.props.isAggregated,
    })

    return (
      <circle
        key={`dot-${getKey(colIndex, index)}`}
        className={`vertex-dot${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
        cy={y}
        cx={x}
        r={4}
        onClick={() => this.onDotClick(d, colIndex, i)}
        data-tooltip-html={tooltip}
        data-tooltip-id={this.props.chartTooltipID}
        style={{
          opacity: this.state.activeKey === getKey(colIndex, index) ? 1 : 0,
          cursor: getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? 'pointer' : 'default',
          stroke: color,
          strokeWidth: 3,
          strokeOpacity: 0.7,
          fill: this.props.backgroundColor || '#fff',
        }}
      />
    )
  }

  createPolygon = (i, polygonVertices, color, gradientId) => {
    const { stringColumnIndex } = this.props
    const polygonPoints = polygonVertices
      .map((xy) => {
        return xy.join(',')
      })
      .join(' ')

    return (
      <polygon
        key={`polygon-${getKey(stringColumnIndex, i)}`}
        className={`stacked-area${this.state.activeKey === getKey(stringColumnIndex, i) ? ' active' : ''}`}
        points={polygonPoints}
        data-tooltip-html={`
            <div>
              <strong>Field</strong>: ${this.props.legendLabels[i].label}
            </div>
          `}
        data-tooltip-id={this.props.chartTooltipID}
        data-effect='float'
        data-place='bottom'
        fill={gradientId ? `url(#${gradientId})` : color}
        onMouseEnter={() => this.setState({ hoveredPolygonIndex: i })}
        onMouseLeave={() => this.setState({ hoveredPolygonIndex: null })}
      />
    )
  }

  createHoverDot = (x, y, color, polygonIndex, vertexIndex) => {
    return (
      <circle
        key={`hover-dot-${polygonIndex}-${vertexIndex}`}
        cx={x}
        cy={y}
        r={2}
        style={{
          fill: color,
          fillOpacity: 0.8,
          stroke: this.props.backgroundColor || '#fff',
          strokeWidth: 1,
          opacity: this.state.hoveredPolygonIndex === polygonIndex ? 1 : 0,
          pointerEvents: 'none',
        }}
      />
    )
  }

  // Helper function to estimate text width
  estimateTextWidth = (text, fontSize = 12) => {
    // Rough estimate: average character width * character count + padding
    return text.length * (fontSize * 0.6) + 10
  }

  // Check if two labels overlap
  labelsOverlap = (label1, label2, minSpacing = 5) => {
    const x1 = label1.x
    const x2 = label2.x
    const width1 = label1.width
    const width2 = label2.width
    
    // Check if the bounding boxes overlap
    const left1 = x1 - width1 / 2
    const right1 = x1 + width1 / 2
    const left2 = x2 - width2 / 2
    const right2 = x2 + width2 / 2
    
    return !(right1 + minSpacing < left2 || right2 + minSpacing < left1)
  }

  createHoverLabel = (x, y, value, colIndex, polygonIndex, vertexIndex, color, xScale, yScale, width, height) => {
    const { columns, dataFormatting } = this.props
    const column = columns[colIndex]
    
    // Format the value
    const formattedValue = formatElement({
      element: value,
      column: column,
      config: dataFormatting,
    })

    const fontSize = 11
    const textWidth = this.estimateTextWidth(formattedValue, fontSize)
    const textHeight = fontSize
    const labelY = y - 8 // Position above the dot
    
    // Get chart bounds from scale ranges
    const xRange = xScale.range()
    const yRange = yScale.range()
    const chartLeft = Math.min(xRange[0], xRange[xRange.length - 1])
    const chartRight = Math.max(xRange[0], xRange[xRange.length - 1])
    const chartTop = Math.min(yRange[0], yRange[yRange.length - 1])
    const chartBottom = Math.max(yRange[0], yRange[yRange.length - 1])
    
    // Add padding to avoid overlapping with axis labels
    const paddingX = 10 // Horizontal padding from chart edges
    const paddingY = 15 // Vertical padding from chart edges (more space for axis labels)
    
    // Clamp X position to stay within chart bounds
    const labelLeft = x - textWidth / 2
    const labelRight = x + textWidth / 2
    let clampedX = x
    
    if (labelLeft < chartLeft + paddingX) {
      clampedX = chartLeft + paddingX + textWidth / 2
    } else if (labelRight > chartRight - paddingX) {
      clampedX = chartRight - paddingX - textWidth / 2
    }
    
    // Clamp Y position to stay within chart bounds
    let clampedY = labelY
    if (clampedY < chartTop + paddingY) {
      // If too close to top, position below the dot instead
      clampedY = y + 8 + textHeight
      // But make sure it's still within bounds
      if (clampedY > chartBottom - paddingY) {
        clampedY = chartBottom - paddingY - textHeight
      }
    } else if (clampedY + textHeight > chartBottom - paddingY) {
      clampedY = chartBottom - paddingY - textHeight
    }

    return {
      x: clampedX,
      y: clampedY,
      text: formattedValue,
      width: textWidth,
      polygonIndex,
      vertexIndex,
      originalY: y,
      color,
    }
  }

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const { columns, numberColumnIndices, stringColumnIndex, yScale, xScale, width, height } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    // Build gradient defs for each visible series (vertical, top-to-bottom depth effect)
    const gradientDefs = []
    const gradientIds = new Map()
    visibleSeries.forEach((colIndex) => {
      const color = this.props.colorScale(colIndex)
      const gradientId = `stacked-area-gradient-${colIndex}`
      gradientIds.set(colIndex, gradientId)
      gradientDefs.push(
        <linearGradient key={gradientId} id={gradientId} x1='0%' y1='0%' x2='0%' y2='100%'>
          <stop offset='0%' stopColor={color} stopOpacity='0.55' />
          <stop offset='50%' stopColor={color} stopOpacity='0.35' />
          <stop offset='100%' stopColor={color} stopOpacity='0.15' />
        </linearGradient>,
      )
    })

    const polygons = []
    const linePaths = [] // smooth stroke lines along top edge of each layer
    const polygonVertexDots = []
    const hoverDots = []
    const hoverLabelsData = [] // Store label data for overlap detection

    let minValue = yScale.domain()[0]
    if (minValue < 0) {
      minValue = 0
    }

    let prevValues = []
    let prevPolygonVertices = []
    xScale.domain().forEach((xLabel) => {
      prevValues.push(minValue)
      prevPolygonVertices.push([xScale(xLabel), yScale(minValue)])
    })

    // Track visible polygon index separately
    let visiblePolygonIndex = 0
    numberColumnIndices.forEach((colIndex, i) => {
      const currentValues = []
      const currentPolygonVertices = []
      if (!columns[colIndex].isSeriesHidden) {
        const color = this.props.colorScale(colIndex)
        const currentPolygonIdx = visiblePolygonIndex
        
        this.props.data.forEach((d, index) => {
          const rawValue = d[colIndex]
          const valueNumber = Number(rawValue)
          const value = isNaN(valueNumber) ? 0 : valueNumber

          const x = xScale(d[stringColumnIndex])
          const prevValue = prevValues[index]
          const currentValue = prevValue + value
          const y = yScale(currentValue)

          currentValues[index] = currentValue
          currentPolygonVertices.push([x, y])

          // Create original vertex dots (for click/active functionality)
          if (value !== 0) {
            const polygonVertexDot = this.createPolygonVertexDot(d, i, x, y, colIndex, index, color)
            polygonVertexDots.push(polygonVertexDot)
          }

          // Create small hover dots for all top vertices
          const hoverDot = this.createHoverDot(x, y, color, currentPolygonIdx, index)
          hoverDots.push(hoverDot)

          // Store label data for the hovered polygon
          // Use the individual series value (not cumulative) for the label
          if (this.state.hoveredPolygonIndex === currentPolygonIdx) {
            const labelData = this.createHoverLabel(x, y, value, colIndex, currentPolygonIdx, index, color, xScale, yScale, width, height)
            hoverLabelsData.push(labelData)
          }
        })

        const gradientId = gradientIds.get(colIndex)

        // Build smooth line path for the top edge
        const linePathD = createSVGPath(currentPolygonVertices, 0.2)
        if (linePathD) {
          // Area fill: same smooth top edge + smooth bottom edge (reversed prev layer)
          // Replace the leading "M" with "L" so we line-to the start of the reversed bottom edge
          const reversedPrevVertices = [...prevPolygonVertices].reverse()
          const reversedPrevPathD = createSVGPath(reversedPrevVertices, 0.2)
          const smoothBottomEdge = reversedPrevPathD ? reversedPrevPathD.replace(/^M/, 'L') : ''
          const smoothAreaPathD = `${linePathD} ${smoothBottomEdge} Z`

          polygons.push(
            <path
              key={`area-${getKey(stringColumnIndex, currentPolygonIdx)}`}
              className={`stacked-area${this.state.activeKey === getKey(stringColumnIndex, currentPolygonIdx) ? ' active' : ''}`}
              d={smoothAreaPathD}
              data-tooltip-html={`<div><strong>Field</strong>: ${this.props.legendLabels[currentPolygonIdx]?.label}</div>`}
              data-tooltip-id={this.props.chartTooltipID}
              data-effect='float'
              data-place='bottom'
              fill={gradientId ? `url(#${gradientId})` : color}
              onMouseEnter={() => this.setState({ hoveredPolygonIndex: currentPolygonIdx })}
              onMouseLeave={() => this.setState({ hoveredPolygonIndex: null })}
            />,
          )

          linePaths.push(
            <path
              key={`stacked-line-path-${colIndex}`}
              className='line'
              d={linePathD}
              fill='none'
              stroke={color}
              strokeWidth={2}
            />,
          )
        }

        prevValues = currentValues
        prevPolygonVertices = currentPolygonVertices
        visiblePolygonIndex++
      }
    })

    // Filter labels to remove overlaps and limit to 20
    const visibleLabels = []
    if (hoverLabelsData.length > 0 && hoverLabelsData.length <= 20) {
      // Sort labels by x position
      const sortedLabels = [...hoverLabelsData].sort((a, b) => a.x - b.x)
      
      // Filter out overlapping labels
      sortedLabels.forEach((label) => {
        const overlaps = visibleLabels.some((existingLabel) =>
          this.labelsOverlap(label, existingLabel)
        )
        if (!overlaps) {
          visibleLabels.push(label)
        }
      })
    }

    return (
      <g data-test='stacked-lines'>
        <defs>{gradientDefs}</defs>
        {polygons}
        {linePaths}
        {polygonVertexDots}
        <g className='stacked-area-hover-dots' style={{ pointerEvents: 'none' }}>
          {hoverDots}
        </g>
        {this.state.hoveredPolygonIndex !== null && visibleLabels.length > 0 && (
          <g className='stacked-area-hover-labels' style={{ pointerEvents: 'none' }}>
            {visibleLabels.map((label) => {
              const backgroundColor = this.props.backgroundColor || getThemeValue('background-color-secondary') || '#fff'
              const { textFill, textStroke } = getLabelThemeColors(backgroundColor)

              return (
                <g key={`hover-label-${label.polygonIndex}-${label.vertexIndex}`}>
                  {/* Stroke pass — creates a readable halo on any background */}
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor='middle'
                    fontSize='11'
                    fill={textFill}
                    stroke={textStroke}
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    strokeLinejoin='round'
                    strokeLinecap='round'
                    paintOrder='stroke'
                    style={HOVER_LABEL_TEXT_STYLE}
                  >
                    {label.text}
                  </text>
                  {/* Fill pass — rendered on top for crisp edges */}
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor='middle'
                    fontSize='11'
                    fill={textFill}
                    style={HOVER_LABEL_TEXT_STYLE}
                  >
                    {label.text}
                  </text>
                </g>
              )
            })}
          </g>
        )}
      </g>
    )
  }
}
