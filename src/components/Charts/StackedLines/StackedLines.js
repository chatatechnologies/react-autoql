import React, { PureComponent } from 'react'
import { getAutoQLConfig, getKey, getTooltipContent, formatElement, getThemeValue } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class StackedLines extends PureComponent {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
    hoveredPolygonIndex: null,
  }

  onDotClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns: this.props.columns,
      stringColumnIndex: this.props.stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey: newActiveKey,
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

  createPolygon = (i, polygonVertices, color) => {
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
        style={{ fill: color }}
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

  createHoverLabel = (x, y, value, colIndex, polygonIndex, vertexIndex, color) => {
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
    const labelY = y - 8 // Position above the dot

    return {
      x,
      y: labelY,
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

    const { columns, numberColumnIndices, stringColumnIndex, yScale, xScale } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const polygons = []
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
          if (this.state.hoveredPolygonIndex === currentPolygonIdx) {
            const labelData = this.createHoverLabel(x, y, currentValue, colIndex, currentPolygonIdx, index, color)
            hoverLabelsData.push(labelData)
          }
        })

        // Add polygon to list
        const reversedPrevVertices = prevPolygonVertices.reverse()
        const polygon = reversedPrevVertices.concat(currentPolygonVertices)
        polygons.push(this.createPolygon(currentPolygonIdx, polygon, color))

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
        {polygons}
        {polygonVertexDots}
        <g className='stacked-area-hover-dots' style={{ pointerEvents: 'none' }}>
          {hoverDots}
        </g>
        {this.state.hoveredPolygonIndex !== null && visibleLabels.length > 0 && (
          <g className='stacked-area-hover-labels' style={{ pointerEvents: 'none' }}>
            {visibleLabels.map((label) => {
              // Get theme colors for text
              const tooltipText = getThemeValue('text-color-primary')
              const backgroundColor = this.props.backgroundColor || '#fff'
              
              return (
                <g key={`hover-label-${label.polygonIndex}-${label.vertexIndex}`}>
                  {/* Text with dark stroke for readability on any background */}
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor='middle'
                    fontSize='11'
                    fill='#fff'
                    stroke='#000'
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    strokeLinejoin='round'
                    strokeLinecap='round'
                    paintOrder='stroke'
                    style={{
                      opacity: 1,
                      fontWeight: 500,
                    }}
                  >
                    {label.text}
                  </text>
                  {/* Text on top (without stroke) */}
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor='middle'
                    fontSize='11'
                    fill='#fff'
                    style={{
                      opacity: 1,
                      fontWeight: 500,
                    }}
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
