import React, { Component } from 'react'
import { scaleBand } from 'd3-scale'

import { Axes } from '../Axes'
import { Squares } from '../Squares'
import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util.js'
import { getDataFormatting } from '../../../props/defaults'
import {
  chartDefaultProps,
  chartPropTypes,
  getTickValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'

export default class ChataHeatmapChart extends Component {
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
      this.xScale.bandwidth(),
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
    this.yLabelArray = props.legendLabels.map((d) => d.label)
    this.squareHeight = props.innerHeight / this.yLabelArray.length

    const xRangeStart = props.leftMargin + 10
    let xRangeEnd = props.width - props.rightMargin
    if (xRangeEnd < xRangeStart) {
      xRangeEnd = xRangeStart
    }

    this.xScale = scaleBand()
      .domain(props.data.map((d) => d[props.stringColumnIndex]))
      .range([xRangeStart, xRangeEnd])
      .paddingInner(0.01)

    const yRangeEnd = props.topMargin
    let yRangeStart = props.height - props.bottomMargin
    if (yRangeStart < yRangeEnd) {
      yRangeStart = yRangeEnd
    }

    this.yScale = scaleBand()
      .domain(this.yLabelArray)
      .range([yRangeStart, yRangeEnd])
      .paddingInner(0.01)

    this.xTickValues = getTickValues(
      this.xScale.bandwidth(),
      props.innerWidth,
      this.xScale.domain()
    )

    this.yTickValues = getTickValues(
      this.squareHeight,
      props.innerHeight,
      this.yLabelArray
    )
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g
        data-test="react-autoql-heatmap-chart"
        className="react-autoql-heatmap-chart"
      >
        {this.props.marginAdjustmentFinished && (
          <Squares {...this.props} xScale={this.xScale} yScale={this.yScale} />
        )}
        <Axes
          {...this.props}
          xScale={this.xScale}
          yScale={this.yScale}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={this.props.legendColumn}
          xTicks={this.xTickValues}
          yTicks={this.yTickValues}
          rotateLabels={this.rotateLabels}
          yGridLines
        />
      </g>
    )
  }
}
