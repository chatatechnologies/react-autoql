import React, { Component } from 'react'

export default class Line extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
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
      data.forEach(d => {
        const xShift = xScale.bandwidth() / 2
        allDots.push(
          <circle
            key={`line-dot-${d[labelValue]}-${series}`}
            className={`line-dot${
              this.state.activeKey === `line-dot-${d[labelValue]}-${series}`
                ? ' active'
                : ''
            }`}
            cy={yScale(d.cells[series].value)}
            cx={xScale(d[labelValue]) + xShift}
            r={3}
            onClick={() => {
              this.setState({
                activeKey: `line-dot-${d[labelValue]}-${series}`
              })
              this.props.onChartClick({
                row: d.origRow,
                activeKey: `line-dot-${d[labelValue]}-${series}`
              })
            }}
            data-tip={this.props.tooltipFormatter(d, series)}
            data-for="chart-element-tooltip"
            style={{
              cursor: 'pointer',
              stroke: d.cells[series].color,
              strokeWidth: 2,
              strokeOpacity: 0.7,
              fillOpacity: 1,
              fill:
                this.state.activeKey === `line-dot-${d[labelValue]}-${series}`
                  ? d.cells[series].color
                  : this.props.backgroundColor || '#fff'
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
      <g>
        {this.makeLines()}
        {this.makeDots()}
      </g>
    )
  }
}
