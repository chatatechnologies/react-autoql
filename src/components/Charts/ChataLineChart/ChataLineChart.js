import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Line } from '../Line'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues, getTickValues } from '../helpers.js'
import { shouldLabelsRotate, getTickWidth } from '../../../js/Util'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'

export default class ChataLineChart extends Component {
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
    onLegendClick: PropTypes.func,
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
    labelValue: 'label',
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

  componentDidUpdate = () => {
    if (this.didLabelsRotate()) {
      this.props.onLabelChange()
    }
  }

  didLabelsRotate = () => {
    const rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.labelArray,
      this.props.columns[this.props.stringColumnIndex],
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
    // Get max and min values from all series
    const { minValue, maxValue } = getMinAndMaxValues(props.data)
    this.minValue = minValue
    this.maxValue = maxValue

    this.xScale = scaleBand()
      .domain(props.data.map((d) => d[props.labelValue]))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(0.1)

    this.yScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    this.labelArray = props.data.map((element) => element[props.labelValue])
    this.tickWidth = getTickWidth(this.xScale, props.innerPadding)
    this.xTickValues = getTickValues(
      this.tickWidth,
      props.width,
      this.labelArray
    )
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g data-test="react-autoql-line-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          xCol={this.props.columns[0]}
          yCol={this.props.columns[this.props.numberColumnIndex]}
          margins={{
            left: this.props.leftMargin,
            right: this.props.rightMargin,
            bottom: this.props.bottomMargin,
            top: this.props.topMargin,
            bottomLegend: this.props.bottomLegendMargin,
          }}
          width={this.props.width}
          height={this.props.height}
          xTicks={this.xTickValues}
          rotateLabels={this.rotateLabels}
          dataFormatting={this.props.dataFormatting}
          legendLabels={this.props.legendLabels}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
          onLegendTitleClick={this.props.onLegendTitleClick}
          onLegendClick={this.props.onLegendClick}
          yGridLines
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
          hasXDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleStringColumns
          }
          hasYDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleNumberColumns
          }
          yAxisTitle={this.props.numberAxisTitle}
          xAxisTitle={this.props.stringAxisTitle}
        />
        <Line
          themeConfig={this.props.themeConfig}
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
          backgroundColor={this.props.backgroundColor}
          activeKey={this.props.activeChartElementKey}
        />
      </g>
    )
  }
}
