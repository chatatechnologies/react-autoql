import React, { Component } from 'react'

export default class StackedColumns extends Component {
  static propTypes = {}

  state = {
    activeKey: null
  }

  render = () => {
    const { scales, data, labelValueX, labelValueY, dataValue } = this.props
    const { xScale, yScale } = scales

    let runningPositiveSumObject = {}
    let runningNegativeSumObject = {}
    const stackedColumns = data.map(d => {
      const value = d[dataValue]

      let y
      let height
      if (value >= 0) {
        const previousSum = runningPositiveSumObject[d[labelValueY]] || 0
        const nextSum = previousSum + value
        runningPositiveSumObject[d[labelValueY]] = nextSum

        height = Math.abs(yScale(value) - yScale(0)) - 0.5
        y = yScale(nextSum) + 0.5
      } else {
        const previousSum = runningNegativeSumObject[d[labelValueY]] || 0
        const nextSum = previousSum + value
        runningNegativeSumObject[d[labelValueY]] = nextSum

        height = Math.abs(yScale(value) - yScale(0)) - 0.5
        y = yScale(previousSum) + 0.5
      }

      return (
        <rect
          key={`${d[labelValueX]}-${d[labelValueY]}`}
          className={`stacked-bar${
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? ' active'
              : ''
          }`}
          x={xScale(d[labelValueY])}
          y={y}
          width={xScale.bandwidth()}
          height={height}
          onClick={() =>
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
          }
          onClick={() => {
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
            this.props.onChartClick(d[labelValueX], d[labelValueY])
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          style={
            this.props.legendScale
              ? {
                  fill: this.props.legendScale(d[labelValueX]),
                  fillOpacity: 0.7
                }
              : { fillOpacity: 0 }
          }
        />
      )
    })
    return (
      <g ref={ref => (this.stackedColumnsElement = ref)}>{stackedColumns}</g>
    )
  }
}
