import React, { Component } from 'react'
import { Axes } from '../Axes'
import { HistogramColumns } from '../HistogramColumns'

import { chartDefaultProps, chartPropTypes, convertToNumber, getBinLinearScale, getHistogramScale } from '../helpers.js'
import { deepEqual, onlyUnique } from '../../../js/Util'
import { HistogramDistributions } from '../HistogramDistributions'
import { bin, max, min } from 'd3-array'

export default class ChataHistogram extends Component {
  constructor(props) {
    super(props)

    this.DEFAULT_THRESHOLDS = 20
    this.maxBuckets = 50

    this.state = {}
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  getMaxBuckets = () => {
    this.uniqueNumberValues < this.MAX_HISTOGRAM_COLUMNS ? this.uniqueNumberValues : this.MAX_HISTOGRAM_COLUMNS
  }

  onThresholdChange = (value, index) => {
    const newBuckets = this.getBuckets(value)
    if (newBuckets?.length !== this.buckets?.length) {
      this.props.onThresholdChange(value)
    }
  }

  getBuckets = (thresholds) => {
    const minValue = min(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))
    const maxValue = max(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))
    const domain = [minValue, maxValue]

    const binFn = bin()
      .value((d) => d[this.props.numberColumnIndex])
      .domain(domain)
      .thresholds(thresholds)

    return binFn(this.props.data)
  }

  setChartData = (props) => {
    const uniqueNumberValues = props.data.map((d) => d[props.numberColumnIndex]).filter(onlyUnique).length
    this.maxBuckets = uniqueNumberValues < this.maxBuckets ? uniqueNumberValues : this.maxBuckets
    this.buckets = this.getBuckets(this.props.thresholds)

    this.xScale = getBinLinearScale({
      props,
      columnIndex: props.numberColumnIndex,
      axis: 'x',
      buckets: this.buckets,
    })

    this.yScale = getHistogramScale({
      props,
      axis: 'y',
      buckets: this.buckets,
      columnIndex: props.numberColumnIndex,
      columns: props.columns,
      numTicks: this.yScale?.tickLabels,
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
              <HistogramColumns {...this.props} xScale={this.xScale} yScale={this.yScale} buckets={this.buckets} />
              <HistogramDistributions
                {...this.props}
                xScale={this.xScale}
                yScale={this.yScale}
                buckets={this.buckets}
              />
            </>
          )}
        </Axes>
      </g>
    )
  }
}
