import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

export default class Bars extends Component {
  static propTypes = {
    data: PropTypes.array.isRequired,
    scales: PropTypes.shape({}).isRequired,
    labelValue: PropTypes.string.isRequired,
    activeKey: PropTypes.string,
    onChartClick: PropTypes.func,
  }

  static defaultProps = {
    activeKey: undefined,
    onChartClick: () => {},
  }

  state = {
    activeKey: this.props.activeKey,
  }

  X0 = () => {
    const minValue = this.props.scales.xScale.domain()[0]
    if (minValue > 0) {
      return this.props.scales.xScale(minValue)
    }
    return this.props.scales.xScale(0)
  }
  X = (d, i) => this.props.scales.xScale(_get(d, `cells[${i}].value`))

  getKey = (d, i) => {
    const { labelValue } = this.props
    return `${d[labelValue]}-${d.cells[i].label}`
  }

  onBarClick = (d, i) => {
    const newActiveKey = this.getKey(d, i)
    this.props.onChartClick({
      activeKey: newActiveKey,
      drilldownData: d.cells[i].drilldownData,
    })

    this.setState({ activeKey: newActiveKey })
  }

  render = () => {
    const { scales, labelValue } = this.props
    const { yScale } = scales

    const numberOfSeries = this.props.data[0].cells.length
    const barHeight = yScale.bandwidth() / numberOfSeries

    // Loop through each data value to make each series
    const allBars = []
    for (let i = 0; i < numberOfSeries; i++) {
      allBars.push(
        this.props.data.map((d, index) => {
          const y0 = yScale(d[labelValue])
          const dY = i * barHeight
          const finalBarYPosition = y0 + dY

          let width = Math.abs(this.X(d, i) - this.X0())
          if (Number.isNaN(width)) {
            width = 0
          }

          return (
            <rect
              key={d[labelValue]}
              className={`bar${
                this.state.activeKey === this.getKey(d, i) ? ' active' : ''
              }`}
              data-test={`bar-${i}-${index}`}
              y={finalBarYPosition}
              x={d.cells[i].value > 0 ? this.X0() : this.X(d, i)}
              width={width}
              height={barHeight}
              onClick={() => this.onBarClick(d, i)}
              data-tip={_get(d, `cells[${i}].tooltipData`)}
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
