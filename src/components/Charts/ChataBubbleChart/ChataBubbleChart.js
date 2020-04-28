import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleBand } from 'd3-scale'
import { max } from 'd3-array'

import { Axes } from '../Axes'
import { Circles } from '../Circles'
import { onlyUnique, shouldRotateLabels } from '../../../js/Util.js'

export default class ChataBubbleChart extends Component {
  xScale = scaleBand()
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
    dataValue: PropTypes.string,
    labelValueX: PropTypes.string,
    labelValueY: PropTypes.string,
    tooltipFormatter: PropTypes.func,
    onLabelChange: PropTypes.func,
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
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
    dataValue: 'value',
    labelValueX: 'labelX',
    labelValueY: 'labelY',
    dataFormatting: {},
    onXAxisClick: () => {},
    onYAxisClick: () => {},
    onLabelChange: () => {},
    tooltipFormatter: () => {}
  }

  handleLabelRotation = labelArray => {
    const prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      this.squareWidth,
      labelArray,
      this.props.columns[1],
      this.props.dataFormatting
    )

    if (prevRotateLabels && prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  getXTickValues = uniqueXLabels => {
    try {
      this.squareWidth = this.props.width / uniqueXLabels.length
      const intervalWidth = Math.ceil(
        (uniqueXLabels.length * 16) / this.props.width
      )

      let xTickValues
      if (this.squareWidth < 16) {
        xTickValues = []
        uniqueXLabels.forEach((element, index) => {
          if (index % intervalWidth === 0) {
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

  getYTickValues = uniqueYLabels => {
    this.squareHeight = this.props.height / uniqueYLabels.length
    const intervalHeight = Math.ceil(
      (uniqueYLabels.length * 16) / this.props.height
    )

    try {
      let yTickValues
      if (this.squareHeight < 16) {
        yTickValues = []
        uniqueYLabels.forEach((element, index) => {
          if (index % intervalHeight === 0) {
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
      bottomMargin,
      rightMargin,
      labelValueY,
      labelValueX,
      chartColors,
      leftMargin,
      topMargin,
      dataValue,
      columns,
      height,
      width,
      data
    } = this.props

    const maxValue = max(data, d => d[dataValue])

    const uniqueXLabels = data
      .map(d => d[labelValueX])
      .filter(onlyUnique)
      .sort()
      .reverse() // sorts dates correctly

    const xScale = this.xScale
      .domain(uniqueXLabels)
      .rangeRound([width - rightMargin, leftMargin])
      .paddingInner(0)

    const uniqueYLabels = data.map(d => d[labelValueY]).filter(onlyUnique)
    const yScale = this.yScale
      .domain(uniqueYLabels)
      .rangeRound([height - bottomMargin, topMargin])
      .paddingInner(0)

    const xTickValues = this.getXTickValues(uniqueXLabels)
    const yTickValues = this.getYTickValues(uniqueYLabels)
    this.handleLabelRotation(uniqueXLabels)

    return (
      <g data-test="chata-bubble-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[1]}
          yCol={columns[0]}
          valueCol={columns[2]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin
          }}
          width={width}
          height={height}
          yTicks={yTickValues}
          xTicks={xTickValues}
          dataFormatting={this.props.dataFormatting}
          rotateLabels={this.rotateLabels}
          chartColors={chartColors}
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
        />
        {
          <Circles
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
            dataValue={dataValue}
            labelValueX={labelValueX}
            labelValueY={labelValueY}
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
