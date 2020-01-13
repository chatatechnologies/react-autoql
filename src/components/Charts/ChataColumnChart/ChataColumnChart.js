import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Columns } from '../Columns'
import { scaleLinear, scaleBand } from 'd3-scale'

import { getMinAndMaxValues } from '../helpers.js'

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
    tooltipFormatter: () => {}
  }

  render = () => {
    const {
      activeChartElementKey,
      bottomLegendMargin,
      tooltipFormatter,
      onLegendClick,
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
      .paddingInner(0.5)
      .paddingOuter(2)

    const yScale = this.yScale
      .domain([minValue, maxValue])
      .range([height - bottomMargin, topMargin])

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

    return (
      <g data-test="chata-column-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[0]}
          yCol={columns[1]}
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
          rotateLabels={barWidth < 135}
          dataFormatting={this.props.dataFormatting}
          hasBottomLegend={data[0].origRow.length > 2}
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
