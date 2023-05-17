import React, { Component } from 'react'
import { v4 as uuid } from 'uuid'
import { Axes } from '../Axes'
import { HistogramColumns } from '../HistogramColumns'

import { chartDefaultProps, chartPropTypes, getBinLinearScale, getHistogramScale } from '../helpers.js'
import { deepEqual } from '../../../js/Util'
import { HistogramDistributions } from '../HistogramDistributions'

export default class ChataHistogram extends Component {
  constructor(props) {
    super(props)

    this.DEFAULT_THRESHOLDS = 20

    this.state = {
      thresholds: this.DEFAULT_THRESHOLDS,
    }
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  setChartData = (props, thresholds) => {
    this.xScale = getBinLinearScale({
      props,
      columnIndex: props.numberColumnIndex,
      axis: 'x',
      thresholds: thresholds ?? this.state?.thresholds,
    })

    this.yScale = getHistogramScale({
      props,
      axis: 'y',
      buckets: this.xScale.buckets,
      columnIndex: props.numberColumnIndex,
      columns: props.columns,
    })
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g ref={(r) => (this.chartRef = r)} className='react-autoql-axes-chart' data-test='react-autoql-histogram-chart'>
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          chartRef={this.chartRef}
          xScale={this.xScale}
          yScale={this.yScale}
          linearAxis='y'
          yGridLines
        >
          {this.props.marginAdjustmentFinished && (
            <>
              <HistogramColumns {...this.props} xScale={this.xScale} yScale={this.yScale} />
              <HistogramDistributions {...this.props} xScale={this.xScale} yScale={this.yScale} />
            </>
          )}
        </Axes>
      </g>
    )
  }
}
