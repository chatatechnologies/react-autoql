import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Bars } from '../Bars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues, getTickValues } from '../helpers.js'
import { shouldRotateLabels } from '../../../js/Util'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'

export default class ChataBarChart extends Component {
  xScale = scaleLinear()
  yScale = scaleBand()

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
      bottomLegendMargin,
      numberColumnIndex,
      stringColumnIndex,
      numberAxisTitle,
      stringAxisTitle,
      dataFormatting,
      legendLocation,
      onLegendClick,
      legendColumn,
      onXAxisClick,
      onYAxisClick,
      legendLabels,
      innerPadding,
      outerPadding,
      bottomMargin,
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
      .domain([minValue, maxValue])
      .range([leftMargin, width - rightMargin])
      .nice()

    const yScale = this.yScale
      .domain(data.map((d) => d[labelValue]))
      .range([height - bottomMargin, topMargin])
      .paddingInner(innerPadding)
      .paddingOuter(outerPadding)

    const yLabelArray = data.map((element) => element[labelValue])
    const xLabelArray = data.map((element) => element.cells[numberColumnIndex])
    const tickWidth = (width - leftMargin - rightMargin) / xScale.ticks().length
    const barHeight = height / data.length
    const yTickValues = getTickValues(barHeight, this.props.height, yLabelArray)
    this.handleLabelRotation(tickWidth, xLabelArray)

    return (
      <g data-test="react-autoql-bar-chart">
        <Axes
          themeConfig={themeConfig}
          scales={{ xScale, yScale }}
          xCol={columns[numberColumnIndex]}
          yCol={columns[stringColumnIndex]}
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
          legendTitle={_get(legendColumn, 'title', 'Category')}
          onLegendTitleClick={onLegendTitleClick}
          legendLabels={legendLabels}
          onLegendClick={onLegendClick}
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
          hasXDropdown={enableDynamicCharting && hasMultipleNumberColumns}
          hasYDropdown={enableDynamicCharting && hasMultipleStringColumns}
          xAxisTitle={numberAxisTitle}
          yAxisTitle={stringAxisTitle}
          xGridLines
        />
        {
          <Bars
            themeConfig={getThemeConfig(this.props.themeConfig)}
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
            activeKey={activeChartElementKey}
          />
        }
      </g>
    )
  }
}
