import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { calculateMinAndMaxSums, shouldRotateLabels } from '../../../js/Util'
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

    this.state = this.getNewState(props)
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

  componentDidUpdate = (prevProps) => {
    if (
      this.props.width !== prevProps.width ||
      this.props.height !== prevProps.height ||
      this.props.leftMargin !== prevProps.leftMargin ||
      this.props.rightMargin !== prevProps.rightMargin ||
      this.props.topMargin !== prevProps.topMargin ||
      this.props.bottomMargin !== prevProps.bottomMargin ||
      this.props.numberColumnIndex !== prevProps.numberColumnIndex ||
      this.props.innerPadding !== prevProps.innerPadding ||
      this.props.outerPadding !== prevProps.outerPadding
    ) {
      this.setState({ ...this.getNewState(this.props) })
    }

    if (
      typeof this.prevRotateLabels !== 'undefined' &&
      this.prevRotateLabels !== this.rotateLabels
    ) {
      this.props.onLabelChange()
    }
  }

  getNewState = (props) => {
    const { max, min } = calculateMinAndMaxSums(props.data)
    return {
      xScale: scaleLinear()
        .domain([min, max])
        .range([props.leftMargin, props.width - props.rightMargin])
        .nice(),

      yScale: scaleBand()
        .domain(props.data.map((d) => d.label))
        .range([props.height - props.bottomMargin, props.topMargin])
        .paddingInner(props.innerPadding)
        .paddingOuter(props.outerPadding),

      yLabelArray: props.data.map((element) => element.label),
      xLabelArray: props.data.map(
        (element) => element.cells[props.numberColumnIndex]
      ),
    }
  }

  handleLabelRotation = (tickWidth, labelArray) => {
    this.prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      tickWidth,
      labelArray,
      this.props.columns[this.props.numberColumnIndex],
      getDataFormatting(this.props.dataFormatting)
    )
  }

  render = () => {
    const {
      hasMultipleNumberColumns,
      hasMultipleStringColumns,
      activeChartElementKey,
      enableDynamicCharting,
      onLegendTitleClick,
      numberColumnIndices,
      stringColumnIndices,
      bottomLegendMargin,
      numberColumnIndex,
      numberAxisTitle,
      dataFormatting,
      legendLocation,
      onLegendClick,
      tableColumns,
      legendColumn,
      bottomMargin,
      onChartClick,
      legendLabels,
      onXAxisClick,
      onYAxisClick,
      themeConfig,
      rightMargin,
      leftMargin,
      topMargin,
      columns,
      height,
      width,
    } = this.props

    const tickWidth =
      (width - leftMargin - rightMargin) / this.state.xScale.ticks().length
    const barHeight = height / this.props.data.length
    const yTickValues = getTickValues(
      barHeight,
      this.props.height,
      this.state.yLabelArray
    )
    this.handleLabelRotation(tickWidth, this.state.xLabelArray)

    return (
      <g data-test="react-autoql-stacked-bar-chart">
        <Axes
          themeConfig={themeConfig}
          scales={{ xScale: this.state.xScale, yScale: this.state.yScale }}
          xCol={_get(tableColumns, `[${numberColumnIndex}]`)}
          yCol={columns[0]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
            bottomLegend: bottomLegendMargin,
          }}
          width={width}
          height={height}
          yTicks={yTickValues}
          rotateLabels={this.rotateLabels}
          dataFormatting={dataFormatting}
          hasRightLegend={legendLocation === 'right'}
          hasBottomLegend={legendLocation === 'bottom'}
          legendLabels={legendLabels}
          onLegendClick={onLegendClick}
          legendTitle={_get(legendColumn, 'title', 'Category')}
          onLegendTitleClick={onLegendTitleClick}
          enableDynamicCharting={enableDynamicCharting}
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
          stringColumnIndices={stringColumnIndices}
          numberColumnIndices={numberColumnIndices}
          hasXDropdown={enableDynamicCharting && hasMultipleNumberColumns}
          hasYDropdown={enableDynamicCharting && hasMultipleStringColumns}
          xAxisTitle={numberAxisTitle}
          xGridLines
        />
        <StackedBars
          themeConfig={themeConfig}
          scales={{ xScale: this.state.xScale, yScale: this.state.yScale }}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
          }}
          data={this.props.data}
          width={width}
          height={height}
          onChartClick={onChartClick}
          activeKey={activeChartElementKey}
        />
      </g>
    )
  }
}
