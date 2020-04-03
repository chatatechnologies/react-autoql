import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Bars } from '../Bars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues } from '../helpers.js'
import { shouldRotateLabels } from '../../../js/Util'

export default class ChataBarChart extends Component {
  xScale = scaleLinear()
  yScale = scaleBand()

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
      this.props.columns[1],
      this.props.dataFormatting
    )

    if (prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  getTickValues = (barHeight, labelArray) => {
    try {
      const interval = Math.ceil(
        (this.props.data.length * 16) / this.props.height
      )
      let yTickValues

      if (barHeight < 16) {
        yTickValues = []
        labelArray.forEach((label, index) => {
          if (index % interval === 0) {
            yTickValues.push(label)
          }
        })
      }

      return yTickValues
    } catch (error) {
      console.error(error)
      return []
    }
  }

  render = () => {
    const {
      activeChartElementKey,
      bottomLegendMargin,
      bottomLegendWidth,
      tooltipFormatter,
      onLegendClick,
      legendLabels,
      innerPadding,
      outerPadding,
      chartColors,
      bottomMargin,
      onChartClick,
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
      .domain([minValue, maxValue])
      .range([leftMargin, width - rightMargin])
      .nice()

    const yScale = this.yScale
      .domain(data.map(d => d[labelValue]))
      .range([height - bottomMargin, topMargin])
      .paddingInner(innerPadding)
      .paddingOuter(outerPadding)

    const labelArray = data.map(element => element[labelValue])
    const tickWidth = (width - leftMargin - rightMargin) / 6
    const barHeight = height / data.length
    const yTickValues = this.getTickValues(barHeight, labelArray)
    this.handleLabelRotation(tickWidth, labelArray)

    return (
      <g data-test="chata-bar-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[this.props.numberColumnIndices[0]]}
          yCol={columns[this.props.stringColumnIndex]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
            bottomLegend: bottomLegendMargin
          }}
          width={width}
          height={height}
          yTicks={yTickValues}
          rotateLabels={this.rotateLabels}
          dataFormatting={this.props.dataFormatting}
          hasBottomLegend={data[0].origRow.length > 2}
          bottomLegendWidth={bottomLegendWidth}
          legendLabels={legendLabels}
          onLegendClick={onLegendClick}
          chartColors={chartColors}
          xGridLines
        />
        {
          <Bars
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
        }
      </g>
    )
  }
}
