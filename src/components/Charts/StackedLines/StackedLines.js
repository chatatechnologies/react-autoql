import React, { Component } from 'react'
import _get from 'lodash.get'
import {
  chartElementDefaultProps,
  chartElementPropTypes,
  getTooltipContent,
  getKey,
} from '../helpers'

export default class StackedLines extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeKey,
  }

  onDotClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(this.KEY, rowIndex, colIndex)

    this.props.onChartClick(
      row,
      colIndex,
      this.props.columns,
      this.props.stringColumnIndex,
      this.props.legendColumn,
      this.props.numberColumnIndex
    )

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
        key={`dot-${getKey(this.KEY, index, i)}`}
        className={`vertex-dot${
          this.state.activeKey === getKey(this.KEY, index, i) ? ' active' : ''
        }`}
        cy={y}
        cx={x}
        r={4}
        onClick={() => this.onDotClick(d, colIndex, i)}
        data-tip={tooltip}
        data-for="chart-element-tooltip"
        style={{
          opacity: this.state.activeKey === getKey(this.KEY, index, i) ? 1 : 0,
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
        key={`polygon-${getKey(this.KEY, stringColumnIndex, i)}`}
        className={`bar${
          this.state.activeKey === this.props.data[0][stringColumnIndex]
            ? ' active'
            : ''
        }`}
        points={polygonPoints}
        data-tip={`
            <div>
              <strong>${this.props.legendTitle}</strong>: ${this.props.legendLabels[i].label}
            </div>
          `}
        data-for="chart-element-tooltip"
        data-effect="float"
        style={{
          fill: this.props.colorScale(i),
          fillOpacity: 1,
        }}
      />
    )
  }

  render = () => {
    const {
      columns,
      numberColumnIndices,
      stringColumnIndex,
      yScale,
      xScale,
    } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const polygons = []
    const polygonVertexDots = []

    let minValue = yScale.domain()[0]
    if (minValue < 0) minValue = 0

    let prevValues = []
    let prevPolygonVertices = []
    xScale.domain().forEach((xLabel) => {
      prevValues.push(minValue)
      prevPolygonVertices.push([xScale(xLabel), yScale(minValue)])
    })

    numberColumnIndices.forEach((colIndex, i) => {
      let currentValues = []
      let currentPolygonVertices = []
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
            const polygonVertexDot = this.createPolygonVertexDot(
              d,
              i,
              x,
              y,
              colIndex,
              index
            )
            polygonVertexDots.push(polygonVertexDot)
          }
        })

        // Add polygon to list
        const reversedPrevVertices = prevPolygonVertices.reverse()
        const polygon = reversedPrevVertices.concat(currentPolygonVertices)
        polygons.push(this.createPolygon(i, polygon))
      }

      prevValues = currentValues
      prevPolygonVertices = currentPolygonVertices
    })

    return (
      <g data-test="stacked-lines">
        {polygons}
        {polygonVertexDots}
      </g>
    )
  }
}
