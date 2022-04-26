import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import {
  calculateMinAndMaxSums,
  shouldLabelsRotate,
  getTickWidth,
  getLongestLabelInPx,
} from '../../../js/Util'

import { getTickValues } from '../helpers'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
} from '../../../props/defaults'
import { themeConfigType, dataFormattingType } from '../../../props/types'

export default class ChataStackedColumnChart extends Component {
  constructor(props) {
    super(props)

    const { xScale, yScale, tickWidth, xTickValues } = this.getScaleData(props)

    this.setLongestLabelWidth(props)

    this.rotateLabels = shouldLabelsRotate(tickWidth, this.longestLabelWidth)
    this.prevRotateLabels = this.rotateLabels

    this.state = {
      xScale,
      yScale,
      tickWidth,
      xTickValues,
    }
  }

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,

    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    tableColumns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    leftMargin: PropTypes.number,
    rightMargin: PropTypes.number,
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    onLabelChange: PropTypes.func,
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
    legendLocation: PropTypes.string,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    leftMargin: 0,
    rightMargin: 0,
    topMargin: 0,
    bottomMargin: 0,
    numberColumnIndices: [],
    legendLocation: undefined,
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

  componentDidUpdate = (prevProps) => {
    if (
      this.props.marginAdjustmentFinished &&
      prevProps?.data?.length !== this.props.data?.length
    ) {
      this.setLongestLabelWidth(this.props)
    }

    if (this.didLabelsRotate()) {
      this.props.onLabelChange()
    }

    if (this.didDimensionsChange(prevProps)) {
      this.setState({
        ...this.getScaleData(this.props, prevProps),
      })
    }
  }

  didDimensionsChange = (prevProps) => {
    return (
      this.didChange('rightMargin', prevProps) ||
      this.didChange('leftMargin', prevProps) ||
      this.didChange('topMargin', prevProps) ||
      this.didChange('bottomMargin', prevProps) ||
      this.didChange('innerPadding', prevProps) ||
      this.didChange('outerPadding', prevProps) ||
      this.didChange('width', prevProps) ||
      this.didChange('height', prevProps)
    )
  }

  didChange = (propName, prevProps) => {
    return this.props[propName] !== prevProps[propName]
  }

  didLabelsRotate = () => {
    const rotateLabels = shouldLabelsRotate(
      this.state.tickWidth,
      this.longestLabelWidth
    )

    if (typeof rotateLabels !== 'undefined') {
      this.prevRotateLabels = this.rotateLabels
      this.rotateLabels = rotateLabels
      return this.prevRotateLabels !== this.rotateLabels
    }

    return false
  }

  setLongestLabelWidth = (props) => {
    this.longestLabelWidth = getLongestLabelInPx(
      this.labelArray,
      props.columns[0],
      getDataFormatting(props.dataFormatting)
    )
  }

  getScaleData = (props, prevProps) => {
    // If size of data didn't change, we don't need to re-calculate max/min
    if (prevProps?.data?.length !== props?.data?.length) {
      this.labelArray = props.data.map((element) => element.label)
      const { maxValue, minValue } = calculateMinAndMaxSums(props.data)
      this.maxValue = maxValue
      this.minValue = minValue
    }

    const xScale = scaleBand()
      .domain(this.labelArray)
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    const yScale = scaleLinear()
      .domain([this.minValue, this.maxValue])
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    const tickWidth = getTickWidth(xScale, props.innerPadding)
    const xTickValues = getTickValues(tickWidth, props.width, this.labelArray)

    return {
      xScale,
      yScale,
      tickWidth,
      xTickValues,
    }
  }

  render = () => {
    return (
      <g data-test="react-autoql-stacked-column-chart">
        <Axes
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.state.xScale, yScale: this.state.yScale }}
          xCol={this.props.columns[0]}
          yCol={_get(
            this.props.tableColumns,
            `[${this.props.numberColumnIndex}]`
          )}
          margins={{
            left: this.props.leftMargin,
            right: this.props.rightMargin,
            bottom: this.props.bottomMargin,
            top: this.props.topMargin,
            bottomLegend: this.props.bottomLegendMargin,
          }}
          width={this.props.width}
          height={this.props.height}
          xTicks={this.state.xTickValues}
          rotateLabels={this.rotateLabels}
          dataFormatting={this.props.dataFormatting}
          hasRightLegend={this.props.legendLocation === 'right'}
          hasBottomLegend={this.props.legendLocation === 'bottom'}
          legendLabels={this.props.legendLabels}
          onLegendClick={this.props.onLegendClick}
          legendTitle={_get(this.props.legendColumn, 'title', 'Category')}
          onLegendTitleClick={this.props.onLegendTitleClick}
          yGridLines
          onXAxisClick={this.props.onXAxisClick}
          onYAxisClick={this.props.onYAxisClick}
          hasXDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleStringColumns
          }
          hasYDropdown={
            this.props.enableDynamicCharting &&
            this.props.hasMultipleNumberColumns
          }
          yAxisTitle={this.props.numberAxisTitle}
        />
        {this.props.marginAdjustmentFinished && (
          <StackedColumns
            xScale={this.state.xScale}
            yScale={this.state.yScale}
            data={this.props.data}
            onChartClick={this.props.onChartClick}
            activeKey={this.props.activeChartElementKey}
          />
        )}
      </g>
    )
  }
}
