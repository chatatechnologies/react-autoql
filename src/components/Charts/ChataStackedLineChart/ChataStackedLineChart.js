import React, { Component } from 'react'
import { Axes } from '../Axes'
import { StackedLines } from '../StackedLines'

import { chartDefaultProps, chartPropTypes, getBandScale, getLinearScales } from '../helpers.js'

export default class ChataStackedLineChart extends Component {
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

    this.xScale = getBandScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
      innerPadding: 1,
      outerPadding: 0,
    })

    const yScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      axis: 'y',
      stacked: true,
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
        data-test='react-autoql-stacked-line-chart'
        transform={`translate(${this.props.deltaX}, ${this.props.deltaY})`}
      >
        {this.props.marginAdjustmentFinished && (
          <StackedLines {...this.props} xScale={this.xScale} yScale={this.yScale} />
        )}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          leftAxisTitle={this.props.numberAxisTitle}
          bottomAxisTitle={this.props.stringAxisTitle}
          yGridLines
        />
      </g>
    )
  }
}
