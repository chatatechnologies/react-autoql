import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import {
  calculateMinAndMaxSums,
  shouldLabelsRotate,
  getLongestLabelInPx,
} from '../../../js/Util'
import { getTickValues } from '../helpers'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
} from '../../../props/defaults'

export default class ChataStackedBarChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
    this.setLongestLabelWidth(props)
    this.setLabelRotationValue(props)
  }

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,

    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    leftMargin: PropTypes.number,
    rightMargin: PropTypes.number,
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    onLabelChange: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
    legendLocation: PropTypes.string,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    leftMargin: 0,
    rightMargin: 0,
    topMargin: 0,
    bottomMargin: 0,
    numberColumnIndices: [],
    legendLocation: undefined,
    onXAxisClick: () => {},
    onYAxisClick: () => {},
    onLabelChange: () => {},
  }

  componentDidMount = () => {
    this.props.onLabelChange()
  }

  shouldComponentUpdate = () => {
    return true
  }

  componentDidUpdate = (prevProps) => {
    if (
      this.props.marginAdjustmentFinished &&
      prevProps?.data?.length !== this.props.data?.length
    ) {
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
    const { maxValue, minValue } = calculateMinAndMaxSums(props.data)
    this.maxValue = maxValue
    this.minValue = minValue

    this.xScale = scaleLinear()
      .domain([this.minValue, this.maxValue])
      .range([props.leftMargin, props.width - props.rightMargin])
      .nice()

    this.yScale = scaleBand()
      .domain(props.data.map((d) => d.label))
      .range([props.height - props.bottomMargin, props.topMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    this.yLabelArray = props.data.map((element) => element.label)
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
      <g data-test="react-autoql-stacked-bar-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          xCol={_get(
            this.props.tableColumns,
            `[${this.props.numberColumnIndex}]`
          )}
          yCol={this.props.columns[0]}
          margins={{
            left: this.props.leftMargin,
            right: this.props.rightMargin,
            bottom: this.props.bottomMargin,
            top: this.props.topMargin,
            bottomLegend: this.props.bottomLegendMargin,
          }}
          width={this.props.width}
          height={this.props.height}
          yTicks={this.yTickValues}
          rotateLabels={this.rotateLabels}
          onLabelChange={this.props.onLabelChange}
          dataFormatting={this.props.dataFormatting}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          legendLabels={this.props.legendLabels}
          onLegendClick={this.props.onLegendClick}
          legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
          onLegendTitleClick={this.props.onLegendTitleClick}
          enableDynamicCharting={this.props.enableDynamicCharting}
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
          stringColumnIndices={this.props.stringColumnIndices}
          numberColumnIndices={this.props.numberColumnIndices}
          hasXDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleNumberColumns
          }
          hasYDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleStringColumns
          }
          xAxisTitle={this.props.numberAxisTitle}
          xGridLines
        />
        {this.props.marginAdjustmentFinished && (
          <StackedBars
            themeConfig={this.props.themeConfig}
            scales={{ xScale: this.xScale, yScale: this.yScale }}
            margins={{
              left: this.props.leftMargin,
              right: this.props.rightMargin,
              bottom: this.props.bottomMargin,
              top: this.props.topMargin,
            }}
            data={this.props.data}
            width={this.props.width}
            height={this.props.height}
            onChartClick={this.props.onChartClick}
            activeKey={this.props.activeChartElementKey}
          />
        )}
      </g>
    )
  }
}
