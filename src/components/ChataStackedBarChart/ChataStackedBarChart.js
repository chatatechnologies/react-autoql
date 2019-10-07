import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale'

import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  getMaxValueFromKeyValueObj,
  getMinValueFromKeyValueObj,
  onlyUnique
} from '../../js/Util'

export default class ChataStackedBarChart extends Component {
  xScale = scaleLinear()
  yScale = scaleBand()

  constructor(props) {
    super(props)

    // Only calculate these things one time. They will never change
    const { data, labelValueX, labelValueY, chartColors } = props

    this.uniqueYLabels = data
      .map(d => d[labelValueY])
      .filter(onlyUnique)
      .sort()
      .reverse() // sorts dates correctly

    this.uniqueXLabels = data.map(d => d[labelValueX]).filter(onlyUnique)

    this.legendScale = scaleOrdinal()
      .domain(this.uniqueXLabels)
      .range(chartColors)
  }

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
    dataValues: PropTypes.string,
    labelValue: PropTypes.string,
    tooltipFormatter: PropTypes.func,
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string
  }

  static defaultProps = {
    dataValues: 'values',
    labelValue: 'label',
    currencyCode: undefined,
    languageCode: undefined,
    tooltipFormatter: () => {}
  }

  state = {}

  calculateMinAndMaxSums = (data, labelValueY, dataValue) => {
    const positiveSumsObject = {}
    const negativeSumsObject = {}

    // Loop through data array to get maximum and minimum sums of postive and negative values
    // These will be used to get the max and min values for the x Scale (data values)
    for (let i = 0; i < data.length; i++) {
      const value = data[i][dataValue]

      if (value >= 0) {
        // Calculate positive sum
        if (positiveSumsObject[data[i][labelValueY]]) {
          positiveSumsObject[data[i][labelValueY]] += value
        } else {
          positiveSumsObject[data[i][labelValueY]] = value
        }
      } else if (value < 0) {
        // Calculate negative sum
        if (negativeSumsObject[data[i][labelValueY]]) {
          negativeSumsObject[data[i][labelValueY]] -= value
        } else {
          negativeSumsObject[data[i][labelValueY]] = value
        }
      }
    }

    // Get max and min sums from those sum objects
    const maxValue = getMaxValueFromKeyValueObj(positiveSumsObject)
    const minValue = getMinValueFromKeyValueObj(negativeSumsObject)

    return {
      max: maxValue,
      min: minValue
    }
  }

  render = () => {
    const {
      tooltipFormatter,
      onChartClick,
      rightMargin,
      leftMargin,
      topMargin,
      bottomMargin,
      dataValue,
      labelValueX,
      labelValueY,
      currencyCode,
      languageCode,
      chartColors,
      columns,
      height,
      width,
      data
    } = this.props

    const { max, min } = this.calculateMinAndMaxSums(
      data,
      labelValueY,
      dataValue
    )

    const xScale = this.xScale
      .domain([min, max])
      .range([leftMargin, width - rightMargin])

    const yScale = this.yScale
      .domain(this.uniqueYLabels)
      .range([height - bottomMargin, topMargin])
      .paddingInner(0.1)

    const tickWidth = (width - leftMargin - rightMargin) / 6

    const barHeight = height / this.uniqueYLabels.length
    const interval = Math.ceil((this.uniqueYLabels.length * 16) / height)
    let yTickValues
    if (barHeight < 16) {
      yTickValues = []
      this.uniqueYLabels.forEach((element, index) => {
        if (index % interval === 0) {
          yTickValues.push(element[labelValueY])
        }
      })
    }

    return (
      <ErrorBoundary>
        <g>
          <Axes
            scales={{ xScale, yScale }}
            xCol={columns[2]}
            yCol={columns[1]}
            // valueCol={columns[2]}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            width={width}
            height={height}
            yTicks={yTickValues}
            rotateLabels={tickWidth < 135}
            legendLabels={this.uniqueXLabels}
            legendColumn={columns[0]}
            currencyCode={currencyCode}
            languageCode={languageCode}
            chartColors={chartColors}
            xGridLines
            hasRightLegend
          />
          <StackedBars
            scales={{ xScale, yScale }}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            data={data}
            maxValue={max}
            uniqueYLabels={this.uniqueYLabels}
            uniqueXLabels={this.uniqueXLabels}
            width={width}
            height={height}
            labelValueX={labelValueY}
            labelValueY={labelValueX}
            dataValue={dataValue}
            onChartClick={onChartClick}
            tooltipFormatter={tooltipFormatter}
            legendColumn={columns[0]}
            legendScale={this.legendScale}
            chartColors={chartColors}
          />
        </g>
      </ErrorBoundary>
    )
  }
}
