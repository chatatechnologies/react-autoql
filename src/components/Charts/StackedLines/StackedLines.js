import React, { Component } from 'react'
import _get from 'lodash.get'
import { chartElementDefaultProps, chartElementPropTypes, getTooltipContent, getKey } from '../helpers'

export default class StackedLines extends Component {
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

  createPolygonVertexDot = (d, i, x, y, colIndex, index) => {
    const tooltip = getTooltipContent({
      row: d,
      columns: this.props.columns,
      colIndex,
      stringColumnIndex: this.props.stringColumnIndex,
      legendColumn: this.props.legendColumn,
      dataFormatting: this.props.dataFormatting,
    })

    return (
      <circle
        key={`dot-${getKey(colIndex, index)}`}
        className={`vertex-dot${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
        cy={y}
        cx={x}
        r={4}
        onClick={() => this.onDotClick(d, colIndex, i)}
        data-tip={tooltip}
        data-for={this.props.tooltipID}
        style={{
          opacity: this.state.activeKey === getKey(colIndex, index) ? 1 : 0,
          cursor: 'pointer',
          stroke: this.props.colorScale(i),
          strokeWidth: 3,
          strokeOpacity: 0.7,
          fillOpacity: 1,
          fill: this.props.backgroundColor || '#fff',
        }}
      />
    )
  }

  createPolygon = (i, polygonVertices) => {
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
        data-tip={`
            <div>
              <strong>${this.props.legendTitle}</strong>: ${this.props.legendLabels[i].label}
            </div>
          `}
        data-for={this.props.tooltipID}
        data-effect='float'
        style={{
          fill: this.props.colorScale(i),
          fillOpacity: 0.7,
        }}
      />
    )
  }

  render = () => {
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
    if (minValue < 0) {minValue = 0}

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
            const polygonVertexDot = this.createPolygonVertexDot(d, i, x, y, colIndex, index)
            polygonVertexDots.push(polygonVertexDot)
          }
        })

        // Add polygon to list
        const reversedPrevVertices = prevPolygonVertices.reverse()
        const polygon = reversedPrevVertices.concat(currentPolygonVertices)
        polygons.push(this.createPolygon(i, polygon))

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
