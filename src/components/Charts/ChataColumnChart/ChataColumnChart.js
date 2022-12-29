import React, { Component } from 'react'
import { Axes } from '../Axes'
import { Columns } from '../Columns'

import {
  chartDefaultProps,
  chartPropTypes,
  getBandScales,
  getLinearScales,
  getTickSize,
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
    const rotateLabels = shouldLabelsRotate(this.xScale?.tickSizePx, this.longestLabelWidth)

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.xScale.tickLabels,
      props.columns[props.stringColumnIndex],
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

    const xScale = getBandScales({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    this.xScale = xScale.scale

    const yScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      columnIndices2: numberColumnIndices2,
      axis: 'y',
    })
    this.yScale = yScalesAndTicks.scale
    this.yTickValues = this.yScale.tickLabels
    this.yScale2 = yScalesAndTicks.scale2
    this.yTickValues2 = this.yScale2.tickLabels
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]
    const yCol2 = this.props.columns[this.props.numberColumnIndex2]

    return (
      <g
        className='react-autoql-axes-chart'
        data-test='react-autoql-column-chart'
        ref={(r) => (this.chartRef = r)}
        transform={`translate(${this.props.deltaX}, -${this.props.deltaY - 10})`}
      >
        {this.props.marginAdjustmentFinished && <Columns {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          xScale={this.xScale}
          yScale={this.yScale}
          yScale2={this.yScale2}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          yCol2={yCol2}
          xTicks={this.xScale.tickLabels}
          yTicks={this.yScale.tickLabels}
          yTicks2={this.yScale2.tickLabels}
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={this.props.enableDynamicCharting && this.props.hasMultipleStringColumns}
          hasYDropdown={this.props.enableDynamicCharting && this.props.hasMultipleNumberColumns}
          xAxisTitle={this.props.stringAxisTitle}
          yAxisTitle={this.props.numberAxisTitle}
          yAxis2Title={this.props.numberAxisTitle}
          yGridLines
        />
        {/* {!!this.props.legendLocation && (
          <Legend
            {...this.props}
            xScale={this.xScale}
            scale={this.yScale}
            col={yCol}
            placement={this.props.legendLocation}
            axesRef={this.axesRef?.ref}
          />
        )} */}
      </g>
    )
  }
}
