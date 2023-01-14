import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Bars } from '../Bars'

import {
  getBandScale,
  chartPropTypes,
  chartDefaultProps,
  shouldRecalculateLongestLabel,
  getLinearScales,
} from '../helpers.js'

import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'

export default class ChataBarChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
    this.setLongestLabelWidth(props)
    this.setLabelRotationValue(props)

    this.state = {
      isChartScaled: false,
    }
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  shouldComponentUpdate = () => {
    return true
  }

  componentDidUpdate = (prevProps) => {
    if (shouldRecalculateLongestLabel(prevProps, this.props)) {
      this.setLongestLabelWidth(this.props)
    }
  }

  setLabelRotationValue = (props) => {
    const tickWidth = props.innerWidth / this.xScale.ticks().length
    const rotateLabels = shouldLabelsRotate(tickWidth, this.longestLabelWidth)

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.xLabelArray,
      props.columns[props.numberColumnIndex],
      getDataFormatting(props.dataFormatting),
    )
  }

  setChartData = (props) => {
    let numberColumnIndices = props.numberColumnIndices
    if (props.visibleSeriesIndices?.length) {
      numberColumnIndices = props.visibleSeriesIndices
    }

    let numberColumnIndices2 = props.numberColumnIndices2
    if (props.visibleSeriesIndices2?.length) {
      numberColumnIndices2 = props.visibleSeriesIndices2
    }

    this.yScale = getBandScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'y',
    })

    const xScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      columnIndices2: numberColumnIndices2,
      axis: 'x',
      isScaled: this.state?.isChartScaled,
    })

    this.xScale = xScalesAndTicks.scale
    this.xTickValues = this.xScale.tickLabels
    this.xScale2 = xScalesAndTicks.scale2
    this.xTickValues2 = this.xScale2?.tickLabels
  }

  toggleChartScale = () => {
    this.setState({ isChartScaled: !this.state.isChartScaled })
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    const xCol = this.props.columns[this.props.numberColumnIndex]
    const xCol2 = this.props.columns[this.props.numberColumnIndex2]

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-bar-chart'
        transform={`translate(${this.props.deltaX}, ${this.props.deltaY})`}
      >
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          xScale={this.xScale}
          xScale2={this.xScale2}
          yScale={this.yScale}
          xCol={xCol}
          xCol2={xCol2}
          yCol={this.props.columns[this.props.stringColumnIndex]}
          linearAxis='x'
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={this.props.hasNumberDropdown}
          hasYDropdown={this.props.hasStringDropdown}
          leftAxisTitle={this.props.stringAxisTitle}
          bottomAxisTitle={this.props.numberAxisTitle}
          topAxisTitle={this.props.numberAxisTitle2}
          toggleChartScale={this.toggleChartScale}
          xGridLines
        >
          {this.props.marginAdjustmentFinished && <Bars {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        </Axes>
      </g>
    )
  }
}
