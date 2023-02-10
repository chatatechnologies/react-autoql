import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Line } from '../Line'

import { chartDefaultProps, chartPropTypes, getBandScale, getLinearScales, getTimeScale } from '../helpers.js'

export default class ChataLineChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length) {
      numberColumnIndices = props.visibleSeriesIndices
    }

    this.xScale = getTimeScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    const yScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      axis: 'y',
    })

    this.yScale = yScalesAndTicks.scale
    this.yTickValues = this.yScale.tickLabels
  }

  render = () => {
    this.setChartData(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-line-chart'
        transform={`translate(${this.props.deltaX}, ${this.props.deltaY})`}
      >
        {this.props.marginAdjustmentFinished && <Line {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          legendShape='line'
          dateColumnsOnly
          yGridLines
        />
      </g>
    )
  }
}
