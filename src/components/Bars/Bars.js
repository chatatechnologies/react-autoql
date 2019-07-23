import React, { Component, Fragment } from 'react'

import ReactTooltip from 'react-tooltip'
// import { scaleLinear } from 'd3-scale'
// import { interpolateLab } from 'd3-interpolate'

export default class Bars extends Component {
  // colorScale = scaleLinear()
  //   .domain([0, this.props.maxValue])
  //   .range(['#F3E5F5', '#7B1FA2'])
  //   .interpolate(interpolateLab)
  static propTypes = {}

  state = {
    activeKey: null
  }

  X0 = () => this.props.scales.xScale(0)
  X = d => this.props.scales.xScale(d[this.props.dataValue])

  render() {
    const { scales, margins, data, height, labelValue, dataValue } = this.props
    const { xScale, yScale } = scales

    const bars = data.map(d => {
      return (
        <rect
          key={d[labelValue]}
          className={`bar${
            this.state.activeKey === d[labelValue] ? ' active' : ''
          }`}
          y={yScale(d[labelValue])}
          x={d[dataValue] > 0 ? this.X0() : this.X(d)}
          width={Math.abs(this.X(d) - this.X0())}
          height={yScale.bandwidth()}
          onClick={() => this.setState({ activeKey: d[labelValue] })}
          onDoubleClick={() => {
            this.setState({ activeKey: d[labelValue] })
            this.props.onDoubleClick(d.origRow, d.origColumns)
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          // fill={this.colorScale(datum.value)}
        />
      )
    })

    return <g>{bars}</g>
  }
}
