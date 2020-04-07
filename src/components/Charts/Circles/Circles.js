import React, { Component } from 'react'
import { scaleLinear } from 'd3-scale'

import { getDrilldownDataFrom3dChart } from '../helpers'

export default class Circles extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
  }

  render = () => {
    const { scales, data, labelValueX, labelValueY, dataValue } = this.props
    const { xScale, yScale } = scales

    const radiusScale = scaleLinear()
      .domain([0, this.props.maxValue])
      .range([0, 2 * Math.min(xScale.bandwidth(), yScale.bandwidth())])

    const squares = data.map(d => {
      return (
        <circle
          key={`${d[labelValueX]}-${d[labelValueY]}`}
          data-test="circles"
          className={`circle${
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? ' active'
              : ''
          }`}
          cx={xScale(d[labelValueX]) + xScale.bandwidth() / 2}
          cy={yScale(d[labelValueY]) + yScale.bandwidth() / 2}
          r={d[dataValue] < 0 ? 0 : radiusScale(d[dataValue])}
          onClick={() => {
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
            this.props.onChartClick({
              drilldownData: getDrilldownDataFrom3dChart({ d }),
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          style={{
            stroke: 'transparent',
            strokeWidth: 10,
            fill:
              this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
                ? this.props.chartColors[1]
                : this.props.chartColors[0],
            fillOpacity: 0.7
          }}
        />
      )
    })
    return <g>{squares}</g>
  }
}
