import React, { Component, Fragment } from 'react'

import { scaleLinear } from 'd3-scale'

import ReactTooltip from 'react-tooltip'

export default class Squares extends Component {
  colorScalePositive = scaleLinear()
    .domain([0, this.props.maxValue])
    .range(['rgba(40,168,224,0)', 'rgba(40,168,224,1)'])
  colorScaleNegative = scaleLinear()
    .domain([0, this.props.maxValue])
    .range(['rgba(221, 106, 106,0)', 'rgba(221, 106, 106,1)'])

  static propTypes = {}

  state = {
    activeKey: null
  }

  getFillColor = value => {
    if (value >= 0) {
      return this.colorScalePositive(value)
    } else {
      return this.colorScaleNegative(Math.abs(value))
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
          onDoubleClick={() => {
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
            this.props.onDoubleClick(d.origRow, d.origColumns)
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          fill={this.getFillColor(d[dataValue])}
        />
      )
    })
    return <g>{squares}</g>
  }
}
