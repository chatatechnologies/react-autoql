import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale'

import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import {
  calculateMinAndMaxSums,
  onlyUnique,
  shouldRotateLabels
} from '../../../js/Util'

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

    this.legendLabels = this.uniqueXLabels.map(label => {
      return {
        label,
        color: this.legendScale(label)
      }
    })
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
    onLabelChange: PropTypes.func,
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
    dataValues: 'values',
    labelValue: 'label',
    dataFormatting: {},
    onLabelChange: () => {},
    tooltipFormatter: () => {}
  }

  state = {}

  handleLabelRotation = (tickWidth, labelArray) => {
    const prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      tickWidth,
      labelArray,
      this.props.columns[2],
      this.props.dataFormatting
    )

    if (prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  getTickValues = barHeight => {
    try {
      const interval = Math.ceil(
        (this.uniqueYLabels.length * 16) / this.props.height
      )
      let yTickValues
      if (barHeight < 16) {
        yTickValues = []
        this.uniqueYLabels.forEach((element, index) => {
          if (index % interval === 0) {
            yTickValues.push(element)
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
      tooltipFormatter,
      onChartClick,
      rightMargin,
      leftMargin,
      topMargin,
      bottomMargin,
      innerPadding,
      outerPadding,
      dataValue,
      labelValueX,
      labelValueY,
      dataFormatting,
      chartColors,
      columns,
      height,
      width,
      data
    } = this.props

    const { max, min } = calculateMinAndMaxSums(data, labelValueY, dataValue)

    const xScale = this.xScale
      .domain([min, max])
      .range([leftMargin, width - rightMargin])

    const yScale = this.yScale
      .domain(this.uniqueYLabels)
      .range([height - bottomMargin, topMargin])
      .paddingInner(innerPadding)
      .paddingOuter(outerPadding)

    const tickWidth = (width - leftMargin - rightMargin) / xScale.ticks().length
    const barHeight = height / this.uniqueYLabels.length
    const yTickValues = this.getTickValues(barHeight)
    this.handleLabelRotation(tickWidth, this.uniqueYLabels)

    return (
      <ErrorBoundary>
        <g data-test="chata-stacked-bar-chart">
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
            dataFormatting={dataFormatting}
            chartColors={chartColors}
            xGridLines
            legendLabels={this.legendLabels}
            legendColumn={columns[0]}
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
            activeKey={activeChartElementKey}
          />
        </g>
      </ErrorBoundary>
    )
  }
}
