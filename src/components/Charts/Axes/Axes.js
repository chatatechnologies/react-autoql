import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

import { Axis } from '../Axis'
import { dataFormattingType, themeConfigType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
} from '../../../props/defaults'

export default class Axes extends React.Component {
  constructor(props) {
    super(props)

    this.labelInlineStyles = {
      fontSize: 12,
      fontFamily: 'inherit',
      fill: 'currentColor',
      fillOpacity: 0.7,
      cursor: 'default',
    }
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,

    scales: PropTypes.shape({}).isRequired,
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    margins: PropTypes.shape({}),
    xTicks: PropTypes.array,
    yTicks: PropTypes.array,
    rotateLabels: PropTypes.bool,
    xCol: PropTypes.shape({}),
    yCol: PropTypes.shape({}),
    xGridLines: PropTypes.bool,
    yGridLines: PropTypes.bool,
    legendLabels: PropTypes.arrayOf(PropTypes.shape({})),
    legendColumn: PropTypes.shape({}),
    hasRightLegend: PropTypes.bool,
    hasBottomLegend: PropTypes.bool,
    onLegendClick: PropTypes.func,
    onXAxisClick: PropTypes.func,
    onYAxisClick: PropTypes.func,
    hasXDropdown: PropTypes.bool,
    hasYDropdown: PropTypes.bool,
    xAxisTitle: PropTypes.string,
    yAxisTitle: PropTypes.string,
    legendTitle: PropTypes.string,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    xCol: {},
    yCol: {},
    xTicks: undefined,
    yTicks: undefined,
    legendTitle: undefined,
    hasRightLegend: false,
    hasBottomLegend: false,
    hasXDropdown: false,
    hasYDropdown: false,
    xAxisTitle: undefined,
    yAxisTitle: undefined,
    legendTitle: undefined,
    margins: {
      right: 0,
      left: 0,
      top: 0,
      bottom: 0,
    },
    onLegendClick: () => {},
    onXAxisClick: () => {},
    onYAxisClick: () => {},
  }

  renderAxisLabel = (title = '', hasDropdown) => {
    if (title.length > 35) {
      return (
        <tspan
          data-tip={title}
          data-for="chart-element-tooltip"
          data-test="axis-label"
        >
          {`${title.substring(0, 35)}...`}
        </tspan>
      )
    }

    return (
      <tspan data-test="axis-label">
        {title}{' '}
        {hasDropdown && (
          <tspan
            className="react-autoql-axis-selector-arrow"
            data-test="dropdown-arrow"
            opacity="0" // use css to style so it isnt exported in the png
            fontSize="8px"
          >
            &#9660;
          </tspan>
        )}
      </tspan>
    )
  }

  getBBoxFromRef = (ref) => {
    try {
      const bbox = ref.getBBox()
      return bbox
    } catch (error) {
      return undefined
    }
  }

  renderXLabelDropdown = (xLabelX, xLabelY) => {
    const xLabelBbox = this.getBBoxFromRef(this.xLabelRef)
    const xLabelWidth = xLabelBbox ? xLabelBbox.width : 0
    const xLabelHeight = xLabelBbox ? xLabelBbox.height : 0

    return (
      <rect
        className="x-axis-label-border"
        data-test="x-axis-label-border"
        x={xLabelX - 10 - xLabelWidth / 2}
        y={xLabelY - 16}
        width={xLabelWidth + 20}
        height={xLabelHeight + 10}
        onClick={this.props.onXAxisClick}
        fill="transparent"
        stroke="transparent"
        strokeWidth="1px"
        rx="4"
      />
    )
  }

  renderYLabelDropdown = (yLabelX, yLabelY) => {
    const yLabelBbox = this.getBBoxFromRef(this.yLabelRef)
    const yLabelWidth = yLabelBbox ? yLabelBbox.width : 0
    const yLabelHeight = yLabelBbox ? yLabelBbox.height : 0

    return (
      <rect
        className="y-axis-label-border"
        data-test="y-axis-label-border"
        x={yLabelX - yLabelWidth / 2 - 10}
        y={yLabelY - 16}
        width={yLabelWidth + 20}
        height={yLabelHeight + 10}
        transform="rotate(-90)"
        onClick={this.props.onYAxisClick}
        fill="transparent"
        stroke="transparent"
        strokeWidth="1px"
        rx="4"
      />
    )
  }

