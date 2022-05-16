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
    this.xScale = scaleBand()
      .domain(props.data.map((d) => d[props.stringColumnIndex]))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingOuter(0.5)

    this.yScale = scaleBand()
      .domain(props.legendLabels.map((d) => d.label))
      .range([props.height - props.bottomMargin, props.topMargin])

    this.xTickValues = getTickValues(
      this.xScale.bandwidth(),
      props.width,
      this.xScale.domain()
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
          rotateLabels={this.rotateLabels}
          yGridLines
        />
        <Circles {...this.props} xScale={this.xScale} yScale={this.yScale} />
      </g>
    )
  }
}
