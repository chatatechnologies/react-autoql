import React, { PureComponent } from 'react'
import { getAutoQLConfig, getKey, getTooltipContent } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class StackedLines extends PureComponent {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
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
        style={{ fill: color }}
      />
    )
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

    numberColumnIndices.forEach((colIndex, i) => {
      const currentValues = []
      const currentPolygonVertices = []
      if (!columns[colIndex].isSeriesHidden) {
        const color = this.props.colorScale(colIndex)
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

          if (value !== 0) {
            const polygonVertexDot = this.createPolygonVertexDot(d, i, x, y, colIndex, index, color)
            polygonVertexDots.push(polygonVertexDot)
          }
        })

        // Add polygon to list
        const reversedPrevVertices = prevPolygonVertices.reverse()
        const polygon = reversedPrevVertices.concat(currentPolygonVertices)
        polygons.push(this.createPolygon(i, polygon, color))

        prevValues = currentValues
        prevPolygonVertices = currentPolygonVertices
      }
    })

    return (
      <g data-test='stacked-lines'>
        {polygons}
        {polygonVertexDots}
      </g>
    )
  }
}
