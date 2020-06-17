import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleBand } from 'd3-scale'
import { max } from 'd3-array'

import { Axes } from '../Axes'
import { Squares } from '../Squares'
import { onlyUnique, shouldRotateLabels } from '../../../js/Util.js'
import {
  themeConfigDefault,
  dataFormattingDefault,
} from '../../../props/defaults'
import { themeConfigType, dataFormattingType } from '../../../props/types'

export default class ChataHeatmapChart extends Component {
  xScale = scaleBand()
  yScale = scaleBand()

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,

    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    leftMargin: PropTypes.number,
    rightMargin: PropTypes.number,
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    dataValue: PropTypes.string,
    labelValueX: PropTypes.string,
    labelValueY: PropTypes.string,
    onLabelChange: PropTypes.func,
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    leftMargin: 0,
    rightMargin: 0,
    topMargin: 0,
    bottomMargin: 0,
    dataValue: 'value',
    labelValueX: 'labelX',
    labelValueY: 'labelY',
    onXAxisClick: () => {},
    onYAxisClick: () => {},
    onLabelChange: () => {},
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
      leftMargin,
      topMargin,
      dataValue,
      columns,
      height,
      width,
      data,
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
      <g data-test="chata-heatmap-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale, yScale }}
          xCol={legendColumn}
          yCol={columns[0]}
          valueCol={columns[2]}
          margins={{
            left: leftMargin,
            right: rightMargin,
            bottom: bottomMargin,
            top: topMargin,
          }}
          width={width}
          height={height}
          yTicks={yTickValues}
          xTicks={xTickValues}
          dataFormatting={dataFormatting}
          rotateLabels={this.rotateLabels}
          onXAxisClick={onXAxisClick}
          onYAxisClick={onYAxisClick}
        />
        {
          <Squares
            themeConfig={this.props.themeConfig}
            scales={{ xScale, yScale }}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin,
            }}
            data={data}
            columns={columns}
            legendColumn={legendColumn}
            maxValue={maxValue}
            width={width}
            height={height}
            dataValue={dataValue}
            labelValueX={labelValueX}
            labelValueY={labelValueY}
            onChartClick={onChartClick}
            activeKey={activeChartElementKey}
          />
        }
      </g>
    )
  }
}
