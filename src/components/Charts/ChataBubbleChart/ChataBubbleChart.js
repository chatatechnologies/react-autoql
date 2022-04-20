import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { scaleBand } from 'd3-scale'
import { max, min } from 'd3-array'

import { Axes } from '../Axes'
import { Circles } from '../Circles'
import { shouldLabelsRotate } from '../../../js/Util.js'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'

export default class ChataBubbleChart extends Component {
  constructor(props) {
    super(props)
    this.setChartData(props)
  }

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

  componentDidMount = () => {
    this.props.onLabelChange()
  }

  shouldComponentUpdate = () => {
    return true
  }

  componentDidUpdate = () => {
    if (this.didLabelsRotate()) {
      this.props.onLabelChange()
    }
  }

  didLabelsRotate = () => {
    const rotateLabels = shouldLabelsRotate(
      this.squareWidth,
      this.uniqueXLabels,
      this.props.columns[0],
      getDataFormatting(this.props.dataFormatting)
    )

    if (typeof rotateLabels !== 'undefined') {
      this.prevRotateLabels = this.rotateLabels
      this.rotateLabels = rotateLabels
      return this.prevRotateLabels !== this.rotateLabels
    }

    return false
  }

  setChartData = (props) => {
    this.maxValue = max(props.data, (d) => max(d.cells, (cell) => cell.value))
    this.minValue = min(props.data, (d) => min(d.cells, (cell) => cell.value))
    this.uniqueXLabels = props.data.map((d) => d.label)
    this.uniqueYLabels = props.data[0].cells.map((cell) => cell.label)

    this.xScale = scaleBand()
      .domain(this.uniqueXLabels)
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingOuter(0.5)

    this.yScale = scaleBand()
      .domain(this.uniqueYLabels)
      .range([props.height - props.bottomMargin, props.topMargin])

    this.squareWidth = this.xScale.bandwidth()

    this.xTickValues = this.getXTickValues()
    this.yTickValues = this.getYTickValues()
  }

  getXTickValues = () => {
    try {
      const interval = Math.ceil(
        (this.props.data.length * 16) / this.props.width
      ) // we should take into account the outer padding here
      let xTickValues

      if (this.squareWidth < 16) {
        xTickValues = []
        this.uniqueXLabels.forEach((label, index) => {
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

  getYTickValues = () => {
    this.squareHeight = this.props.height / this.uniqueYLabels.length
    const intervalHeight = Math.ceil(
      (this.uniqueYLabels.length * 16) / this.props.height
    )

    try {
      let yTickValues
      if (this.squareHeight < 16) {
        yTickValues = []
        this.uniqueYLabels.forEach((element, index) => {
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
    this.setChartData(this.props)

    return (
      <g
        className="react-autoql-bubble-chart"
        data-test="react-autoql-bubble-chart"
      >
        <Axes
          themeConfig={getThemeConfig(this.props.themeConfig)}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          xCol={this.props.columns[0]}
          yCol={this.props.legendColumn}
          valueCol={this.props.columns[2]}
          margins={{
            left: this.props.leftMargin,
            right: this.props.rightMargin,
            bottom: this.props.bottomMargin,
            top: this.props.topMargin,
          }}
          width={this.props.width}
          height={this.props.height}
          yTicks={this.yTickValues}
          xTicks={this.xTickValues}
          yGridLines
          dataFormatting={this.props.dataFormatting}
          rotateLabels={this.rotateLabels}
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
        />
        <Circles
          themeConfig={getThemeConfig(this.props.themeConfig)}
          scales={{ xScale: this.xScale, yScale: this.yScale }}
          margins={{
            left: this.props.leftMargin,
            right: this.props.rightMargin,
            bottom: this.props.bottomMargin,
            top: this.props.topMargin,
          }}
          data={this.props.data}
          columns={this.props.columns}
          minValue={this.minValue}
          maxValue={this.maxValue}
          legendColumn={this.props.legendColumn}
          width={this.props.width}
          height={this.props.height}
          dataValue={this.props.dataValue}
          labelValueX={this.props.labelValueX}
          labelValueY={this.props.labelValueY}
          onChartClick={this.props.onChartClick}
          activeKey={this.props.activeChartElementKey}
        />
      </g>
    )
  }
}
