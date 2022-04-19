import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import {
  calculateMinAndMaxSums,
  shouldLabelsRotate,
  getTickWidth,
} from '../../../js/Util'

import { getTickValues } from '../helpers'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'
import { themeConfigType, dataFormattingType } from '../../../props/types'

export default class ChataStackedColumnChart extends Component {
  constructor(props) {
    super(props)
    this.setChartData(props)
  }

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,

    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    tableColumns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    leftMargin: PropTypes.number,
    rightMargin: PropTypes.number,
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    onLabelChange: PropTypes.func,
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

  componentDidUpdate = () => {
    if (this.didLabelsRotate()) {
      this.props.onLabelChange()
    }
  }

  didLabelsRotate = () => {
    const rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.labelArray,
      this.props.columns[0],
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
    const { maxValue, minValue } = calculateMinAndMaxSums(props.data)
    this.maxValue = maxValue
    this.minValue = minValue

    this.xScale = scaleBand()
      .domain(props.data.map((d) => d.label))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    this.yScale = scaleLinear()
      .domain([this.minValue, this.maxValue])
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    this.labelArray = props.data.map((element) => element.label)
    this.tickWidth = getTickWidth(this.xScale, props.innerPadding)
    this.xTickValues = getTickValues(
      this.tickWidth,
      props.width,
      this.labelArray
    )

    this.rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.labelArray,
      props.columns[0],
      getDataFormatting(props.dataFormatting)
    )
  }

  render = () => {
    this.setChartData(this.props)

    return (
      <g data-test="react-autoql-stacked-column-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          xCol={this.props.columns[0]}
          yCol={_get(
            this.props.tableColumns,
            `[${this.props.numberColumnIndex}]`
          )}
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
          legendLabels={this.props.legendLabels}
          onLegendClick={this.props.onLegendClick}
          legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
          onLegendTitleClick={this.props.onLegendTitleClick}
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
        />
        <StackedColumns
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
          isResizing={this.props.isResizing || this.props.isAnimatingContainer}
        />
      </g>
    )
  }
}
