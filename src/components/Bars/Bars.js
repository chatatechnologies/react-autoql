import React, { Component } from 'react'
import { scaleOrdinal } from 'd3-scale'

export default class Bars extends Component {
  constructor(props) {
    super(props)
    const { chartColors } = props

    this.colorScale = scaleOrdinal().range(chartColors)
  }

  static propTypes = {}

  state = {
    activeKey: null
  }

  X0 = () => this.props.scales.xScale(0)
  X = (d, i) => this.props.scales.xScale(d[this.props.dataValues][i])

  render() {
    const { scales, margins, data, height, labelValue, dataValues } = this.props
    const { xScale, yScale } = scales

    const numberOfSeries = data[0][dataValues].length
    const barHeight = yScale.bandwidth() / numberOfSeries

    // Loop through each data value to make each series
    const allBars = []
    for (let i = 0; i < numberOfSeries; i++) {
      allBars.push(
        data.map(d => {
          // x0 - position of first bar
          // cX - adjustment for position of bar number 2+
          const y0 = yScale(d[labelValue])
          const dY = i * barHeight
          const finalBarYPosition = y0 + dY

          return (
            <rect
              key={d[labelValue]}
              className={`bar${
                this.state.activeKey === d[labelValue] ? ' active' : ''
              }`}
              y={finalBarYPosition}
              x={d[dataValues][i] > 0 ? this.X0() : this.X(d, i)}
              width={Math.abs(this.X(d, i) - this.X0())}
              height={barHeight}
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
