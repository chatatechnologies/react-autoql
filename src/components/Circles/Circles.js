import React, { Component, Fragment } from 'react'

import { scaleLinear } from 'd3-scale'

export default class Squares extends Component {
  static propTypes = {}

  state = {
    activeKey: null
  }

  render() {
    const { scales, data, labelValueX, labelValueY, dataValue } = this.props
    const { xScale, yScale } = scales

    const radiusScale = scaleLinear()
      .domain([0, this.props.maxValue])
      .range([0, 2 * Math.min(xScale.bandwidth(), yScale.bandwidth())])

    const squares = data.map(d => {
      return (
        <circle
          key={`${d[labelValueX]}-${d[labelValueY]}`}
          className={`circle${
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? ' active'
              : ''
          }`}
          cx={xScale(d[labelValueX]) + xScale.bandwidth() / 2}
          cy={yScale(d[labelValueY]) + yScale.bandwidth() / 2}
          // width={xScale.bandwidth()}
          // height={yScale.bandwidth()}
          r={d[dataValue] < 0 ? 0 : radiusScale(d[dataValue])}
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
          style={{
            stroke: 'transparent',
            strokeWidth: 10,
            fill: '#28a8e0',
            fillOpacity: 0.7
          }}
        />
      )
    })
    return <g>{squares}</g>
  }
}
