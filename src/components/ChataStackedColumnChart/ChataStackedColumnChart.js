import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale'

import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { calculateMinAndMaxSums, onlyUnique } from '../../js/Util'

export default class ChataStackedColumnChart extends Component {
  yScale = scaleLinear()
  xScale = scaleBand()

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
      .domain(this.uniqueYLabels)
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

    const { max, min } = calculateMinAndMaxSums(data, labelValueY, dataValue)

    const xScale = this.xScale
      .domain(this.uniqueYLabels)
      .range([leftMargin, width - rightMargin])
      .paddingInner(0.1)

    const yScale = this.yScale
      .domain([min, max])
      .range([height - bottomMargin, topMargin])

    const barWidth = width / this.uniqueYLabels.length
    const interval = Math.ceil((this.uniqueYLabels.length * 16) / width)
    let xTickValues
    if (barWidth < 16) {
      xTickValues = []
      this.uniqueYLabels.forEach((element, index) => {
        if (index % interval === 0) {
          xTickValues.push(element[labelValueY])
        }
      })
    }

    return (
      <ErrorBoundary>
        <g>
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
            rotateLabels={barWidth < 135}
            legendLabels={this.uniqueXLabels}
            legendColumn={columns[0]}
            currencyCode={currencyCode}
            languageCode={languageCode}
            chartColors={chartColors}
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
            uniqueYLabels={this.uniqueYLabels}
            uniqueXLabels={this.uniqueXLabels}
            width={width}
            height={height}
            labelValueX={labelValueX}
            labelValueY={labelValueY}
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
