import React, { Component } from 'react'
import { scaleLinear, scaleBand } from 'd3-scale'
import _isEqual from 'lodash.isequal'
import _get from 'lodash.get'

import { Axes } from '../Axes'
import { Bars } from '../Bars'

import {
  getBandScale,
  getTickValues,
  chartPropTypes,
  chartDefaultProps,
  getMinAndMaxValues,
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
    })

    this.xScale = xScalesAndTicks.scale
    this.xTickValues = this.xScale.tickLabels
    this.xScale2 = xScalesAndTicks.scale2
    this.xTickValues2 = this.xScale2?.tickLabels
  }
  //   const { minValue, maxValue } = getMinAndMaxValues(props.data, numberColumnIndices, this.props.isChartScaled)

  //   const rangeStart = props.leftMargin
  //   let rangeEnd = props.width - props.rightMargin
  //   if (rangeEnd < rangeStart) {
  //     rangeEnd = rangeStart
  //   }

  //   this.xScale = scaleLinear().domain([minValue, maxValue]).range([rangeStart, rangeEnd])
  //   this.xScale.minValue = minValue
  //   this.xScale.maxValue = maxValue
  //   this.xScale.type = 'LINEAR'

  //   this.yScale = scaleBand()
  //     .domain(props.data.map((d) => d[props.stringColumnIndex]))
  //     .range([props.height - props.bottomMargin, props.topMargin])
  //     .paddingInner(props.innerPadding)
  //     .paddingOuter(props.outerPadding)

  //   this.yLabelArray = props.data.map((el) => el[props.stringColumnIndex])
  //   this.barHeight = props.innerHeight / props.data.length
  //   this.yTickValues = getTickValues({
  //     tickSize: this.barHeight,
  //     fullSize: props.innerHeight,
  //     initialTicks: this.yLabelArray,
  //   })

  //   this.xLabelArray = this.xScale.ticks()
  //   this.tickWidth = props.innerWidth / this.xLabelArray?.length
  //   this.xTickValues = getTickValues({
  //     tickSize: this.tickWidth,
  //     fullSize: props.innerWidth,
  //     initialTicks: this.xLabelArray,
  //     scale: this.xScale,
  //   })
  // }

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
        {this.props.marginAdjustmentFinished && <Bars {...this.props} xScale={this.xScale} yScale={this.yScale} />}
        <Axes
          {...this.props}
          ref={(r) => (this.axesRef = r)}
          xScale={this.xScale}
          xScale2={this.xScale2}
          yScale={this.yScale}
          xCol={xCol}
          xCol2={xCol2}
          linearAxis='x'
          yCol={this.props.columns[this.props.stringColumnIndex]}
          yTicks={this.yTickValues}
          xTicks={this.xTickValues}
          xTicks2={this.xTickValues2}
          rotateLabels={this.rotateLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          hasXDropdown={this.props.enableDynamicCharting && this.props.hasMultipleNumberColumns}
          hasYDropdown={this.props.enableDynamicCharting && this.props.hasMultipleStringColumns}
          leftAxisTitle={this.props.stringAxisTitle}
          bottomAxisTitle={this.props.numberAxisTitle}
          topAxisTitle={this.props.numberAxisTitle2}
          xGridLines
        />
      </g>
    )
  }
}
