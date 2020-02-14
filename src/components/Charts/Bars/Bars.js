import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

export default class Bars extends Component {
  static propTypes = {
    data: PropTypes.shape([]).isRequired,
    scales: PropTypes.shape({}).isRequired,
    tooltipFormatter: PropTypes.func.isRequired,
    labelValue: PropTypes.string.isRequired
  }

  state = {
    activeKey: this.props.activeKey
  }

  X0 = () => {
    const minValue = this.props.scales.xScale.domain()[0]
    if (minValue > 0) {
      return this.props.scales.xScale(minValue)
    }
    return this.props.scales.xScale(0)
  }
  X = (d, i) => this.props.scales.xScale(_get(d, `cells[${i}].value`))

  render = () => {
    const { scales, data, labelValue } = this.props
    const { yScale } = scales

    const numberOfSeries = data[0].cells.length
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
              x={d.cells[i].value > 0 ? this.X0() : this.X(d, i)}
              width={Math.abs(this.X(d, i) - this.X0())}
              height={barHeight}
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

    return <g data-test="bars">{allBars}</g>
  }
}
