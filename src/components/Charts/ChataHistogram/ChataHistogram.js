import React from 'react'
import { createPortal } from 'react-dom'
import { bin, max, min } from 'd3-array'

import { Axes } from '../Axes'
import { Slider } from '../../Slider'
import { HistogramColumns } from './HistogramColumns'
import { HistogramDistributions } from './HistogramDistributions'
import { deepEqual, formatChartLabel, onlyUnique } from '../../../js/Util'
import { chartDefaultProps, chartPropTypes, convertToNumber, getBinLinearScale, getHistogramScale } from '../helpers.js'

export default class ChataHistogram extends React.Component {
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

    this.setChartData(this.props, this.bucketSize)

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

  setInitialBucketSize = (minValue, maxValue) => {
    const initialNumBuckets = this.getInitialNumberOfBuckets()
    this.bucketSize = Math.ceil((maxValue - minValue) / initialNumBuckets)
    if (this.bucketSize < this.minBucketSize) {
      this.bucketSize = this.minBucketSize
    }
  }

  getBinData = (newBucketSize) => {
    let minValue = min(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))
    let maxValue = max(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))

    if (minValue === maxValue) {
      minValue = minValue - 1
      maxValue = maxValue + 1
    }

    this.bucketSize = newBucketSize
    this.maxBucketSize = Math.ceil((maxValue - minValue) / (this.minNumBuckets ?? 1))
    this.minBucketSize = Math.floor((maxValue - minValue) / (this.maxNumBuckets ?? 1))

    if (this.maxBucketSize - this.minBucketSize < 3) {
      this.bucketStepSize = 0.1
    } else if (this.maxBucketSize - this.minBucketSize < 6) {
      this.bucketStepSize = 0.5
    }

    if (!this.bucketSize || this.props.numberColumnIndex !== this.xScale?.columnIndex) {
      this.setInitialBucketSize(minValue, maxValue)
    }

    let bucketValue = this.roundDownToNearestMultiple(minValue, this.bucketSize)

    const bins = [bucketValue]

    while (bucketValue < maxValue) {
      bucketValue += this.bucketSize
      bins.push(bucketValue)
    }

    const binFn = bin()
      .value((d) => d[this.props.numberColumnIndex])
      .domain([bins[0], bins[bins.length - 1]])
      .thresholds(bins)

    return { buckets: binFn(this.props.data), bins }
  }

  changeNumberColumnIndices = (indices, indices2, newColumns) => {
    const minValue = min(this.props.data, (d) => convertToNumber(d[indices[0]]))
    const maxValue = max(this.props.data, (d) => convertToNumber(d[indices[0]]))
    this.setInitialBucketSize(minValue, maxValue)
    this.props.changeNumberColumnIndices(indices, indices2, newColumns, bucketSize)
  }

  setChartData = (props, bucketSize) => {
    const uniqueNumberValues = props.data.map((d) => d[props.numberColumnIndex]).filter(onlyUnique).length
    if (uniqueNumberValues < this.maxBucketSize) {
      this.maxNumBuckets = uniqueNumberValues
    }

    const { buckets, bins } = this.getBinData(bucketSize)
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

  formatSliderLabel = (value) => {
    return formatChartLabel({
      d: value,
      column: this.props.columns[this.props.numberColumnIndex],
      dataFormatting: this.props.dataFormatting,
      scale: this.innerChartRef?.xScale,
    })?.fullWidthLabel
  }

  renderHistogramSlider = () => {
    if (isNaN(this.bucketSize) || isNaN(this.minBucketSize) || isNaN(this.maxBucketSize)) {
      return null
    }

    const min = this.minBucketSize
    const max = this.maxBucketSize

    return (
      <Slider
        key={`${this.HISTOGRAM_SLIDER_KEY}`}
        className='react-autoql-histogram-slider'
        initialValue={this.bucketSize}
        min={min}
        max={max}
        step={this.bucketStepSize}
        minLabel={this.formatSliderLabel(min)}
        maxLabel={this.formatSliderLabel(max)}
        onChange={(bucketSize) => this.setState({ bucketSize })}
        valueFormatter={this.formatSliderLabel}
        label='Interval size'
        showInput
        marks
      />
    )
  }

  render = () => {
    this.setChartData(this.props, this.state.bucketSize)

    return (
      <>
        {this.props.portalRef && createPortal(this.renderHistogramSlider(), this.props.portalRef)}
        <g
          ref={(r) => (this.chartRef = r)}
          className='react-autoql-axes-chart'
          data-test='react-autoql-histogram-chart'
        >
          <Axes
            {...this.props}
            ref={(r) => (this.axesRef = r)}
            chartRef={this.chartRef}
            xScale={this.xScale}
            yScale={this.yScale}
            changeNumberColumnIndices={this.changeNumberColumnIndices}
            linearAxis='y'
            yGridLines
          >
            <HistogramColumns
              {...this.props}
              xScale={this.xScale}
              yScale={this.yScale}
              buckets={this.buckets}
              bins={this.bins}
            />
            <HistogramDistributions {...this.props} xScale={this.xScale} yScale={this.yScale} buckets={this.buckets} />
          </Axes>
        </g>
      </>
    )
  }
}
