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

    this.maxBuckets = 100

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

  getDomain = () => {
    const minValue = min(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))
    const maxValue = max(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))

    if (minValue === maxValue) {
      return [minValue * 0.5, maxValue * 1.5]
    }

    return [minValue, maxValue]
  }

  onThresholdChange = (value, index) => {
    const newBuckets = this.getBinData(value, this.domain)?.buckets
    const bucketsChanged = newBuckets?.length !== this.buckets?.length

    if (bucketsChanged) {
      this.thresholdChanged = true
      this.props.onThresholdChange(value)
    }
  }

  getBinData = (thresholds, domain) => {
    // TODO: make own function to get buckets based on bucket size instead of number of buckets

    const binSize = (domain[1] - domain[0]) / thresholds
    const bins = []
    for (let i = 0; i < thresholds; i++) {
      bins.push(domain[0] + i * binSize)
    }

    const binFn = bin()
      .value((d) => d[this.props.numberColumnIndex])
      .domain(domain)
      .thresholds(thresholds)
    // .thresholds(bins)

    return { buckets: binFn(this.props.data), bins }
  }

  setChartData = (props) => {
    this.domain = this.getDomain()
    const uniqueNumberValues = props.data.map((d) => d[props.numberColumnIndex]).filter(onlyUnique).length
    this.maxBuckets = uniqueNumberValues < this.maxBuckets ? uniqueNumberValues : this.maxBuckets
    const { buckets, bins } = this.getBinData(this.props.thresholds, this.domain)
    this.buckets = buckets

    this.xScale = getBinLinearScale({
      props,
      columnIndex: props.numberColumnIndex,
      axis: 'x',
      buckets: this.buckets,
      domain: this.domain,
      bins,
    })

    // if (this.thresholdChanged) {
    //   this.xScale.showLabelDecimals = true
    // }

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
