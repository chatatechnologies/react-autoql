import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Axes } from '../Axes'
import { StackedColumns } from '../StackedColumns'
import { scaleLinear, scaleBand } from 'd3-scale'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import {
  calculateMinAndMaxSums,
  shouldRotateLabels,
  getTickWidth,
} from '../../../js/Util'

import { getTickValues } from '../helpers'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'
import { themeConfigType, dataFormattingType } from '../../../props/types'

export default class ChataStackedColumnChart extends Component {
  constructor(props) {
    super(props)
    this.labelArray = props.data.map((element) => element.label)
    const { max, min } = calculateMinAndMaxSums(props.data)
    this.max = max
    this.min = min

    this.state = {
      ...this.getNewState(props),
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

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.state.tickWidth !== prevState.tickWidth ||
      !_isEqual(this.props.columns[0], prevProps.columns[0])
    ) {
      const rotateLabels = shouldRotateLabels(
        this.state.tickWidth,
        this.labelArray,
        this.props.columns[0],
        getDataFormatting(this.props.dataFormatting)
      )

      if (rotateLabels !== prevState.rotateLabels) {
        this.props.onLabelChange()
        this.setState({ rotateLabels })
      }
    } else if (
      this.props.width !== prevProps.width ||
      this.props.height !== prevProps.height ||
      this.props.leftMargin !== prevProps.leftMargin ||
      this.props.rightMargin !== prevProps.rightMargin ||
      this.props.topMargin !== prevProps.topMargin ||
      this.props.bottomMargin !== prevProps.bottomMargin ||
      this.props.numberColumnIndex !== prevProps.numberColumnIndex ||
      this.props.innerPadding !== prevProps.innerPadding ||
      this.props.outerPadding !== prevProps.outerPadding
    ) {
      this.setState({ ...this.getNewState(this.props) })
    }
  }

  getNewState = (props) => {
    const xScale = scaleBand()
      .domain(props.data.map((d) => d.label))
      .range([props.leftMargin, props.width - props.rightMargin])
      .paddingInner(props.innerPadding)
      .paddingOuter(props.outerPadding)

    const yScale = scaleLinear()
      .domain([this.min, this.max])
      .range([props.height - props.bottomMargin, props.topMargin])
      .nice()

    const tickWidth = getTickWidth(xScale, props.innerPadding)
    const xTickValues = getTickValues(tickWidth, props.width, this.labelArray)

    const rotateLabels = shouldRotateLabels(
      tickWidth,
      this.labelArray,
      props.columns[0],
      getDataFormatting(props.dataFormatting)
    )

    return {
      rotateLabels,
      xTickValues,
      tickWidth,
      xScale,
      yScale,
    }
  }

  render = () => {
    // if (this.props.isResizing || this.props.isAnimatingContainer) {
    //   return null
    // }

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
          rotateLabels={this.state.rotateLabels}
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
        <StackedColumns
          themeConfig={this.props.themeConfig}
          scales={{ xScale: this.state.xScale, yScale: this.state.yScale }}
          margins={{
            left: this.props.leftMargin,
            right: this.props.rightMargin,
            bottom: this.props.bottomMargin,
            top: this.props.topMargin,
          }}
          data={this.props.data}
          width={this.props.width}
          height={this.props.height}
          onChartClick={this.props.onChartClick}
          activeKey={this.props.activeChartElementKey}
          isResizing={this.props.isResizing || this.props.isAnimatingContainer}
        />
      </g>
    )
  }
}
