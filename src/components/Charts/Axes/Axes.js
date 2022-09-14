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
    this.textLineHeight = 16
    this.axisLabelPaddingTop = 5
    this.axisLabelPaddingLeft = 10

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
          data-for={this.props.tooltipID}
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
            positions={['top', 'bottom']}
            align="center"
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
    const chartBoundingRect =
      this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.yLabelRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0
    const yLabelWidth = yLabelBoundingRect?.width ?? 0
    const yLabelTop = yLabelBoundingRect?.top
    const chartTop = chartBoundingRect?.top

    // X and Y are switched from the rotation (anchored in the middle)
    let yLabelY = this.textLineHeight
    let yLabelX = -((chartContainerHeight - this.props.bottomMargin) / 2)

    if (yAxisTitle !== this.previousYAxisTitle) {
      // Label changed, reset all svg transforms
      this.originalYLabelHeight = undefined
      this.yLabelTransform = undefined
      this.topDifference = undefined
      this.justChangedYLabel = true
    } else if (this.justChangedYLabel) {
      this.originalYLabelHeight = yLabelHeight
      this.justChangedYLabel = false
    }
    this.previousYAxisTitle = yAxisTitle

    let textLength
    if (this.originalYLabelHeight > chartContainerHeight) {
      // Squeeze text to fit in full height
      this.yLabelTransform = `rotate(-90)`
      this.topDifference = undefined
      yLabelX = -(chartContainerHeight / 2)
      textLength = Math.floor(
        chartContainerHeight - this.props.chartContainerPadding
      )
    } else if (yLabelTop < chartTop) {
      // Y Label can fit, it is just outside of container. Shift it down
      const prevTopDifference = this.topDifference ?? 0
      const topDifference = Math.floor(
        yLabelTop - chartTop - this.axisLabelPaddingLeft
      )

      this.topDifference = topDifference + prevTopDifference
      this.yLabelTransform = `rotate(-90) translate(${this.topDifference}, 0)`
    }

    const transform = this.yLabelTransform || `rotate(-90)`
    return (
      <g>
        <text
          ref={(r) => (this.yLabelRef = r)}
          id={`y-axis-label-${this.yAxisKey}`}
          className="y-axis-label"
          data-test="y-axis-label"
          textAnchor="middle"
          fontWeight="bold"
          transform={transform}
          x={yLabelX}
          y={yLabelY}
          textLength={textLength}
          lengthAdjust="spacingAndGlyphs"
          style={this.labelInlineStyles}
        >
          {this.renderAxisLabel(yAxisTitle, this.props.hasYDropdown)}
        </text>
        {this.props.hasYDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.yCol}
            positions={['right']}
            align="center"
            childProps={{
              transform,
              width: yLabelHeight + this.axisLabelPaddingLeft * 2,
              height: yLabelWidth + this.axisLabelPaddingTop * 2,
              x: yLabelX - yLabelHeight / 2 - this.axisLabelPaddingLeft,
              y: 0,
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
        translate={`translate(0, ${
          this.props.height - this.props.bottomMargin
        })`}
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
      !this.props.width ||
      !this.props.xCol ||
      !this.props.yCol
    ) {
      return null
    }

    const xAxisTitle = this.props.xAxisTitle || this.props.xCol?.display_name
    const yAxisTitle = this.props.yAxisTitle || this.props.yCol?.display_name

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
