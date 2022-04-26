import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues, getTickValues } from '../helpers.js'
import {
  shouldLabelsRotate,
  getTickWidth,
  getLongestLabelInPx,
} from '../../../js/Util'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
} from '../../../props/defaults'

export default class ChataColumnChart extends Component {
  constructor(props) {
    super(props)

    this.setChartData(props)
    this.setLongestLabelWidth(props)

    this.rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.longestLabelWidth
    )
    this.prevRotateLabels = this.rotateLabels
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

  componentDidUpdate = (prevProps) => {
    if (
      this.props.marginAdjustmentFinished &&
      prevProps?.data?.length !== this.props.data?.length
    ) {
      this.setLongestLabelWidth(this.props)
    }

    if (this.didLabelsRotate()) {
      this.props.onLabelChange()
    }
  }

  didLabelsRotate = () => {
    const rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.longestLabelWidth
    )

    if (typeof rotateLabels !== 'undefined') {
      this.prevRotateLabels = this.rotateLabels
      this.rotateLabels = rotateLabels
      return this.prevRotateLabels !== this.rotateLabels
    }

    return false
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.labelArray,
      this.props.columns[this.props.stringColumnIndex],
      getDataFormatting(props.dataFormatting)
    )
  }

  setChartData = (props) => {
    const { minValue, maxValue } = getMinAndMaxValues(props.data)
    this.xScale = scaleBand()
      .domain(props.data.map((d) => d[props.labelValue]))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    this.yScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    this.tickWidth = getTickWidth(this.xScale, props.innerPadding)
    this.labelArray = props.data.map((element) => element[props.labelValue])

    this.xTickValues = getTickValues(
      this.tickWidth,
      props.width,
      this.labelArray
    )
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g data-test="react-autoql-column-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          xCol={this.props.columns[this.props.stringColumnIndex]}
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
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          legendLabels={this.legendLabels}
          onLegendClick={this.props.onLegendClick}
          legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
          onLegendTitleClick={this.props.onLegendTitleClick}
          yGridLines
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
          stringColumnIndices={this.props.stringColumnIndices}
          numberColumnIndices={this.props.numberColumnIndices}
          hasXDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleStringColumns
          }
          hasYDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleNumberColumns
          }
          xAxisTitle={this.props.stringAxisTitle}
          yAxisTitle={this.props.numberAxisTitle}
        />
        {this.props.marginAdjustmentFinished && (
          <Columns
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
            labelValue={this.props.labelValue}
            onChartClick={this.props.onChartClick}
            activeKey={this.props.activeChartElementKey}
          />
        )}
      </g>
    )
  }
}
