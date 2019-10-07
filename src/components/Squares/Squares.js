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
    activeKey: null
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
            this.props.onChartClick(d[labelValueX], d[labelValueY])
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          // chosen color for positive values and red for negative values
          fill={
            d[dataValue] >= 0
              ? this.props.chartColors[0]
              : 'rgba(221, 106, 106)'
          }
          fillOpacity={this.opacityScale(Math.abs(d[dataValue]))}
        />
      )
    })
    return <g>{squares}</g>
  }
}
