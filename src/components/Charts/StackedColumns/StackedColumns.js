import React, { Component } from 'react'
import _get from 'lodash.get'

export default class StackedColumns extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
  }

  getKey = (d, i) => {
    return `${d.label}-${d.cells[i].label}`
  }

  onColumnClick = (d, i) => {
    const newActiveKey = this.getKey(d, i)
    this.props.onChartClick({
      activeKey: newActiveKey,
      drilldownData: d.cells[i].drilldownData
    })

    this.setState({ activeKey: newActiveKey })
  }

  render = () => {
    const { scales, data } = this.props
    const { xScale, yScale } = scales

    const stackedColumns = data.map(d => {
      let runningPositiveSumObject = {}
      let runningNegativeSumObject = {}

      return d.cells.map((cell, i) => {
        const valueNumber = Number(cell.value)
        const value = !Number.isNaN(valueNumber) ? valueNumber : 0

        let y
        let height
        if (value >= 0) {
          const previousSum = runningPositiveSumObject[d.label] || 0
          const nextSum = previousSum + value
          runningPositiveSumObject[d.label] = nextSum

          height = Math.abs(yScale(value) - yScale(0)) - 0.5
          y = yScale(nextSum) + 0.5
        } else {
          const previousSum = runningNegativeSumObject[d.label] || 0
          const nextSum = previousSum + value
          runningNegativeSumObject[d.label] = nextSum

          height = Math.abs(yScale(value) - yScale(0)) - 0.5
          y = yScale(previousSum) + 0.5
        }

        return (
          <rect
            key={`${d.label}-${cell.label}`}
            className={`bar${
              this.state.activeKey === this.getKey(d, i) ? ' active' : ''
            }`}
            x={xScale(d.label)}
            y={y}
            width={xScale.bandwidth()}
            height={Math.abs(height)}
            onClick={() => this.onColumnClick(d, i)}
            data-tip={cell.tooltipData}
            data-for="chart-element-tooltip"
            style={{ fill: cell.color, fillOpacity: 0.7 }}
          />
        )
      })
    })

    return <g data-test="stacked-columns">{stackedColumns}</g>
  }
}
