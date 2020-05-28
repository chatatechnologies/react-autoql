import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleBand } from 'd3-scale'
import { max } from 'd3-array'

import { Axes } from '../Axes'
import { Circles } from '../Circles'
import { shouldRotateLabels } from '../../../js/Util.js'

export default class ChataHeatmapChart extends Component {
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
    onLabelChange: () => {}
  }

  handleLabelRotation = labelArray => {
    const prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      this.squareWidth,
      labelArray,
      this.props.columns[0],
      this.props.dataFormatting
    )

    if (prevRotateLabels && prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  getXTickValues = labelArray => {
    try {
      const interval = Math.ceil(
        (this.props.data.length * 16) / this.props.width
      ) // we should take into account the outer padding here
      let xTickValues

      if (this.squareWidth < 16) {
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
      dataFormatting,
      onXAxisClick,
      onYAxisClick,
      legendColumn,
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

    const maxValue = max(data, d => max(d.cells, cell => cell.value))

    const uniqueYLabels = data.map(d => d.label)
    const yScale = this.xScale
      .domain(uniqueYLabels)
      .range([height - bottomMargin, topMargin])
      .paddingInner(0.01)

    const uniqueXLabels = data[0].cells.map(cell => cell.label)
    const xScale = this.yScale
      .domain(uniqueXLabels)
      .range([leftMargin, width - rightMargin])
      .paddingInner(0.01)

    this.squareWidth = xScale.bandwidth()
    const xTickValues = this.getXTickValues(uniqueXLabels)
    const yTickValues = this.getYTickValues(uniqueYLabels)
    this.handleLabelRotation(uniqueXLabels)

    return (
      <g data-test="chata-bubble-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={legendColumn}
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
          dataFormatting={dataFormatting}
          rotateLabels={this.rotateLabels}
          chartColors={chartColors}
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
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
            columns={columns}
            maxValue={maxValue}
            legendColumn={legendColumn}
            width={width}
            height={height}
            dataValue={dataValue}
            labelValueX={labelValueX}
            labelValueY={labelValueY}
            onChartClick={onChartClick}
            chartColors={chartColors}
            activeKey={activeChartElementKey}
          />
        }
      </g>
    )
  }
}
