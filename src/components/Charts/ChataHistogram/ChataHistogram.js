import React from 'react'
import { PropTypes } from 'prop-types'
import { createPortal } from 'react-dom'
import { bin, max, min } from 'd3-array'
import {
  getBinData,
  formatChartLabel,
  getBinLinearScale,
  getHistogramScale,
  onlyUnique,
  deepEqual,
  roundDownToNearestMultiple,
  roundUpToNearestMultiple,
  roundToNearestLog10,
  convertToNumber,
  getBandScale,
} from 'autoql-fe-utils'

import { Axes } from '../Axes'
import { Slider } from '../../Slider'
import { HistogramColumns } from './HistogramColumns'
import { HistogramDistributions } from './HistogramDistributions'
import { v4 as uuid } from 'uuid'
import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers.js'
import { Columns } from '../Columns'

export default class ChataHistogram extends React.Component {
  constructor(props) {
    super(props)

    this.HISTOGRAM_SLIDER_KEY = uuid()
    this.bucketConfig = this.getDefaultBucketConfig(props, props.initialBucketSize)

    this.state = {
      bucketSize: props.initialBucketSize,
    }

    this.setChartData(this.props, props.initialBucketSize)
  }

  static propTypes = {
    ...chartPropTypes,
    initialBucketSize: PropTypes.number,
    onBucketSizeChange: PropTypes.func,
  }

  static defaultProps = {
    ...chartDefaultProps,
    initialBucketSize: undefined,
    onBucketSizeChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getDefaultBucketConfig = (props, bucketSize) => {
    const DEFAULT_MIN_NUM_BUCKETS = 5
    const DEFAULT_MAX_NUM_BUCKETS = 20
    const DEFAULT_BUCKET_STEP_SIZE = 1

    const defaultConfig = {
      bucketSize,
      minBucketSize: undefined,
      maxBucketSize: undefined,
      minNumBuckets: DEFAULT_MIN_NUM_BUCKETS,
      maxNumBuckets: DEFAULT_MAX_NUM_BUCKETS,
      bucketStepSize: DEFAULT_BUCKET_STEP_SIZE,
    }

    if (props?.data?.length < DEFAULT_MIN_NUM_BUCKETS) {
      defaultConfig.minNumBuckets = 2
    }

    if (props?.data?.length < DEFAULT_MAX_NUM_BUCKETS) {
      defaultConfig.maxNumBuckets = props.data.length
    }

    return defaultConfig
  }

  getInitialBucketSize = (minValue, maxValue) => {
    // Using Sturge's rule https://www.statisticshowto.com/choose-bin-sizes-statistics/
    const initialNumBuckets = Math.round(1 + Math.log2(this.props.data?.length))

    const bucketSizeRaw = (maxValue - minValue) / initialNumBuckets

    let initialBucketSize = roundUpToNearestMultiple(bucketSizeRaw, this.bucketConfig.bucketStepSize)
    if (initialBucketSize < this.bucketConfig.minBucketSize) {
      initialBucketSize = this.bucketConfig.minBucketSize
    } else if (initialBucketSize > this.bucketConfig.maxBucketSize) {
      initialBucketSize = this.bucketConfig.maxBucketSize
    }

    return initialBucketSize
  }

  getBinData = (newBucketSize) => {
    let minValue = min(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))
    let maxValue = max(this.props.data, (d) => convertToNumber(d[this.props.numberColumnIndex]))

    if (minValue === maxValue) {
      minValue = minValue - 1
      maxValue = maxValue + 1
    }

    const maxBucketSizeRaw = (maxValue - minValue) / (this.bucketConfig.minNumBuckets ?? 1)
    const minBucketSizeRaw = (maxValue - minValue) / (this.bucketConfig.maxNumBuckets ?? 1)

    const bucketSizeRange = maxBucketSizeRaw - minBucketSizeRaw
    if (bucketSizeRange <= 10) {
      const avgNumSteps = 100
      this.bucketConfig.bucketStepSize = roundToNearestLog10(bucketSizeRange / avgNumSteps)
    }

    this.bucketConfig.maxBucketSize = roundDownToNearestMultiple(
      (maxValue - minValue) / (this.bucketConfig.minNumBuckets ?? 1),
      this.bucketConfig.bucketStepSize,
    )
    this.bucketConfig.minBucketSize = roundUpToNearestMultiple(
      (maxValue - minValue) / (this.bucketConfig.maxNumBuckets ?? 1),
      this.bucketConfig.bucketStepSize,
    )

    if (this.bucketConfig.minBucketSize <= 0) {
      this.bucketConfig.minBucketSize = this.bucketConfig.bucketStepSize
    }
    if (this.bucketConfig.maxBucketSize === this.bucketConfig.minBucketSize) {
      this.bucketConfig.maxBucketSize = this.bucketConfig.minBucketSize + this.bucketConfig.bucketStepSize
    }

    if (newBucketSize < this.bucketConfig.maxBucketSize && newBucketSize > this.bucketConfig.minBucketSize) {
      this.bucketConfig.bucketSize = newBucketSize
    } else {
      this.bucketConfig.bucketSize = undefined
    }

    if (!this.bucketConfig.bucketSize) {
      this.bucketConfig.bucketSize = this.getInitialBucketSize(minValue, maxValue)
    }

    let bucketValue = roundUpToNearestMultiple(minValue, this.bucketConfig.bucketSize)

    const bins = [bucketValue]

    while (bucketValue < maxValue) {
      bucketValue += this.bucketConfig.bucketSize
      bins.push(bucketValue)
    }

    const binFn = bin()
      .value((d) => d[this.props.numberColumnIndex])
      .domain([bins[0], bins[bins.length - 1]])
      .thresholds(bins)

    return { buckets: binFn(this.props.data), bins }
  }

