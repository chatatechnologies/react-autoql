import React, { Component } from 'react'

export default class StackedBars extends Component {
  static propTypes = {}

  state = {
    activeKey: this.props.activeKey
  }

  X0 = () => this.props.scales.xScale(0)
  X = d => this.props.scales.xScale(d[this.props.dataValue])

  render = () => {
    const {
      scales,
      margins,
      data,
      height,
      labelValueX,
      labelValueY,
      dataValue
    } = this.props
    const { xScale, yScale } = scales

    let runningPositiveSumObject = {}
    let runningNegativeSumObject = {}
    const stackedBars = data.map(d => {
      const value = d[dataValue]

      let x
      let width
      if (value >= 0) {
        const previousSum = runningPositiveSumObject[d[labelValueX]] || 0
        const nextSum = previousSum + value
        runningPositiveSumObject[d[labelValueX]] = nextSum

        width = Math.abs(xScale(value) - xScale(0) - 0.5)
        x = xScale(previousSum)
      } else {
        const previousSum = runningNegativeSumObject[d[labelValueX]] || 0
        const nextSum = previousSum + value
        runningNegativeSumObject[d[labelValueX]] = nextSum

        width = Math.abs(xScale(Math.abs(value)) - xScale(0) - 0.5)
        x = xScale(nextSum)
      }

      return (
        <rect
          key={`${d[labelValueX]}-${d[labelValueY]}`}
          className={`stacked-bar${
            this.state.activeKey === `${d[labelValueX]}-${d[labelValueY]}`
              ? ' active'
              : ''
          }`}
          x={x}
          y={yScale(d[labelValueX])}
          width={width}
          height={yScale.bandwidth()}
          onClick={() =>
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
          }
          onClick={() => {
            this.setState({
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
            this.props.onChartClick({
              row: d[labelValueX],
              column: d[labelValueY],
              activeKey: `${d[labelValueX]}-${d[labelValueY]}`
            })
          }}
          data-tip={this.props.tooltipFormatter(d)}
          data-for="chart-element-tooltip"
          style={
            this.props.legendScale
              ? {
                  fill: this.props.legendScale(d[labelValueY]),
                  fillOpacity: 0.7
                }
              : { fillOpacity: 0 }
          }
        />
      )
    })
    return <g ref={ref => (this.stackedBarsElement = ref)}>{stackedBars}</g>
  }
}
