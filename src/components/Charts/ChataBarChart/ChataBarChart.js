import React, { Component } from 'react'
import { scaleLinear, scaleBand } from 'd3-scale'
import _isEqual from 'lodash.isequal'
import _get from 'lodash.get'

import { Axes } from '../Axes'
import { Bars } from '../Bars'

import {
  getTickValues,
  chartPropTypes,
  chartDefaultProps,
  getMinAndMaxValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'
import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'

export default class ChataBarChart extends Component {
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
    const { minValue, maxValue } = getMinAndMaxValues(
      props.data,
      numberColumnIndices
    )

    this.xScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([props.leftMargin, props.width - props.rightMargin])
      .nice()

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
    this.yTickValues = getTickValues(
      this.barHeight,
      props.height,
      this.yLabelArray
    )
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g data-test="react-autoql-bar-chart">
        <Axes
          {...this.props}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.numberColumnIndex]}
          yCol={this.props.columns[this.props.stringColumnIndex]}
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
        {this.props.marginAdjustmentFinished && (
          <Bars {...this.props} xScale={this.xScale} yScale={this.yScale} />
        )}
      </g>
    )
  }
}
