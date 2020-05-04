import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedBars } from '../StackedBars'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import {
  calculateMinAndMaxSums,
  shouldRotateLabels,
  getTickWidth
} from '../../../js/Util'

export default class ChataStackedBarChart extends Component {
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
    onLabelChange: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
    legendLocation: PropTypes.string,
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
    dataFormatting: {},
    numberColumnIndices: [],
    legendLocation: undefined,
    onXAxisClick: () => {},
    onYAxisClick: () => {},
    onLabelChange: () => {}
  }

  handleLabelRotation = (tickWidth, labelArray) => {
    const prevRotateLabels = this.rotateLabels
    this.rotateLabels = shouldRotateLabels(
      tickWidth,
      labelArray,
      this.props.columns[this.props.numberColumnIndex],
      this.props.dataFormatting
    )

    if (prevRotateLabels && prevRotateLabels !== this.rotateLabels) {
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
      enableDynamicCharting,
      onLegendTitleClick,
      numberColumnIndices,
      stringColumnIndices,
      bottomLegendMargin,
      numberColumnIndex,
      numberAxisTitle,
      dataFormatting,
      legendLocation,
      onLegendClick,
      legendColumn,
      innerPadding,
      outerPadding,
      bottomMargin,
      onChartClick,
      legendLabels,
      onXAxisClick,
      onYAxisClick,
      chartColors,
      rightMargin,
      leftMargin,
      topMargin,
      columns,
      height,
      width,
      data
    } = this.props

    // Get max and min values from all series
    const { max, min } = calculateMinAndMaxSums(data)

    const xScale = this.xScale
      .domain([min, max])
      .range([leftMargin, width - rightMargin])
      .nice()

    const yScale = this.yScale
      .domain(data.map(d => d.label))
      .range([height - bottomMargin, topMargin])
      .paddingInner(innerPadding)
      .paddingOuter(outerPadding)

    const yLabelArray = data.map(element => element.label)
    const xLabelArray = data.map(element => element.cells[numberColumnIndex])
    const tickWidth = (width - leftMargin - rightMargin) / xScale.ticks().length
    const barHeight = height / data.length
    const yTickValues = this.getTickValues(barHeight, yLabelArray)
    this.handleLabelRotation(tickWidth, xLabelArray)

    return (
      <g data-test="chata-stacked-bar-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[numberColumnIndex]}
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
          rotateLabels={this.rotateLabels}
          dataFormatting={dataFormatting}
          hasRightLegend={legendLocation === 'right'}
          hasBottomLegend={legendLocation === 'bottom'}
          legendLabels={legendLabels}
          onLegendClick={onLegendClick}
          legendTitle={_get(legendColumn, 'display_name')}
          onLegendTitleClick={onLegendTitleClick}
          enableDynamicCharting={enableDynamicCharting}
          chartColors={chartColors}
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
          stringColumnIndices={stringColumnIndices}
          numberColumnIndices={numberColumnIndices}
          // hasXDropdown={enableDynamicCharting && hasMultipleNumberColumns}
          // hasYDropdown={enableDynamicCharting && hasMultipleStringColumns}
          hasYDropdown={enableDynamicCharting}
          xAxisTitle={numberAxisTitle}
          xGridLines
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
          width={width}
          height={height}
          onChartClick={onChartClick}
          chartColors={chartColors}
          activeKey={activeChartElementKey}
        />
      </g>
    )
  }
}
