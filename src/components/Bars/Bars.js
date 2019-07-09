import React, { Component, Fragment } from 'react'

import ReactTooltip from 'react-tooltip'
// import { scaleLinear } from 'd3-scale'
// import { interpolateLab } from 'd3-interpolate'

export default class Bars extends Component {
  // colorScale = scaleLinear()
  //   .domain([0, this.props.maxValue])
  //   .range(['#F3E5F5', '#7B1FA2'])
  //   .interpolate(interpolateLab)

  state = {
    activeKey: null
  }

  Y0 = () => this.props.scales.yScale(0)
  Y = d => this.props.scales.yScale(d[this.props.dataValue])

  render() {
    const { scales, margins, data, height, labelValue, dataValue } = this.props
    const { xScale, yScale } = scales

    const bars = data.map(d => (
      <rect
        key={d[labelValue]}
        className={`bar${
          this.state.activeKey === d[labelValue] ? ' active' : ''
        }`}
        x={xScale(d[labelValue])}
        y={d[dataValue] < 0 ? this.Y0() : this.Y(d)}
        // height={height - margins.bottom - Math.abs(this.Y(d) - this.Y0())}
        height={Math.abs(this.Y(d) - this.Y0())}
        width={xScale.bandwidth()}
        onClick={() => this.setState({ activeKey: d[labelValue] })}
        onDoubleClick={() => {
          this.setState({ activeKey: d[labelValue] })
          this.props.onDoubleClick()
        }}
        data-tip={this.props.tooltipFormatter(d)}
        data-for="chart-element-tooltip"
        // fill={this.colorScale(datum.value)}
      />
    ))

    return <g>{bars}</g>
  }
}
