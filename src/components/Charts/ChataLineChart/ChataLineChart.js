import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Line } from '../Line'
import { scaleLinear, scaleBand } from 'd3-scale'

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
      activeChartElementKey,
      bottomLegendMargin,
      bottomLegendWidth,
      tooltipFormatter,
      backgroundColor,
      dataFormatting,
      onLegendClick,
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
          xCol={columns[this.props.stringColumnIndex]}
          yCol={columns[this.props.numberColumnIndices[0]]}
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
          bottomLegendWidth={bottomLegendWidth}
          legendLabels={legendLabels}
          hasRightLegend={data[0].origRow.length > 3}
          hasBottomLegend={
            data[0].origRow.length === 2 || data[0].origRow.length === 3
          }
          onLegendClick={onLegendClick}
          chartColors={chartColors}
          yGridLines
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
