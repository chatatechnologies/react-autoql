import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedLines } from '../StackedLines'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'

import { calculateMinAndMaxSums, shouldRotateLabels } from '../../../js/Util'
import { getTickValues } from '../helpers'

export default class ChataStackedLineChart extends Component {
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
    onLabelChange: PropTypes.func,
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
      this.props.columns[0],
      this.props.dataFormatting
    )

    if (prevRotateLabels && prevRotateLabels !== this.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  render = () => {
    const {
      onLegendTitleClick,
      activeChartElementKey,
      enableDynamicCharting,
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
      .domain(data.map(d => d.label))
      .range([leftMargin, width - rightMargin])
      .paddingInner(1)
      .paddingOuter(0)

    const yScale = this.yScale
      // .domain([min, max])
      .domain([0, max]) // do we want to deal with negative values for these visualizations?
      .range([height - bottomMargin, topMargin])
      .nice()

    const labelArray = data.map(element => element.label)
    const tickWidth = Math.abs(xScale(data[0].label) - xScale(data[1].label))
    const xTickValues = getTickValues(tickWidth, this.props.width, labelArray)
    this.handleLabelRotation(tickWidth, labelArray)

    return (
      <g data-test="chata-stacked-column-chart">
        <Axes
          scales={{ xScale, yScale }}
          xCol={columns[0]}
          yCol={columns[numberColumnIndex]}
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
          rotateLabels={this.rotateLabels}
          dataFormatting={dataFormatting}
          hasRightLegend={legendLocation === 'right'}
          hasBottomLegend={legendLocation === 'bottom'}
          legendLabels={legendLabels}
          onLegendClick={onLegendClick}
          legendTitle={_get(legendColumn, 'display_name')}
          onLegendTitleClick={onLegendTitleClick}
          chartColors={chartColors}
          yGridLines
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
          // hasXDropdown={enableDynamicCharting && hasMultipleStringColumns}
          // hasYDropdown={enableDynamicCharting && hasMultipleNumberColumns}
          hasXDropdown={enableDynamicCharting}
          yAxisTitle={numberAxisTitle}
        />
        <StackedLines
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
          legendTitle={legendColumn.display_name}
          // minValue={min}
          minValue={0} // change to min if we want to account for negative values at some point
        />
      </g>
    )
  }
}
