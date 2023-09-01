import React, { Component } from 'react'
import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'

import { chartPropTypes, chartDefaultProps } from '../helpers.js'
import { getBandScale, getLinearScales } from 'autoql-fe-utils'

export default class ChataStackedBarChart extends Component {
  constructor(props) {
    super(props)
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length) {
      numberColumnIndices = props.visibleSeriesIndices
    }

    this.yScale = getBandScale({
      ...props,
      columnIndex: props.stringColumnIndex,
      axis: 'y',
    })

    const xScalesAndTicks = getLinearScales({
      ...props,
      columnIndices1: numberColumnIndices,
      axis: 'x',
      stacked: true,
    })

    this.xScale = xScalesAndTicks.scale
    this.xTickValues = this.xScale.tickLabels
    this.xScale2 = xScalesAndTicks.scale2
    this.xTickValues2 = this.xScale2?.tickLabels
  }

  render = () => {
    this.setChartData(this.props)

    const xCol = this.props.columns[this.props.numberColumnIndex]
    const xCol2 = this.props.columns[this.props.numberColumnIndex2]

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-stacked-bar-chart'
      >
        <StackedBars {...this.props} xScale={this.xScale} yScale={this.yScale} />
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          xScale2={this.xScale2}
          yScale={this.yScale}
          xCol={xCol}
          xCol2={xCol2}
          yCol={this.props.columns[this.props.stringColumnIndex]}
          linearAxis='x'
        />
      </g>
    )
  }
}
