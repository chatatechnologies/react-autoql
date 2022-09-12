import React, { Component } from 'react'
import { scaleBand } from 'd3-scale'

import { Axes } from '../Axes'
import { Circles } from '../Circles'
import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util.js'
import { getDataFormatting } from '../../../props/defaults'
import {
  chartDefaultProps,
  chartPropTypes,
  getTickValues,
  shouldRecalculateLongestLabel,
} from '../helpers.js'

export default class ChataBubbleChart extends Component {
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
    this.circleHeight = props.innerHeight / this.yLabelArray.length

    const xRangeStart = props.leftMargin
    let xRangeEnd = props.width - props.rightMargin
    if (xRangeEnd < xRangeStart) {
      xRangeEnd = xRangeStart
    }

    this.xScale = scaleBand()
      .domain(props.data.map((d) => d[props.stringColumnIndex]))
      .range([xRangeStart, xRangeEnd])
      .paddingOuter(0.5)

    const yRangeEnd = props.topMargin
    let yRangeStart = props.height - props.bottomMargin
    if (yRangeStart < yRangeEnd) {
      yRangeStart = yRangeEnd
    }

    this.yScale = scaleBand()
      .domain(this.yLabelArray)
      .range([yRangeStart, yRangeEnd])

    this.xTickValues = getTickValues(
      this.xScale.bandwidth(),
      props.innerWidth,
      this.xScale.domain()
    )

    this.yTickValues = getTickValues(
      this.circleHeight,
      props.innerHeight,
      this.yLabelArray
    )
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g
        className="react-autoql-bubble-chart"
        data-test="react-autoql-bubble-chart"
      >
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
        <Circles {...this.props} xScale={this.xScale} yScale={this.yScale} />
      </g>
    )
  }
}
