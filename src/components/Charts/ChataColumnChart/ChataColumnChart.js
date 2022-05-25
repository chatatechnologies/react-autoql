import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import {
  chartDefaultProps,
  chartPropTypes,
  getMinAndMaxValues,
  getTickValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'
import {
  shouldLabelsRotate,
  getTickWidth,
  getLongestLabelInPx,
} from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'

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
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    this.yScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    this.tickWidth = getTickWidth(this.xScale, props.innerPadding)
    this.xTickValues = getTickValues(
      this.tickWidth,
      props.width,
      this.xScale.domain()
    )
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g data-test="react-autoql-column-chart">
        <Axes
          {...this.props}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={this.props.columns[this.props.numberColumnIndex]}
          xTicks={this.xTickValues}
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
        {this.props.marginAdjustmentFinished && (
          <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />
        )}
      </g>
    )
  }
}
