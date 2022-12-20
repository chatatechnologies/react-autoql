import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'

import {
  chartDefaultProps,
  chartPropTypes,
  getBandScalesAndTickValues,
  getLinearScalesAndTickValues,
  getMinAndMaxValues,
  getTickValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'
import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'
import { Legend } from '../Legend'

export default class ChataColumnChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
    this.setLongestLabelWidth(props)
    this.setLabelRotationValue(props)
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  componentDidMount = () => {
    this.props.onLabelChange()
  }

  shouldComponentUpdate = () => {
    return true
  }

  componentDidUpdate = (prevProps) => {
    if (shouldRecalculateLongestLabel(prevProps, this.props)) {
      this.setLongestLabelWidth(this.props)
    }
  }

  setLabelRotationValue = (props) => {
    const rotateLabels = shouldLabelsRotate(this.tickWidth, this.longestLabelWidth)

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.xTickValues,
      props.columns[props.stringColumnIndex],
      getDataFormatting(props.dataFormatting),
    )
  }

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length) {
      numberColumnIndices = props.visibleSeriesIndices
    }

    const xScaleAndTicks = getBandScalesAndTickValues(props, props.stringColumnIndex)
    this.xScale = xScaleAndTicks.scale
    this.xTickValues = xScaleAndTicks.tickValues

    const yScalesAndTicks = getLinearScalesAndTickValues(props, numberColumnIndices)
    this.yScale = yScalesAndTicks.scale
    this.yTickValues = yScalesAndTicks.tickValues
    this.yScale2 = yScalesAndTicks.scale2
    this.yTickValues2 = yScalesAndTicks.tickValues2

    // const { minValue, maxValue } = getMinAndMaxValues(props.data, numberColumnIndices, props.isChartScaled)

    // const rangeEnd = props.topMargin
    // let rangeStart = props.height - props.bottomMargin
    // if (rangeStart < rangeEnd) {
    //   rangeStart = rangeEnd
    // }

    // const tempYScale = scaleLinear().domain([minValue, maxValue]).range([rangeStart, rangeEnd])
    // tempYScale.type = 'LINEAR'
    // tempYScale.minValue = minValue
    // tempYScale.maxValue = maxValue

    // this.yLabelArray = tempYScale.ticks()
    // this.tickHeight = props.innerHeight / this.yLabelArray?.length
    // this.yTickValues = getTickValues({
    //   tickHeight: this.tickHeight,
    //   fullHeight: props.innerHeight,
    //   labelArray: this.yLabelArray,
    //   scale: tempYScale,
    // })

    // this.yScale = scaleLinear()
    //   .domain(this.yTickValues[0], this.yTickValues[this.yTickValues.length - 1])
    //   .range([rangeStart, rangeEnd])

    // const minMax2 = getMinAndMaxValues(props.data, [numberColumnIndices[1]], props.isChartScaled)
    // const tempYScale2 = scaleLinear().domain([minMax2.minValue, minMax2.maxValue]).range([rangeStart, rangeEnd])
    // tempYScale2.type = 'LINEAR'
    // tempYScale2.minValue = minMax2.minValue
    // tempYScale2.maxValue = minMax2.maxValue

    // const yTickValues2 = [...tempYScale2?.ticks(this.yTickValues.length)]
    // const numYTickValues2 = yTickValues2.length
    // if (numYTickValues2 === this.yTickValues.length) {
    //   this.yTickValues2 = yTickValues2
    // } else if (numYTickValues2 < this.yTickValues.length) {
    //   const difference = this.yTickValues.length - numYTickValues2
    //   const interval = Math.abs(yTickValues2[1] - yTickValues2[0])

    //   for (let i = 0; i < difference; i++) {
    //     const tickValue = (i + numYTickValues2) * interval
    //     yTickValues2.push(tickValue)
    //   }

    //   this.yTickValues2 = yTickValues2
    // } else if (numYTickValues2 > this.yTickValues.length) {
    //   this.yTickValues2 = getTickValues({
    //     tickHeight: this.tickHeight,
    //     fullHeight: props.innerHeight,
    //     labelArray: yTickValues2,
    //     scale: tempYScale2,
    //   })

    //   const newYTickValues = [...this.yTickValues]
    //   const difference = this.yTickValues2.length - this.yTickValues.length
    //   const interval = Math.abs(this.yTickValues[1] - this.yTickValues[0])

    //   for (let i = 0; i < difference; i++) {
    //     const tickValue = (i + this.yTickValues.length) * interval
    //     newYTickValues.push(tickValue)
    //   }

    //   this.yTickValues = newYTickValues
    // }

    // this.yScale = scaleLinear()
    //   .domain([this.yTickValues[0], this.yTickValues[this.yTickValues.length - 1]])
    //   .range([rangeStart, rangeEnd])
    // this.yScale.minValue = minValue
    // this.yScale.maxValue = maxValue
    // this.yScale.type = 'LINEAR'

    // this.yScale2 = scaleLinear()
    //   .domain([this.yTickValues2[0], this.yTickValues2[this.yTickValues2.length - 1]])
    //   .range([rangeStart, rangeEnd])
    // this.yScale2.minValue = minMax2.minValue
    // this.yScale2.maxValue = minMax2.maxValue
    // this.yScale2.type = 'LINEAR'
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]
    const yCol2 = this.props.columns[this.props.numberColumnIndices[1]]

    return (
      <g data-test='react-autoql-column-chart'>
        {this.props.marginAdjustmentFinished && <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          xScale={this.xScale}
          yScale={this.yScale}
          yScale2={this.yScale2}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          yCol2={yCol2}
          xTicks={this.xTickValues}
          yTicks={this.yTickValues}
          yTicks2={this.yTickValues2}
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={this.props.enableDynamicCharting && this.props.hasMultipleStringColumns}
          hasYDropdown={this.props.enableDynamicCharting && this.props.hasMultipleNumberColumns}
          xAxisTitle={this.props.stringAxisTitle}
          yAxisTitle={this.props.numberAxisTitle}
          yAxis2Title={this.props.numberAxisTitle}
          hasSecondYAxis={!!this.props.columns[this.props.numberColumnIndex]} // todo: set this some other way
          yGridLines
        />
        <Legend
          {...this.props}
          xScale={this.xScale}
          scale={this.yScale}
          col={yCol}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
        />
      </g>
    )
  }
}
