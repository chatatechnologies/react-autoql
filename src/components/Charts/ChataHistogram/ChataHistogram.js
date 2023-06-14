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

    this.minNumBuckets = 5
    this.maxNumBuckets = 20
    this.bucketStepSize = 1

    if (props.data.length < this.minNumBuckets) {
      this.minNumBuckets = 2
    }

    if (props.data.length < this.maxNumBuckets) {
      this.maxNumBuckets = props.data.length
    }

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

  getInitialNumberOfBuckets = () => {
    // Using Sturge's rule https://www.statisticshowto.com/choose-bin-sizes-statistics/
    const numBuckets = Math.round(1 + 3.322 * Math.log(this.props.data?.length))
    return numBuckets
  }

  roundUpToNearestMultiple = (value, multiple = 1) => {
    return Math.ceil(value / multiple) * multiple
  }

  roundDownToNearestMultiple = (value, multiple) => {
    return Math.floor(value / multiple) * multiple
  }

  getBinData = (newBucketSize) => {
    const minValue = min(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))
    const maxValue = max(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))

    this.bucketSize = newBucketSize
    this.maxBucketSize = Math.ceil((maxValue - minValue) / (this.minNumBuckets ?? 1))
    this.minBucketSize = Math.floor((maxValue - minValue) / (this.maxNumBuckets ?? 1))

    if (this.maxBucketSize - this.minBucketSize < 3) {
      this.bucketStepSize = 0.1
    } else if (this.maxBucketSize - this.minBucketSize < 6) {
      this.bucketStepSize = 0.5
    }

    if (!this.bucketSize) {
      const initialNumBuckets = this.getInitialNumberOfBuckets()
      this.bucketSize = Math.ceil((maxValue - minValue) / initialNumBuckets)
    }

    let bucketValue = this.roundDownToNearestMultiple(minValue, this.bucketSize)
    const bins = [bucketValue]
    while (bucketValue < maxValue) {
      bucketValue += this.bucketSize
      bins.push(bucketValue)
    }

    const binFn = bin()
      .value((d) => d[this.props.numberColumnIndex])
      .domain([bins.at(0), bins.at(-1)])
      .thresholds(bins)

    return { buckets: binFn(this.props.data), bins }
  }

  setChartData = (props) => {
    const uniqueNumberValues = props.data.map((d) => d[props.numberColumnIndex]).filter(onlyUnique).length
    this.maxNumBuckets = uniqueNumberValues < this.maxBucketSize ? uniqueNumberValues : this.maxBucketSize
    const { buckets, bins } = this.getBinData(this.props.bucketSize)
    this.buckets = buckets
    this.bins = bins

    this.xScale = getBinLinearScale({
      props,
      columnIndex: props.numberColumnIndex,
      axis: 'x',
      buckets: this.buckets,
      bins,
    })

    this.yScale = getHistogramScale({
      props,
      axis: 'y',
      buckets: this.buckets,
      columnIndex: props.numberColumnIndex,
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
              <HistogramColumns
                {...this.props}
                xScale={this.xScale}
                yScale={this.yScale}
                buckets={this.buckets}
                bins={this.bins}
              />
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
