import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedLines } from '../StackedLines'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import {
  calculateMinAndMaxSums,
  shouldLabelsRotate,
  getLongestLabelInPx,
} from '../../../js/Util'
import { getTickValues } from '../helpers'
import { dataFormattingType, themeConfigType } from '../../../props/types'
import {
  dataFormattingDefault,
  themeConfigDefault,
  getDataFormatting,
} from '../../../props/defaults'

export default class ChataStackedLineChart extends Component {
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

  componentDidUpdate = (prevProps) => {
    if (
      this.props.marginAdjustmentFinished &&
      prevProps?.data?.length !== this.props.data?.length
    ) {
      this.setLongestLabelWidth(this.props)
    }
  }

  setLabelRotationValue = (props) => {
    const rotateLabels = shouldLabelsRotate(
      this.tickWidth,
      this.longestLabelWidth
    )

    if (typeof rotateLabels !== 'undefined') {
      this.rotateLabels = rotateLabels
    }
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.labelArray,
      this.props.columns[0],
      getDataFormatting(props.dataFormatting)
    )
  }

  setChartData = (props) => {
    const { maxValue, minValue } = calculateMinAndMaxSums(props.data)
    this.maxValue = maxValue
    this.minValue = minValue

    this.xScale = scaleBand()
      .domain(props.data.map((d) => d.label))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(1)
      .paddingOuter(0)

    this.yScale = scaleLinear()
      .domain([this.minValue, this.maxValue]) // do we want to deal with negative values for these visualizations?
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    this.labelArray = props.data.map((element) => element.label)
    this.tickWidth = Math.abs(
      this.xScale(_get(props.data, '[0].label')) -
        this.xScale(_get(props.data, '[1].label'))
    )
    this.xTickValues = getTickValues(
      this.tickWidth,
      props.width,
      this.labelArray
    )
  }

  render = () => {
    this.setChartData(this.props)
    this.setLabelRotationValue(this.props)

    return (
      <g data-test="react-autoql-stacked-line-chart">
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
          onLabelChange={this.props.onLabelChange}
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
          hasXDropdown={this.props.enableDynamicCharting}
          yAxisTitle={this.props.numberAxisTitle}
        />
        {this.props.marginAdjustmentFinished && (
          <StackedLines
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
            legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
            minValue={0} // change to min if we want to account for negative values at some point
          />
        )}
      </g>
    )
  }
}
