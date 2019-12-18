import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { Bars } from '../Bars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { getMinAndMaxValues } from '../Charts/helpers.js'

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
      bottomLegendWidth,
      tooltipFormatter,
      onLegendClick,
      legendLabels,
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

    const yScale = this.yScale
      .domain(data.map(d => d[labelValue]))
      .range([height - bottomMargin, topMargin])
      .paddingInner(0.1)

    const tickWidth = (width - leftMargin - rightMargin) / 6

    const barHeight = height / data.length
    const interval = Math.ceil((data.length * 16) / height)
    let yTickValues
    if (barHeight < 16) {
      yTickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          yTickValues.push(element[labelValue])
        }
      })
    }

    return (
      <g>
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[1]}
          yCol={columns[0]}
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
          rotateLabels={tickWidth < 135}
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
