import React, { Component } from 'react'
import _get from 'lodash.get'

export default class StackedLines extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
  }

  getKey = (d, i) => {
    return `${d.label}-${d.cells[i].label}`
  }

  onDotClick = (d, i) => {
    const newActiveKey = this.getKey(d, i)
    this.props.onChartClick({
      activeKey: newActiveKey,
      drilldownData: d.cells[i].drilldownData
    })

    this.setState({ activeKey: newActiveKey })
  }

  createPolygonVertexDot = (d, series, x, y) => {
    const cell = d.cells[series]

    return (
      <circle
        key={this.getKey(d, series)}
        className={`vertex-dot${
          this.state.activeKey === this.getKey(d, series) ? ' active' : ''
        }`}
        cy={y}
        cx={x}
        r={4}
        onClick={() => this.onDotClick(d, series)}
        data-tip={cell.tooltipData}
        data-for="chart-element-tooltip"
        style={{
          opacity: this.state.activeKey === this.getKey(d, series) ? 1 : 0,
          cursor: 'pointer',
          stroke: cell.color,
          strokeWidth: 3,
          strokeOpacity: 0.7,
          fillOpacity: 1,
          fill: this.props.backgroundColor || '#fff'
        }}
      />
    )
  }

  createPolygon = (data, series, polygonVertices) => {
    const polygonPoints = polygonVertices
      .map(xy => {
        return xy.join(',')
      })
      .join(' ')

    return (
      <polygon
        key={`${data[0].cells[series].label}`}
        className={`bar${
          this.state.activeKey === data[0].cells[series].label ? ' active' : ''
        }`}
        points={polygonPoints}
        data-tip={`
            <div>
              <strong>${this.props.legendTitle}</strong>: ${data[0].cells[series].label}
            </div>
          `}
        data-for="chart-element-tooltip"
        data-effect="float"
        style={{
          fill: data[0].cells[series].color,
          fillOpacity: 1
        }}
      />
    )
  }

  render = () => {
    const { scales, data } = this.props
    const { xScale, yScale } = scales

    const polygons = []
    const polygonVertexDots = []
    const numPolygons = data[0].cells.length

    const firstPoint = [xScale(data[0].label), yScale(this.props.minValue)]
    const lastPoint = [
      xScale(data[data.length - 1].label),
      yScale(this.props.minValue)
    ]

    let runningPositiveSumObject = {}
    let runningNegativeSumObject = {}

    for (let series = 0; series < numPolygons; series++) {
      // First point goes on (0,0)
      let polygonVertices = [firstPoint]

      data.forEach(d => {
        const cell = d.cells[series]
        const valueNumber = Number(cell.value)
        const value = !Number.isNaN(valueNumber) ? valueNumber : 0

        let y
        const x = xScale(d.label)
        if (value >= 0) {
          const previousSum = runningPositiveSumObject[d.label] || 0
          const nextSum = previousSum + value
          runningPositiveSumObject[d.label] = nextSum
          y = yScale(nextSum) + 0.5
        } else {
          const previousSum = runningNegativeSumObject[d.label] || 0
          const nextSum = previousSum + value
          runningNegativeSumObject[d.label] = nextSum
          y = yScale(previousSum) + 0.5
        }

        polygonVertices.push([x, y])

        if (cell.value !== 0) {
          const polygonVertexDot = this.createPolygonVertexDot(d, series, x, y)
          polygonVertexDots.push(polygonVertexDot)
        }
      })

      // Last points go on (max, 0) then back to the beginning (0,0)
      polygonVertices.push(lastPoint)
      polygonVertices.push(firstPoint) // this one might not be necessary

      // Add polygon to list
      polygons.push(this.createPolygon(data, series, polygonVertices))
    }

    // Reverse order so smallest areas are drawn on top
    polygons.reverse()

    return (
      <g data-test="stacked-lines">
        {polygons}
        {polygonVertexDots}
      </g>
    )
  }
}
