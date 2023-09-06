import React, { Component } from 'react'
import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'

import { chartDefaultProps, chartPropTypes } from '../helpers.js'
import { getBandScale, getLinearScales } from 'autoql-fe-utils'

export default class ChataStackedColumnChart extends Component {
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

    this.xScale = getBandScale({
      ...props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    const yScales = getLinearScales({
      ...props,
      columnIndices1: numberColumnIndices,
      axis: 'y',
      stacked: true,
    })

    this.yScale = yScales.scale
  }

  render = () => {
    this.setChartData(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-stacked-column-chart'
      >
        <StackedColumns {...this.props} xScale={this.xScale} yScale={this.yScale} />
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          linearAxis='y'
          yGridLines
        />
      </g>
    )
  }
}
