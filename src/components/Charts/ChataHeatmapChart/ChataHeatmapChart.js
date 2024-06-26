import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Squares } from '../Squares'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers.js'
import { getBandScale } from 'autoql-fe-utils'

export default class ChataHeatmapChart extends Component {
  constructor(props) {
    super(props)
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  setChartData = (props) => {
    this.xScale = getBandScale({
      ...props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
      innerPadding: 0.01,
      outerPadding: 0,
    })

    this.yScale = getBandScale({
      ...props,
      column: props.legendColumn,
      domain: props.legendLabels.map((d) => d.label),
      axis: 'y',
      innerPadding: 0.01,
      outerPadding: 0,
    })
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart react-autoql-heatmap-chart'
        data-test='react-autoql-heatmap-chart'
      >
        {!this.props.hidden && <Squares {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={this.props.legendColumn}
        />
      </g>
    )
  }
}
