import React, { Component } from 'react'
import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import {
  calculateMinAndMaxSums,
  chartDefaultProps,
  chartPropTypes,
  getTickValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'
import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'

export default class ChataStackedBarChart extends Component {
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
    const tickWidth =
      (props.width - props.leftMargin - props.rightMargin) /
      this.xScale.ticks().length
    const rotateLabels = shouldLabelsRotate(tickWidth, this.longestLabelWidth)

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.xLabelArray,
      props.columns[props.numberColumnIndex],
      getDataFormatting(props.dataFormatting)
    )
  }

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length)
      numberColumnIndices = props.visibleSeriesIndices
    const { maxValue, minValue } = calculateMinAndMaxSums(
      props.data,
      props.stringColumnIndex,
      numberColumnIndices
    )

    const rangeStart = props.leftMargin
    let rangeEnd = props.width - props.rightMargin
    if (rangeEnd < rangeStart) {
      rangeEnd = rangeStart
    }

    this.xScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([rangeStart, rangeEnd])
    this.xScale.minValue = minValue
    this.xScale.maxValue = maxValue
    this.xScale.type = 'LINEAR'

    this.yScale = scaleBand()
      .domain(props.data.map((d) => d[props.stringColumnIndex]))
      .range([props.height - props.bottomMargin, props.topMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    this.yLabelArray = props.data.map(
      (element) => element[props.stringColumnIndex]
    )

    this.xLabelArray = this.xScale.ticks()

    this.barHeight = props.height / props.data.length
    this.yTickValues = getTickValues({
      tickHeight: this.barHeight,
      fullHeight: props.innerHeight,
      labelArray: this.yLabelArray,
    })

    this.xLabelArray = this.xScale.ticks()
    this.tickWidth = props.innerWidth / this.xLabelArray?.length
    this.xTickValues = getTickValues({
      tickHeight: this.tickWidth,
      fullHeight: props.innerWidth,
      labelArray: this.xLabelArray,
      scale: this.xScale,
    })
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g data-test="react-autoql-stacked-bar-chart">
        {this.props.marginAdjustmentFinished && (
          <StackedBars
            {...this.props}
            xScale={this.xScale}
            yScale={this.yScale}
          />
        )}
        <Axes
          {...this.props}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.numberColumnIndex]}
          yCol={this.props.columns[this.props.stringColumnIndex]}
          xTicks={this.xTickValues}
          yTicks={this.yTickValues}
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleNumberColumns
          }
          hasYDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleStringColumns
          }
          xAxisTitle={this.props.numberAxisTitle}
          yAxisTitle={this.props.stringAxisTitle}
          xGridLines
        />
      </g>
    )
  }
}