  renderXAxisLabel = (xAxisTitle) => {
    const xLabelX =
      (this.props.width - this.props.margins.left) / 2 + this.props.margins.left
    const xLabelY =
      this.props.height - (this.props.margins.bottomLegend || 0) - 15

    return (
      <g>
        <text
          ref={(r) => (this.xLabelRef = r)}
          className="x-axis-label"
          data-test="x-axis-label"
          textAnchor="middle"
          fontWeight="bold"
          y={xLabelY}
          x={xLabelX}
          style={this.labelInlineStyles}
        >
          {this.renderAxisLabel(xAxisTitle, this.props.hasXDropdown)}
        </text>
        {this.props.hasXDropdown && this.renderXLabelDropdown(xLabelX, xLabelY)}
      </g>
    )
  }

  renderYAxisLabel = (yAxisTitle) => {
    const yLabelY = 20
    const yLabelX = -((this.props.height - this.props.margins.bottom) / 2)

    return (
      <g>
        <text
          ref={(r) => (this.yLabelRef = r)}
          className="y-axis-label"
          data-test="y-axis-label"
          textAnchor="middle"
          transform="rotate(-90)"
          fontWeight="bold"
          x={yLabelX}
          y={yLabelY}
          style={this.labelInlineStyles}
        >
          {this.renderAxisLabel(yAxisTitle, this.props.hasYDropdown)}
        </text>
        {this.props.hasYDropdown && this.renderYLabelDropdown(yLabelX, yLabelY)}
      </g>
    )
  }

  renderXAxis = (xAxisTitle) => {
    return (
      <Axis
        orient="Bottom"
        scale={_get(this.props, 'scales.xScale')}
        translate={`translate(0, ${this.props.height -
          this.props.margins.bottom})`}
        rotateLabels={this.props.rotateLabels}
        tickSizeInner={
          -this.props.height +
          this.props.margins.top +
          this.props.margins.bottom
        }
        ticks={this.props.xTicks}
        height={this.props.height}
        width={this.props.width - this.props.margins.right}
        margins={this.props.margins}
        col={this.props.xCol}
        title={xAxisTitle}
        showGridLines={this.props.xGridLines}
        hasRightLegend={this.props.hasRightLegend}
        hasBottomLegend={this.props.hasBottomLegend}
        legendLabels={this.props.legendLabels}
        legendColumn={this.props.legendColumn}
        dataFormatting={this.props.dataFormatting}
        themeConfig={this.props.themeConfig}
        onLegendClick={this.props.onLegendClick}
        onLegendTitleClick={this.props.onLegendTitleClick}
        legendTitle={this.props.legendTitle}
      />
    )
  }

  renderYAxis = (yAxisTitle) => {
    return (
      <Axis
        orient="Left"
        scale={_get(this.props, 'scales.yScale')}
        translate={`translate(${this.props.margins.left}, 0)`}
        tickSizeInner={
          -this.props.width + this.props.margins.left + this.props.margins.right
        }
        ticks={this.props.yTicks}
        height={this.props.height}
        width={this.props.width - this.props.margins.right}
        margins={this.props.margins}
        col={this.props.yCol}
        title={yAxisTitle}
        showGridLines={this.props.yGridLines}
        dataFormatting={this.props.dataFormatting}
        themeConfig={this.props.themeConfig}
        onLegendClick={this.props.onLegendClick}
      />
    )
  }

  render = () => {
    if (
      !_get(this.props, 'scales.yScale') ||
      !_get(this.props, 'scales.xScale') ||
      !this.props.height ||
      !this.props.width
    ) {
      return null
    }

    const xAxisTitle = this.props.xAxisTitle || this.props.xCol.title
    const yAxisTitle = this.props.yAxisTitle || this.props.yCol.title

    return (
      <g>
        {this.renderYAxisLabel(yAxisTitle)}
        {this.renderXAxisLabel(xAxisTitle)}
        <g className="react-autoql-axes" data-test="react-autoql-axes">
          {this.renderXAxis(xAxisTitle)}
          {this.renderYAxis(yAxisTitle)}
        </g>
      </g>
    )
  }
}
