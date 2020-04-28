import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Line } from '../Line'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues } from '../helpers.js'
import { shouldRotateLabels, getTickWidth } from '../../../js/Util'

export default class ChataLineChart extends Component {
  xScale = scaleBand()
  yScale = scaleLinear()

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    leftMargin: PropTypes.number.isRequired,
    rightMargin: PropTypes.number.isRequired,
    topMargin: PropTypes.number.isRequired,
    bottomMargin: PropTypes.number.isRequired,
    chartColors: PropTypes.arrayOf(PropTypes.string).isRequired,
    labelValue: PropTypes.string,
    tooltipFormatter: PropTypes.func,
    onLegendClick: PropTypes.func,
    onLabelChange: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
    legendLocation: PropTypes.string,
    dataFormatting: PropTypes.shape({
      currencyCode: PropTypes.string,
      languageCode: PropTypes.string,
      currencyDecimals: PropTypes.number,
      quantityDecimals: PropTypes.number,
      comparisonDisplay: PropTypes.string,
      monthYearFormat: PropTypes.string,
      dayMonthYearFormat: PropTypes.string
    })
  }

  static defaultProps = {
    labelValue: 'label',
    dataFormatting: {},
    numberColumnIndices: [],
    legendLocation: undefined,
    onXAxisClick: () => {},
    onYAxisClick: () => {},
    onLabelChange: () => {},
    tooltipFormatter: () => {}
  }

  handleLabelRotation = (tickWidth, labelArray) => {
    const prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      tickWidth,
      labelArray,
      this.props.columns[this.props.stringColumnIndex],
      this.props.dataFormatting
    )

    if (prevRotateLabels && prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  render = () => {
    const {
      hasMultipleStringColumns,
      hasMultipleNumberColumns,
      activeChartElementKey,
      enableAxisSelection,
      bottomLegendMargin,
      stringColumnIndex,
      numberColumnIndex,
      tooltipFormatter,
      numberAxisTitle,
      backgroundColor,
      legendLocation,
      dataFormatting,
      onLegendClick,
      onXAxisClick,
      onYAxisClick,
      innerPadding,
      outerPadding,
      bottomMargin,
      legendLabels,
      onChartClick,
      chartColors,
      rightMargin,
      leftMargin,
      labelValue,
      topMargin,
      columns,
      height,
      width,
      data
    } = this.props

    // Get max and min values from all series
    const { minValue, maxValue } = getMinAndMaxValues(data)

    const xScale = this.xScale
      .domain(data.map(d => d[labelValue]))
      .range([leftMargin, width - rightMargin])
      .paddingInner(innerPadding)
      .paddingOuter(outerPadding)

    const yScale = this.yScale
      .domain([minValue, maxValue])
      .range([height - bottomMargin, topMargin])
      .nice()

    const barWidth = width / data.length
    const interval = Math.ceil((data.length * 16) / width)
    let xTickValues
    if (barWidth < 16) {
      xTickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          xTickValues.push(element[labelValue])
        }
      })
    }

    const labelArray = data.map(element => element[labelValue])
    const tickWidth = getTickWidth(xScale, innerPadding)
    this.handleLabelRotation(tickWidth, labelArray)

    return (
      <g data-test="chata-line-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[stringColumnIndex]}
          yCol={columns[numberColumnIndex]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
            bottomLegend: bottomLegendMargin
          }}
          width={width}
          height={height}
          xTicks={xTickValues}
          rotateLabels={this.rotateLabels}
          dataFormatting={dataFormatting}
          legendLabels={legendLabels}
          hasRightLegend={legendLocation === 'right'}
          hasBottomLegend={legendLocation === 'bottom'}
          onLegendClick={onLegendClick}
          chartColors={chartColors}
          yGridLines
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
          hasXDropdown={enableAxisSelection && hasMultipleStringColumns}
          hasYDropdown={enableAxisSelection && hasMultipleNumberColumns}
          yAxisTitle={numberAxisTitle}
        />
        <Line
          scales={{ xScale, yScale }}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin
          }}
          data={data}
          maxValue={maxValue}
          width={width}
          height={height}
          labelValue={labelValue}
          onChartClick={onChartClick}
          tooltipFormatter={tooltipFormatter}
          chartColors={chartColors}
          backgroundColor={backgroundColor}
          activeKey={activeChartElementKey}
        />
      </g>
    )
  }
}
