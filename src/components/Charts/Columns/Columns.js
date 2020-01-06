import React, { Component } from 'react'
import _get from 'lodash.get'

export default class Columns extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
  }

  Y0 = () => this.props.scales.yScale(0)
  Y = (d, i) => this.props.scales.yScale(_get(d, `cells[${i}].value`))

  render = () => {
    const { scales, data, labelValue } = this.props
    const { xScale } = scales

    const numberOfSeries = data[0].cells.length
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
              y={d.cells[i].value < 0 ? this.Y0() : this.Y(d, i)}
              height={Math.abs(this.Y(d, i) - this.Y0())}
              width={barWidth}
              onClick={() => {
                this.setState({ activeKey: d[labelValue] })
                this.props.onChartClick({
                  row: d.origRow,
                  activeKey: d[labelValue]
                })
              }}
              data-tip={this.props.tooltipFormatter(d, i)}
              data-for="chart-element-tooltip"
              style={{ fill: d.cells[i].color, fillOpacity: 0.7 }}
            />
          )
        })
      )
    }

    return <g data-test="columns">{allBars}</g>
  }
}
