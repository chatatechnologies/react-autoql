import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Line } from '../Line'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'
import {
  chartDefaultProps,
  chartPropTypes,
  getMinAndMaxValues,
  getTickValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'

export default class ChataLineChart extends Component {
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
    const rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.longestLabelWidth
    )

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.xTickValues,
      props.columns[props.stringColumnIndex],
      getDataFormatting(props.dataFormatting)
    )
  }

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length)
      numberColumnIndices = props.visibleSeriesIndices
    const { minValue, maxValue } = getMinAndMaxValues(
      props.data,
      numberColumnIndices
    )

    this.xScale = scaleBand()
      .domain(props.data.map((d) => d[props.stringColumnIndex]))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(1)
      .paddingOuter(0)

    const rangeEnd = props.topMargin
    let rangeStart = props.height - props.bottomMargin
    if (rangeStart < rangeEnd) {
      rangeStart = rangeEnd
    }

    this.yScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([rangeStart, rangeEnd])
    this.yScale.minValue = minValue
    this.yScale.maxValue = maxValue
    this.yScale.type = 'LINEAR'

    this.tickWidth = props.innerWidth / (this.xScale?.domain()?.length || 1)
    this.xTickValues = getTickValues({
      tickHeight: this.tickWidth,
      fullHeight: props.innerWidth,
      labelArray: this.xScale.domain(),
    })

    this.yLabelArray = this.yScale.ticks()
    this.tickHeight = props.innerHeight / this.yLabelArray?.length
    this.yTickValues = getTickValues({
      tickHeight: this.tickHeight,
      fullHeight: props.innerHeight,
      labelArray: this.yLabelArray,
      scale: this.yScale,
    })
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g data-test="react-autoql-line-chart">
        {this.props.marginAdjustmentFinished && (
          <Line {...this.props} xScale={this.xScale} yScale={this.yScale} />
        )}
        <Axes
          {...this.props}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={this.props.columns[this.props.numberColumnIndex]}
          xTicks={this.xTickValues}
          yTicks={this.yTickValues}
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleStringColumns
          }
          hasYDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleNumberColumns
          }
          xAxisTitle={this.props.stringAxisTitle}
          yAxisTitle={this.props.numberAxisTitle}
          yGridLines
        />
      </g>
    )
  }
}
