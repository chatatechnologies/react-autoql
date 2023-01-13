import React, { Component } from 'react'
import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'

import {
  chartDefaultProps,
  chartPropTypes,
  getBandScale,
  getLinearScales,
  shouldRecalculateLongestLabel,
} from '../helpers.js'

import { shouldLabelsRotate, getLongestLabelInPx } from '../../../js/Util'
import { getDataFormatting } from '../../../props/defaults'

export default class ChataStackedColumnChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
    this.setLongestLabelWidth(props)
    this.setLabelRotationValue(props)
  }

  static propTypes = chartPropTypes
  static defaultProps = chartDefaultProps

  // shouldComponentUpdate = () => {
  //   return true
  // }

  componentDidUpdate = (prevProps) => {
    if (shouldRecalculateLongestLabel(prevProps, this.props)) {
      this.setLongestLabelWidth(this.props)
    }
  }

  setLabelRotationValue = () => {
    const rotateLabels = shouldLabelsRotate(this.xScale?.tickSizePx, this.longestLabelWidth)

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

    let numberColumnIndices2 = props.numberColumnIndices2
    if (props.visibleSeriesIndices2?.length) {
      numberColumnIndices2 = props.visibleSeriesIndices2
    }

    this.xScale = getBandScale({
      props,
      columnIndex: props.stringColumnIndex,
      axis: 'x',
    })

    const yScalesAndTicks = getLinearScales({
      props,
      columnIndices1: numberColumnIndices,
      columnIndices2: numberColumnIndices2,
      axis: 'y',
      stacked: true,
    })

    this.yScale = yScalesAndTicks.scale
    this.yTickValues = this.yScale.tickLabels
    this.yScale2 = yScalesAndTicks.scale2
    this.yTickValues2 = this.yScale2?.tickLabels
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    const yCol = this.props.columns[this.props.numberColumnIndex]
    const yCol2 = this.props.columns[this.props.numberColumnIndex2]

    return (
      <g
        ref={(r) => (this.chartRef = r)}
        className='react-autoql-axes-chart'
        data-test='react-autoql-stacked-column-chart'
        transform={`translate(${this.props.deltaX}, ${this.props.deltaY})`}
      >
        {this.props.marginAdjustmentFinished && (
          <StackedColumns {...this.props} xScale={this.xScale} yScale={this.yScale} />
        )}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          xScale={this.xScale}
          yScale={this.yScale}
          yScale2={this.yScale2}
          xCol={this.props.columns[this.props.stringColumnIndex]}
          yCol={yCol}
          yCol2={yCol2}
          linearAxis='y'
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          leftAxisTitle={this.props.numberAxisTitle}
          rightAxisTitle={this.props.numberAxisTitle2}
          bottomAxisTitle={this.props.stringAxisTitle}
          yGridLines
        />
      </g>
    )
  }
}