  setChartData = (props, bucketSize) => {
    if (this.axisIsNumerical()) {
      const { data, numberColumnIndex } = props
      if (this.xScale && this.props.numberColumnIndex !== this.xScale.columnIndex) {
        this.props.onBucketSizeChange(undefined)
        this.bucketConfig = this.getDefaultBucketConfig(props)
      }

      const uniqueNumberValues = props.data.map((d) => d[props.numberColumnIndex]).filter(onlyUnique).length
      if (uniqueNumberValues < this.bucketConfig.maxBucketSize) {
        this.bucketConfig.maxNumBuckets = uniqueNumberValues
      }

      const { buckets, bins } = getBinData({
        newBucketSize: bucketSize,
        bucketConfig: this.bucketConfig,
        data,
        numberColumnIndex,
      })

      this.buckets = buckets
      this.bins = bins

      this.xScale = getBinLinearScale({
        ...props,
        columnIndex: props.numberColumnIndex,
        axis: 'x',
        buckets: this.buckets,
        bins,
        isScaled: true,
      })
    } else {
      this.xScale = getBandScale({
        ...props,
        columnIndex: props.numberColumnIndex,
        axis: 'x',
        isScaled: true,
      })
    }

    this.yScale = getHistogramScale({
      ...props,
      axis: 'y',
      buckets: this.buckets,
      columnIndex: props.numberColumnIndex,
      isScaled: true,
    })
  }

  onBucketSizeChange = (bucketSize) => {
    this.setState({ bucketSize })
    this.props.onBucketSizeChange(bucketSize)
  }

  formatSliderLabel = (value) => {
    const sigDigits =
      this.bucketConfig.bucketStepSize < 1
        ? this.bucketConfig.bucketStepSize.toString().split('.')[1].length
        : undefined
    return formatChartLabel({
      d: value,
      column: this.props.columns[this.props.numberColumnIndex],
      dataFormatting: this.props.dataFormatting,
      scale: this.xScale,
      sigDigits,
    })?.fullWidthLabel
  }

  renderHistogramSlider = () => {
    if (
      isNaN(this.bucketConfig.bucketSize) ||
      isNaN(this.bucketConfig.minBucketSize) ||
      isNaN(this.bucketConfig.maxBucketSize)
    ) {
      return null
    }

    const min = this.bucketConfig.minBucketSize
    const max = this.bucketConfig.maxBucketSize

    return (
      <Slider
        key={`${this.HISTOGRAM_SLIDER_KEY}-${this.props.numberColumnIndex}`}
        className='react-autoql-histogram-slider'
        initialValue={this.bucketConfig.bucketSize}
        min={min}
        max={max}
        step={this.bucketConfig.bucketStepSize}
        minLabel={this.formatSliderLabel(min)}
        maxLabel={this.formatSliderLabel(max)}
        onChange={this.onBucketSizeChange}
        valueFormatter={this.formatSliderLabel}
        label='Interval size'
        showInput
        marks
      />
    )
  }

  axisIsNumerical = () => {
    const column = this.props.columns[this.props.numberColumnIndex]
    return column.isNumberType
  }

  render = () => {
    this.setChartData(this.props, this.state.bucketSize)

    return (
      <>
        {this.axisIsNumerical() &&
          this.props.portalRef &&
          createPortal(this.renderHistogramSlider(), this.props.portalRef)}
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
            linearAxis='y'
            yGridLines
          >
            {/*
            Keep for future use when we want to show histograms for categorical data
            {this.axisIsNumerical() ? ( */}
            <HistogramColumns
              {...this.props}
              xScale={this.xScale}
              yScale={this.yScale}
              buckets={this.buckets}
              bins={this.bins}
            />
            {/*
            Keep for future use when we want to show histograms for categorical data
            ) : (
              <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />
            )}
            {/* <HistogramDistributions {...this.props} xScale={this.xScale} yScale={this.yScale} buckets={this.buckets} /> */}
          </Axes>
        </g>
      </>
    )
  }
}
