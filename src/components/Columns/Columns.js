import React, { Component } from 'react'

import { scaleOrdinal } from 'd3-scale'

export default class Columns extends Component {
  constructor(props) {
    super(props)
    const { chartColors } = props

    this.colorScale = scaleOrdinal().range(chartColors)
  }

  static propTypes = {}

  state = {
    activeKey: null
  }

  Y0 = () => this.props.scales.yScale(0)
  Y = (d, i) => this.props.scales.yScale(d[this.props.dataValues][i])

  render() {
    const { scales, margins, data, height, labelValue, dataValues } = this.props
    const { xScale, yScale } = scales

    const numberOfSeries = data[0][dataValues].length
    const barWidth = xScale.bandwidth() / numberOfSeries

    // Loop through each data value to make each series
    const allBars = []
    for (let i = 0; i < numberOfSeries; i++) {
      allBars.push(
        data.map(d => {
          // x0 - position of first bar
          // cX - adjustment for position of bar number 2+
          const x0 = xScale(d[labelValue])
          const dX = i * barWidth
          const finalBarXPosition = x0 + dX

          return (
            <rect
              key={d[labelValue]}
              className={`bar${
                this.state.activeKey === d[labelValue] ? ' active' : ''
              }`}
              x={finalBarXPosition}
              y={d[dataValues][i] < 0 ? this.Y0() : this.Y(d, i)}
              height={Math.abs(this.Y(d, i) - this.Y0())}
              width={barWidth}
              onClick={() => {
                this.setState({ activeKey: d[labelValue] })
                this.props.onChartClick(d.origRow)
              }}
              data-tip={this.props.tooltipFormatter(d, i)}
              data-for="chart-element-tooltip"
              style={{ fill: this.colorScale(i), fillOpacity: 0.7 }}
            />
          )
        })
      )
    }

    return <g>{allBars}</g>
  }
}
