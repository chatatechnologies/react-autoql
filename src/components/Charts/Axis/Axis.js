import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'

import AxisScaler from './AxisScaler'

import { formatChartLabel } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes, mergeBboxes } from '../helpers.js'

import './Axis.scss'

export default class Axis extends Component {
  constructor(props) {
    super(props)

    this.LEGEND_PADDING = 130
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.swatchElements = []
  }

  static propTypes = {
    ...axesPropTypes,
    scale: PropTypes.func.isRequired,
    col: PropTypes.shape({}).isRequired,
    ticks: PropTypes.array,
    orient: PropTypes.string,
    tickSizeInner: PropTypes.number,
    translate: PropTypes.string,
  }

  static defaultProps = {
    ...axesDefaultProps,
    orient: 'Bottom',
    ticks: undefined,
    tickSizeInner: undefined,
    translate: undefined,
  }

  componentDidMount = () => {
    this.renderAxis()
    this.props.onLabelChange()
  }

  componentDidUpdate = (prevProps) => {
    this.renderAxis()

    if (this.props.rotateLabels !== prevProps.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  styleAxisScalerBorder = () => {
    select(this.axisScaler)
      .attr('class', 'axis-scaler-border')
      .attr('transform', this.props.translate)
      .attr('width', _get(this.labelBBox, 'width', 0) + this.BUTTON_PADDING * 2)
      .attr('height', _get(this.labelBBox, 'height', 0) + this.BUTTON_PADDING * 2)
      .attr('x', _get(this.labelBBox, 'x', 0) - this.BUTTON_PADDING)
      .attr('y', _get(this.labelBBox, 'y', 0) - this.BUTTON_PADDING)
      .attr('stroke', 'transparent')
      .attr('stroke-width', '1px')
      .attr('fill', 'transparent')
      .attr('rx', 4)
  }

  renderAxis = () => {
    const self = this
    let axis
    switch (this.props.orient) {
      case 'Bottom': {
        axis = axisBottom()
        break
      }
      case 'Left': {
        axis = axisLeft()
        break
      }
      case 'Right': {
        axis = axisRight()
        break
      }
      case 'Top': {
        axis = axisTop()
        break
      }
      default: {
        break
      }
    }

    axis
      .scale(this.props.scale)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        return formatChartLabel({
          d,
          col: self.props.col,
          config: self.props.dataFormatting,
        }).formattedLabel
      })

    if (this.props.ticks?.length) {
      axis.tickValues(this.props.ticks)
    }

    if (this.props.showGridLines) {
      axis.tickSizeInner(this.props.tickSizeInner)
    }

    if (this.axisElement) {
      select(this.axisElement).call(axis)
    }

    if (this.props.orient === 'Bottom' && this.props.rotateLabels) {
      // translate labels slightly to line up with ticks once rotated
      select(this.axisElement)
        .selectAll('.tick text')
        .style('transform', 'rotate(-45deg)')
        .style('text-anchor', 'end')
        .attr('dy', '0.5em')
        .attr('dx', '-0.5em')
        .attr('fill-opacity', '1')
        .style('font-family', 'inherit')
    } else if (this.props.orient === 'Bottom' && !this.props.rotateLabels) {
      select(this.axisElement)
        .selectAll('.tick text')
        .style('transform', 'rotate(0deg)')
        .style('text-anchor', 'middle')
        .attr('dy', '10px')
        .attr('dx', '0')
        .attr('fill-opacity', '1')
        .style('font-family', 'inherit')
    }

    select(this.axisElement)
      .selectAll('.axis text')
      .style('fill', 'currentColor')
      .style('fill-opacity', '1')
      .style('font-family', 'inherit')
      .attr('data-for', this.props.chartTooltipID)
      .attr('data-tip', function (d) {
        const { fullWidthLabel, isTruncated } = formatChartLabel({
          d,
          col: self.props.col,
          config: self.props.dataFormatting,
        })
        if (isTruncated) {
          return fullWidthLabel
        }
        return null
      })
      .attr('data-effect', 'float')

    select(this.axisElement).selectAll('.axis path').style('display', 'none')

    select(this.axisElement)
      .selectAll('.axis line')
      .style('stroke-width', '1px')
      .style('stroke', 'currentColor')
      .style('opacity', '0.08')
      .style('shape-rendering', 'crispedges')

    // Make tick line at 0 darker
    select(this.axisElement)
      .selectAll('g.tick')
      .filter((d) => d == 0)
      .select('line')
      .style('opacity', 0.3)

    if (this.props.scale?.type === 'LINEAR' && this.axisElement) {
      // svg coordinate system is different from clientRect coordinate system
      // we need to get the deltas first, then we can apply them to the bounding rect
      const axisBBox = this.axisElement.getBBox()
      const axisBoundingRect = this.axisElement.getBoundingClientRect()

      const xDiff = axisBoundingRect.x - axisBBox.x
      const yDiff = axisBoundingRect.y - axisBBox.y

      const labelBboxes = []
      select(this.axisElement)
        .selectAll('g.tick text')
        .each(function () {
          const textBoundingRect = select(this).node().getBoundingClientRect()
          const textBBox = {
            left: textBoundingRect.left - xDiff,
            bottom: textBoundingRect.bottom - yDiff,
            right: textBoundingRect.right - xDiff,
            top: textBoundingRect.top - yDiff,
          }

          labelBboxes.push(textBBox)
        })

      if (labelBboxes) {
        const allLabelsBbox = mergeBboxes(labelBboxes)
        this.labelBBox = allLabelsBbox
      }
      this.styleAxisScalerBorder()
    }
  }

  render = () => {
    const numSeries = this.props.numberColumnIndices?.length || 0
    const legendDx = (this.LEGEND_PADDING * (numSeries - 1)) / 2
    const marginLeft = this.props.leftMargin || 0

    let legendClippingHeight =
      this.props.height -
      this.props.topMargin -
      // make legend smaller if labels are not rotated
      // because they might overlap the legend
      (!this.props.rotateLabels ? this.props.bottomMargin : 44) + // distance to bottom of axis labels
      20
    if (legendClippingHeight < 0) {
      legendClippingHeight = 0
    }

    return (
      <g data-test='axis'>
        <g
          className={`axis axis-${this.props.orient}
        ${this.props.rotateLabels ? ' rotated' : ''}`}
          ref={(el) => {
            this.axisElement = el
          }}
          transform={this.props.translate}
        />
        {!!this.labelBBox && this.props.scale?.type === 'LINEAR' && this.props.scale?.domain().length !== 1 && (
          <AxisScaler
            {...this.props}
            positions={['top', 'bottom']}
            align='center'
            childProps={{
              ref: (r) => (this.axisScaler = r),
              x: _get(this.labelBBox, 'x', 0) - this.BUTTON_PADDING,
              y: _get(this.labelBBox, 'y', 0) - this.BUTTON_PADDING,
              width: _get(this.labelBBox, 'width', 0) + this.BUTTON_PADDING * 2,
              height: _get(this.labelBBox, 'height', 0) + this.BUTTON_PADDING * 2,
            }}
          />
        )}
      </g>
    )
  }
}
