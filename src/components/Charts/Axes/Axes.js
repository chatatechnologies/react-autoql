import React from 'react'
import _get from 'lodash.get'
import { v4 as uuid } from 'uuid'

import { Axis } from '../Axis'
import AxisSelector from './AxisSelector'
import { getBBoxFromRef } from '../../../js/Util'
import { axesDefaultProps, axesPropTypes } from '../helpers'

export default class Axes extends React.Component {
  constructor(props) {
    super(props)

    this.xAxisKey = uuid()
    this.yAxisKey = uuid()

    this.labelInlineStyles = {
      fontSize: 12,
      fontFamily: 'inherit',
      fill: 'currentColor',
      fillOpacity: 0.7,
      cursor: 'default',
    }
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  componentDidMount = () => {
    this.props.onLabelChange()
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
        {title}
        {hasDropdown && (
          <tspan
            className="react-autoql-axis-selector-arrow"
            data-test="dropdown-arrow"
            opacity="0" // use css to style so it isnt exported in the png
            fontSize="8px"
          >
            {' '}
            &#9660;
          </tspan>
        )}
      </tspan>
    )
  }

  renderXAxisLabel = (xAxisTitle) => {
    const xLabelX =
      (this.props.width - this.props.leftMargin) / 2 + this.props.leftMargin
    const xLabelY =
      this.props.height - (this.props.bottomLegendMargin || 0) - 15
    const xLabelBbox = getBBoxFromRef(this.xLabelRef)
    const xLabelWidth = xLabelBbox ? xLabelBbox.width : 0
    const xLabelHeight = xLabelBbox ? xLabelBbox.height : 0

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
        {this.props.hasXDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.xCol}
            position="top"
            align="end"
            childProps={{
              x: xLabelX - xLabelWidth / 2 - 10,
              y: xLabelY - 16,
              width: xLabelWidth + 20,
              height: xLabelHeight + 10,
            }}
          />
        )}
      </g>
    )
  }

  renderYAxisLabel = (yAxisTitle) => {
    const yLabelY = 20
    const yLabelX = -((this.props.height - this.props.bottomMargin) / 2)
    const yLabelBbox = getBBoxFromRef(this.yLabelRef)
    const yLabelWidth = yLabelBbox ? yLabelBbox.width : 0
    const yLabelHeight = yLabelBbox ? yLabelBbox.height : 0

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
        {this.props.hasYDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.yCol}
            position="right"
            align="center"
            childProps={{
              x: yLabelX - yLabelWidth / 2 - 10,
              y: yLabelY - 16,
              width: yLabelWidth + 20,
              height: yLabelHeight + 10,
              transform: 'rotate(-90)',
            }}
          />
        )}
      </g>
    )
  }

  renderXAxis = (xAxisTitle) => {
    return (
      <Axis
        {...this.props}
        key={this.xAxisKey}
        orient="Bottom"
        scale={this.props.xScale}
        translate={`translate(0, ${this.props.height -
          this.props.bottomMargin})`}
        tickSizeInner={
          -this.props.height + this.props.topMargin + this.props.bottomMargin
        }
        ticks={this.props.xTicks}
        width={this.props.width - this.props.rightMargin}
        col={this.props.xCol}
        title={xAxisTitle}
        showGridLines={this.props.xGridLines}
      />
    )
  }

  renderYAxis = (yAxisTitle) => {
    return (
      <Axis
        {...this.props}
        key={this.yAxisKey}
        orient="Left"
        scale={this.props.yScale}
        translate={`translate(${this.props.leftMargin}, 0)`}
        tickSizeInner={
          -this.props.width + this.props.leftMargin + this.props.rightMargin
        }
        ticks={this.props.yTicks}
        height={this.props.height}
        width={this.props.width - this.props.rightMargin}
        col={this.props.yCol}
        title={yAxisTitle}
        showGridLines={this.props.yGridLines}
      />
    )
  }

  render = () => {
    if (
      !this.props.yScale ||
      !this.props.xScale ||
      !this.props.height ||
      !this.props.width
    ) {
      return null
    }

    const xAxisTitle = this.props.xAxisTitle || this.props.xCol.display_name
    const yAxisTitle = this.props.yAxisTitle || this.props.yCol.display_name

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
