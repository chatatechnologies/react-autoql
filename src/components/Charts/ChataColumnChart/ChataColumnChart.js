import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues } from '../helpers.js'
import { shouldRotateLabels, getTickWidth } from '../../../js/Util'

export default class ChataBarChart extends Component {
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

  getTickValues = (tickWidth, labelArray) => {
    try {
      const interval = Math.ceil(
        (this.props.data.length * 16) / this.props.width
      ) // we should take into account the outer padding here
      let xTickValues

      if (tickWidth < 16) {
        xTickValues = []
        labelArray.forEach((label, index) => {
          if (index % interval === 0) {
            xTickValues.push(label)
          }
        })
      }

      return xTickValues
    } catch (error) {
      console.error(error)
      return []
    }
  }

  render = () => {
    const {
      activeChartElementKey,
      bottomLegendMargin,
      tooltipFormatter,
      onLegendClick,
      innerPadding,
      outerPadding,
      chartColors,
      bottomMargin,
      onChartClick,
      legendLabels,
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

    const labelArray = data.map(element => element[labelValue])
    const tickWidth = getTickWidth(xScale, innerPadding)
    const xTickValues = this.getTickValues(tickWidth, labelArray)
    this.handleLabelRotation(tickWidth, labelArray)

    return (
      <g data-test="chata-column-chart">
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
          dataFormatting={this.props.dataFormatting}
          hasRightLegend={data[0].origRow.length > 3}
          hasBottomLegend={
            data[0].origRow.length === 2 || data[0].origRow.length === 3
          }
          bottomLegendWidth={this.props.bottomLegendWidth}
          legendLabels={legendLabels}
          onLegendClick={onLegendClick}
          chartColors={chartColors}
          yGridLines
        />
        <Columns
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
          activeKey={activeChartElementKey}
        />
      </g>
    )
  }
}
