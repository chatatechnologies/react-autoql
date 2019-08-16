import React, { Component } from 'react'

export default class Line extends Component {
  static propTypes = {}

  state = {
    activeKey: null
  }

  makeLines = () => {
    const { scales, data, labelValue, dataValue } = this.props
    const { xScale, yScale } = scales

    return data.map((d, i) => {
      const d2 = data[i + 1]
      const xShift = xScale.bandwidth() / 2
      return (
        <line
          key={d[labelValue]}
          className="line"
          x1={xScale(d[labelValue]) + xShift}
          y1={yScale(d[dataValue])}
          x2={
            d2
              ? xScale(d2[labelValue]) + xShift
              : xScale(d[labelValue]) + xShift
          }
          y2={d2 ? yScale(d2[dataValue]) : yScale(d[dataValue])}
          stroke="#28a8e0"
          opacity={0.7}
        />
      )
    })
  }

  makeDots = () => {
    const { scales, data, labelValue, dataValue } = this.props
    const { xScale, yScale } = scales

    return data.map(d => {
      const xShift = xScale.bandwidth() / 2
      return (
        <circle
          key={d[labelValue]}
          className={`line-dot${
            this.state.activeKey === d[labelValue] ? ' active' : ''
          }`}
          cy={yScale(d[dataValue])}
          cx={xScale(d[labelValue]) + xShift}
          stroke="transparent"
          strokeWidth={5}
          r={3}
          onClick={() => this.setState({ activeKey: d[labelValue] })}
          onClick={() => {
            this.setState({ activeKey: d[labelValue] })
            this.props.onChartClick(d.origRow, d.origColumns)
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          style={{
            stroke: 'transparent',
            strokeWidth: 10,
            fill: '#28a8e0',
            fillOpacity: 0.7
          }}
        />
      )
    })
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
