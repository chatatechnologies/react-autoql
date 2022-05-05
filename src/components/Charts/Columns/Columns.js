import React, { Component } from 'react'
import _get from 'lodash.get'

export default class Columns extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey,
  }

  Y0 = () => {
    const minValue = this.props.scales.yScale.domain()[0]
    if (minValue > 0) {
      return this.props.scales.yScale(minValue)
    }
    return this.props.scales.yScale(0)
  }
  Y = (d, i) => this.props.scales.yScale(_get(d, `cells[${i}].value`))

  getKey = (d, i) => {
    const { labelValue } = this.props
    return `${d[labelValue]}-${d.cells[i].label}`
  }

  onColumnClick = (d, i) => {
    const newActiveKey = this.getKey(d, i)
    this.props.onChartClick({
      activeKey: newActiveKey,
      drilldownData: d.cells[i].drilldownData,
    })

    this.setState({ activeKey: newActiveKey })
  }

  render = () => {
    const { scales, labelValue } = this.props
    const { xScale } = scales

    const numberOfSeries = this.props.data[0].cells.length
    const barWidth = xScale.bandwidth() / numberOfSeries

    // Loop through each data value to make each series
    const allBars = []
    for (let i = 0; i < numberOfSeries; i++) {
      allBars.push(
        this.props.data.map((d) => {
          const x0 = xScale(d[labelValue])
          const dX = i * barWidth
          const finalBarXPosition = x0 + dX

          let height = Math.abs(this.Y(d, i) - this.Y0())
          if (Number.isNaN(height)) {
            height = 0
          }

          return (
            <rect
              key={d[labelValue]}
              className={`bar${
                this.state.activeKey === this.getKey(d, i) ? ' active' : ''
              }`}
              x={finalBarXPosition}
              y={d.cells[i].value < 0 ? this.Y0() : this.Y(d, i)}
              height={height}
              width={barWidth}
              onClick={() => this.onColumnClick(d, i)}
              data-tip={_get(d, `cells[${i}].tooltipData`)}
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
