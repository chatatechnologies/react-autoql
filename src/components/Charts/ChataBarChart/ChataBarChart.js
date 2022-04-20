import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Bars } from '../Bars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues, getTickValues } from '../helpers.js'
import { shouldLabelsRotate } from '../../../js/Util'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'

export default class ChataBarChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
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
    labelValue: PropTypes.string,
    onLabelChange: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    leftMargin: 0,
    rightMargin: 0,
    topMargin: 0,
    bottomMargin: 0,
    labelValue: 'label',
    numberColumnIndices: [],
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

  componentDidUpdate = () => {
    if (this.didLabelsRotate()) {
      this.props.onLabelChange()
    }
  }

  didLabelsRotate = () => {
    const rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.xLabelArray,
      this.props.columns[this.props.numberColumnIndex],
      getDataFormatting(this.props.dataFormatting)
    )

    if (typeof rotateLabels !== 'undefined') {
      this.prevRotateLabels = this.rotateLabels
      this.rotateLabels = rotateLabels
      return this.prevRotateLabels !== this.rotateLabels
    }

    return false
  }

  setChartData = (props) => {
    const { minValue, maxValue } = getMinAndMaxValues(props.data)
    this.minValue = minValue
    this.maxValue = maxValue

    this.xScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([props.leftMargin, props.width - props.rightMargin])
      .nice()

    this.yScale = scaleBand()
      .domain(props.data.map((d) => d[props.labelValue]))
      .range([props.height - props.bottomMargin, props.topMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    this.yLabelArray = props.data.map((element) => element[props.labelValue])
    this.xLabelArray = props.data.map(
      (element) => element.cells[props.numberColumnIndex]
    )
    this.tickWidth =
      (props.width - props.leftMargin - props.rightMargin) /
      this.xScale.ticks().length
    this.barHeight = props.height / props.data.length
    this.yTickValues = getTickValues(
      this.barHeight,
      props.height,
      this.yLabelArray
    )
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g data-test="react-autoql-bar-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          xCol={this.props.columns[this.props.numberColumnIndex]}
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
          dataFormatting={this.props.dataFormatting}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
          onLegendTitleClick={this.props.onLegendTitleClick}
          legendLabels={this.props.legendLabels}
          onLegendClick={this.props.onLegendClick}
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
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
        {
          <Bars
            themeConfig={getThemeConfig(this.props.themeConfig)}
            scales={{ xScale: this.xScale, yScale: this.yScale }}
            margins={{
              left: this.props.leftMargin,
              right: this.props.rightMargin,
              bottom: this.props.bottomMargin,
              top: this.props.topMargin,
            }}
            data={this.props.data}
            maxValue={this.maxValue}
            width={this.props.width}
            height={this.props.height}
            labelValue={this.props.labelValue}
            onChartClick={this.props.onChartClick}
            activeKey={this.props.activeChartElementKey}
          />
        }
      </g>
    )
  }
}
