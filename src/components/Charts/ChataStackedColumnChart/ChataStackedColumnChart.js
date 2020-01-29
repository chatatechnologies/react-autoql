import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale'

import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import {
  calculateMinAndMaxSums,
  onlyUnique,
  shouldRotateLabels,
  getTickWidth
} from '../../../js/Util'

export default class ChataStackedColumnChart extends Component {
  yScale = scaleLinear()
  xScale = scaleBand()

  constructor(props) {
    super(props)

    // Only calculate these things one time. They will never change
    const { data, labelValueY, labelValueX, chartColors } = props

    this.uniqueXLabels = data
      .map(d => d[labelValueX])
      .filter(onlyUnique)
      .sort()
      .reverse() // sorts dates correctly

    this.uniqueYLabels = data.map(d => d[labelValueY]).filter(onlyUnique)

    this.legendScale = scaleOrdinal()
      .domain(this.uniqueXLabels)
      .range(chartColors)

    this.legendLabels = this.uniqueYLabels.map((label, i) => {
      return {
        label,
        color: this.legendScale(i)
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
      this.props.columns[1],
      this.props.dataFormatting
    )

    if (prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  getXTickValues = barWidth => {
    try {
      const interval = Math.ceil(
        (this.uniqueXLabels.length * 16) / this.props.width
      )
      let xTickValues
      if (barWidth < 16) {
        xTickValues = []
        this.uniqueXLabels.forEach((element, index) => {
          if (index % interval === 0) {
            xTickValues.push(element)
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
      tooltipFormatter,
      onChartClick,
      rightMargin,
      leftMargin,
      topMargin,
      bottomMargin,
      innerPadding,
      outerPadding,
      dataValue,
      labelValueY,
      labelValueX,
      dataFormatting,
      chartColors,
      columns,
      height,
      width,
      data
    } = this.props

    const { max, min } = calculateMinAndMaxSums(data, labelValueX, dataValue)

    const xScale = this.xScale
      .domain(this.uniqueXLabels)
      .range([leftMargin, width - rightMargin])
      .paddingInner(innerPadding)
      .paddingOuter(outerPadding)

    const yScale = this.yScale
      .domain([min, max])
      .range([height - bottomMargin, topMargin])

    const tickWidth = getTickWidth(xScale, innerPadding)
    const xTickValues = this.getXTickValues(tickWidth)
    this.handleLabelRotation(tickWidth, this.uniqueXLabels)

    return (
      <ErrorBoundary>
        <g data-test="chata-stacked-column-chart">
          <Axes
            scales={{ xScale, yScale }}
            xCol={columns[1]}
            yCol={columns[2]}
            // valueCol={columns[2]}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            width={width}
            height={height}
            xTicks={xTickValues}
            rotateLabels={this.rotateLabels}
            legendColumn={columns[0]}
            dataFormatting={dataFormatting}
            chartColors={chartColors}
            legendColumn={columns[0]}
            legendLabels={this.legendLabels}
            legendScale={this.legendScale}
            hasRightLegend
            yGridLines
            hasLegend
          />
          <StackedColumns
            scales={{ xScale, yScale }}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            data={data}
            maxValue={max}
            uniqueYLabels={this.uniqueXLabels}
            uniqueXLabels={this.uniqueYLabels}
            width={width}
            height={height}
            labelValueY={labelValueX}
            labelValueX={labelValueY}
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
