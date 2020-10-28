import React, { Component } from 'react'
import _get from 'lodash.get'

export default class Line extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey,
  }

  getKey = (d, i) => {
    const { labelValue } = this.props
    return `${d[labelValue]}-${d.cells[i].label}`
  }

  onDotClick = (d, i) => {
    const newActiveKey = this.getKey(d, i)
    this.props.onChartClick({
      activeKey: newActiveKey,
      drilldownData: d.cells[i].drilldownData,
    })

    this.setState({ activeKey: newActiveKey })
  }

  makeLines = () => {
    const { scales, data, labelValue } = this.props
    const { xScale, yScale } = scales

    const numberOfSeries = data[0].cells.length
    const allLines = []

    for (let series = 0; series < numberOfSeries; series++) {
      data.forEach((d, i) => {
        const d2 = data[i + 1]
        const xShift = xScale.bandwidth() / 2
        allLines.push(
          <line
            key={`line-${d[labelValue]}-${series}`}
            className="line"
            x1={xScale(d[labelValue]) + xShift}
            y1={yScale(d.cells[series].value)}
            x2={
              d2
                ? xScale(d2[labelValue]) + xShift
                : xScale(d[labelValue]) + xShift
            }
            y2={
              d2
                ? yScale(d2.cells[series].value)
                : yScale(d.cells[series].value)
            }
            stroke={d.cells[series].color}
            opacity={0.7}
          />
        )
      })
    }

    return allLines
  }

  makeDots = () => {
    const { scales, data, labelValue } = this.props
    const { xScale, yScale } = scales

    const numberOfSeries = data[0].cells.length
    const allDots = []

    for (let series = 0; series < numberOfSeries; series++) {
      data.forEach((d) => {
        const xShift = xScale.bandwidth() / 2
        allDots.push(
          <circle
            key={this.getKey(d, series)}
            className={`line-dot${
              this.state.activeKey === this.getKey(d, series) ? ' active' : ''
            }`}
            cy={yScale(d.cells[series].value)}
            cx={xScale(d[labelValue]) + xShift}
            r={3}
            onClick={() => this.onDotClick(d, series)}
            data-tip={_get(d, `cells[${series}].tooltipData`)}
            data-for="chart-element-tooltip"
            style={{
              cursor: 'pointer',
              stroke: d.cells[series].color,
              strokeWidth: 2,
              strokeOpacity: 0.7,
              fillOpacity: 1,
              opacity: 0,
              fill:
                this.state.activeKey === this.getKey(d, series)
                  ? d.cells[series].color
                  : this.props.backgroundColor || '#fff',
            }}
            // onHover={{}}
          />
        )
      })
    }
    return allDots
  }

  render = () => {
    return (
      <g data-test="line">
        {this.makeLines()}
        {this.makeDots()}
      </g>
    )
  }
}
