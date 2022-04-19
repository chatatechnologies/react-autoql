import React, { Component } from 'react'
import _get from 'lodash.get'

export default class StackedColumns extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey,
  }

  getKey = (d, i) => {
    return `${d.label}-${d.cells[i].label}`
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
    const { scales } = this.props
    const { xScale, yScale } = scales

    const stackedColumns = this.props.data.map((d) => {
      let runningPositiveSumObject = {}
      let runningNegativeSumObject = {}

      return d.cells.map((cell, i) => {
        const valueNumber = Number(cell.value)
        const value = !Number.isNaN(valueNumber) ? valueNumber : 0

        let x
        let width
        if (value >= 0) {
          const previousSum = runningPositiveSumObject[d.label] || 0
          const nextSum = previousSum + value
          runningPositiveSumObject[d.label] = nextSum

          width = Math.abs(xScale(value) - xScale(0) - 0.5)
          x = xScale(previousSum)
        } else {
          const previousSum = runningNegativeSumObject[d.label] || 0
          const nextSum = previousSum + value
          runningNegativeSumObject[d.label] = nextSum

          width = Math.abs(xScale(Math.abs(value)) - xScale(0) - 0.5)
          x = xScale(nextSum)
        }

        return (
          <rect
            key={`${d.label}-${cell.label}`}
            className={`column${
              this.state.activeKey === this.getKey(d, i) ? ' active' : ''
            }`}
            x={x}
            y={yScale(d.label)}
            width={width}
            height={yScale.bandwidth()}
            onClick={() => this.onColumnClick(d, i)}
            data-tip={cell.tooltipData}
            data-for="chart-element-tooltip"
            style={{ fill: cell.color, fillOpacity: 0.7 }}
          />
        )
      })
    })

    return <g data-test="stacked-bars">{stackedColumns}</g>
  }
}
