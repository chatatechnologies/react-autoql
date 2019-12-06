import React, { Component, Fragment } from 'react'

import { scaleLinear } from 'd3-scale'

import ReactTooltip from 'react-tooltip'

export default class Squares extends Component {
  constructor(props) {
    super(props)

    this.opacityScale = scaleLinear()
      .domain([0, this.props.maxValue])
      .range([0, 1])
  }

  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
  }

  getFillOpacity = value => {
    if (value >= 0) {
      return this.opacityScale(Math.abs(value))
    }
  }

  render() {
    const {
      scales,
      margins,
      data,
      height,
      labelValueX,
      labelValueY,
      dataValue
    } = this.props
    const { xScale, yScale } = scales

    const squares = data.map(d => {
      const fillColor =
        d[dataValue] >= 0 ? this.props.chartColors[0] : 'rgba(221, 106, 106)'
      const activeFillColor = this.props.chartColors[1]
      return (
        <rect
          key={`${d[labelValueX]}-${d[labelValueY]}`}
          className={`square${
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? ' active'
              : ''
          }`}
          x={xScale(d[labelValueX])}
          y={yScale(d[labelValueY])}
          width={xScale.bandwidth()}
          height={yScale.bandwidth()}
          onClick={() =>
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
          }
          onClick={() => {
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
            this.props.onChartClick({
              row: d[labelValueX],
              column: d[labelValueY],
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          stroke={activeFillColor}
          strokeWidth="2px"
          strokeOpacity={
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? 1
              : 0
          }
          // chosen color for positive values and red for negative values
          fill={
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? activeFillColor
              : fillColor
          }
          fillOpacity={
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? 1
              : this.opacityScale(Math.abs(d[dataValue]))
          }
        />
      )
    })
    return <g>{squares}</g>
  }
}
