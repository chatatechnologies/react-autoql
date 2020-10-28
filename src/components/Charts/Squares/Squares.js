import React, { Component } from 'react'
import { scaleLinear } from 'd3-scale'
import _get from 'lodash.get'

import { themeConfigType } from '../../../props/types'
import { themeConfigDefault } from '../../../props/defaults'

export default class Squares extends Component {
  constructor(props) {
    super(props)

    this.opacityScale = scaleLinear()
      .domain([0, this.props.maxValue])
      .range([0, 1])
  }

  static propTypes = {
    themeConfig: themeConfigType,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
  }

  state = {
    activeKey: this.props.activeKey,
  }

  render = () => {
    const { scales, data } = this.props
    const { xScale, yScale } = scales

    const squares = []

    data.forEach(d => {
      d.cells.forEach((cell, i) => {
        const fillColor =
          cell.value >= 0
            ? _get(this.props.themeConfig, 'chartColors[0]')
            : 'rgba(221, 106, 106)'
        const activeFillColor = _get(this.props.themeConfig, 'chartColors[1]')

        squares.push(
          <rect
            key={`${cell.label}-${d.label}`}
            data-test="squares"
            className={`square${
              this.state.activeKey === `${cell.label}-${d.label}`
                ? ' active'
                : ''
            }`}
            x={xScale(cell.label)}
            y={yScale(d.label)}
            width={xScale.bandwidth()}
            height={yScale.bandwidth()}
            onClick={() => {
              this.setState({
                activeKey: `${cell.label}-${d.label}`,
              })
              this.props.onChartClick({
                activeKey: `${cell.label}-${d.label}`,
                drilldownData: cell.drilldownData,
              })
            }}
            data-tip={cell.tooltipData}
            data-for="chart-element-tooltip"
            stroke={activeFillColor}
            strokeWidth="2px"
            strokeOpacity={
              this.state.activeKey === `${cell.label}-${d.label}` ? 1 : 0
            }
            // chosen color for positive values and red for negative values
            fill={
              this.state.activeKey === `${cell.label}-${d.label}`
                ? activeFillColor
                : fillColor
            }
            fillOpacity={
              this.state.activeKey === `${cell.label}-${d.label}`
                ? 1
                : this.opacityScale(Math.abs(cell.value))
            }
          />
        )
      })
    })
    return <g>{squares}</g>
  }
}
