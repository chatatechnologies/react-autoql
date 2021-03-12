import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Line } from '../Line'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues, getTickValues } from '../helpers.js'
import { shouldRotateLabels, getTickWidth } from '../../../js/Util'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'

export default class ChataLineChart extends Component {
  xScale = scaleBand()
  yScale = scaleLinear()

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

  componentDidUpdate = () => {
    if (
      typeof this.prevRotateLabels !== 'undefined' &&
      this.prevRotateLabels !== this.rotateLabels
    ) {
      this.props.onLabelChange()
    }
  }

  handleLabelRotation = (tickWidth, labelArray) => {
    this.prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      tickWidth,
      labelArray,
      this.props.columns[this.props.stringColumnIndex],
      getDataFormatting(this.props.dataFormatting)
    )
  }

  render = () => {
    const {
      hasMultipleStringColumns,
      hasMultipleNumberColumns,
      activeChartElementKey,
      enableDynamicCharting,
      onLegendTitleClick,
      bottomLegendMargin,
      stringColumnIndex,
      numberColumnIndex,
      numberAxisTitle,
      stringAxisTitle,
      backgroundColor,
      legendLocation,
      dataFormatting,
      onLegendClick,
      legendColumn,
      onXAxisClick,
      onYAxisClick,
      innerPadding,
      bottomMargin,
      legendLabels,
      onChartClick,
      themeConfig,
      rightMargin,
      leftMargin,
      labelValue,
      topMargin,
      columns,
      height,
      width,
      data,
    } = this.props

    // Get max and min values from all series
    const { minValue, maxValue } = getMinAndMaxValues(data)

    const xScale = this.xScale
      .domain(data.map((d) => d[labelValue]))
      .range([leftMargin, width - rightMargin])
      .paddingInner(innerPadding)
      .paddingOuter(0.1)

    const yScale = this.yScale
      .domain([minValue, maxValue])
      .range([height - bottomMargin, topMargin])
      .nice()

    const labelArray = data.map((element) => element[labelValue])
    const tickWidth = getTickWidth(xScale, innerPadding)
    const xTickValues = getTickValues(tickWidth, this.props.width, labelArray)
    this.handleLabelRotation(tickWidth, labelArray)

    return (
      <g data-test="react-autoql-line-chart">
        <Axes
          themeConfig={themeConfig}
          scales={{ xScale, yScale }}
          xCol={columns[stringColumnIndex]}
          yCol={columns[numberColumnIndex]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
            bottomLegend: bottomLegendMargin,
          }}
          width={width}
          height={height}
          xTicks={xTickValues}
          rotateLabels={this.rotateLabels}
          dataFormatting={dataFormatting}
          legendLabels={legendLabels}
          hasRightLegend={legendLocation === 'right'}
          hasBottomLegend={legendLocation === 'bottom'}
          legendTitle={_get(legendColumn, 'title', 'Category')}
          onLegendTitleClick={onLegendTitleClick}
          onLegendClick={onLegendClick}
          yGridLines
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
          hasXDropdown={enableDynamicCharting && hasMultipleStringColumns}
          hasYDropdown={enableDynamicCharting && hasMultipleNumberColumns}
          yAxisTitle={numberAxisTitle}
          xAxisTitle={stringAxisTitle}
        />
        <Line
          themeConfig={themeConfig}
          scales={{ xScale, yScale }}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
          }}
          data={data}
          maxValue={maxValue}
          width={width}
          height={height}
          labelValue={labelValue}
          onChartClick={onChartClick}
          backgroundColor={backgroundColor}
          activeKey={activeChartElementKey}
        />
      </g>
    )
  }
}
