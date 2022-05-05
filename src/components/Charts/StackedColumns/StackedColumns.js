import React, { Component } from 'react'
import _get from 'lodash.get'

export default class StackedColumns extends Component {
  constructor(props) {
    super(props)

    this.state = {
      activeKey: this.props.activeKey,
    }
  }

  static propTypes = {}

  shouldComponentUpdate = (nextProps) => {
    if (this.props.activeKey !== nextProps.activeKey) {
      return true
    }

    if (this.props.data?.length !== nextProps.data?.length) {
      return true
    }

    if (
      this.props.xScale !== nextProps.xScale ||
      this.props.yScale !== nextProps.yScale
    ) {
      return true
    }

    return false
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
    return (
      <g data-test="stacked-columns">
        {this.props.data.map((d) => {
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

              height =
                Math.abs(this.props.yScale(value) - this.props.yScale(0)) - 0.5
              y = this.props.yScale(nextSum) + 0.5
            } else {
              const previousSum = runningNegativeSumObject[d.label] || 0
              const nextSum = previousSum + value
              runningNegativeSumObject[d.label] = nextSum

              height =
                Math.abs(this.props.yScale(value) - this.props.yScale(0)) - 0.5
              y = this.props.yScale(previousSum) + 0.5
            }

            return (
              <rect
                key={`${d.label}-${cell.label}`}
                className={`bar${
                  this.state.activeKey === this.getKey(d, i) ? ' active' : ''
                }`}
                x={this.props.xScale(d.label)}
                y={y}
                width={this.props?.xScale?.bandwidth()}
                height={Math.abs(height)}
                onClick={() => this.onColumnClick(d, i)}
                data-tip={cell.tooltipData}
                data-for="chart-element-tooltip"
                style={{ fill: cell.color, fillOpacity: 0.7 }}
              />
            )
          })
        })}
      </g>
    )
  }
}
