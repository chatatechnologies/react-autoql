import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'
import dayjs from 'dayjs'

import { select } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'
import { legendColor } from 'd3-svg-legend'
import { symbol, symbolCircle } from 'd3-shape'
import { scaleOrdinal } from 'd3-scale'

import { formatChartLabel } from '../../js/Util.js'

import './Axis.css'

export default class Axis extends Component {
  LEGEND_PADDING = 130

  static propTypes = {
    chartColors: PropTypes.arrayOf(PropTypes.string).isRequired,
    orient: PropTypes.string,
    tickSizeInner: PropTypes.number,
    translate: PropTypes.string,
    scale: PropTypes.func,
    ticks: PropTypes.array,
    rotateLabels: PropTypes.bool,
    type: PropTypes.string,
    col: PropTypes.shape({}),
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string,
    hasRightLegend: PropTypes.bool,
    hasBottomLegend: PropTypes.bool
  }

  static defaultProps = {
    orient: 'Bottom',
    hasRightLegend: false,
    hasBottomLegend: false,
    currencyCode: undefined,
    languageCode: undefined
  }

  componentDidMount = () => {
    if (this.props.legendLabels) {
      this.legendScale = scaleOrdinal()
        .domain(this.props.legendLabels)
        .range(this.props.chartColors)
    }

    this.renderAxis()
  }

  componentDidUpdate = () => {
    this.renderAxis()
  }

  renderLegend = () => {
    const self = this
    const { legendLabels } = this.props

    if (!legendLabels) {
      return
    }

    const svg = select(this.legendElement)

    svg
      .append('g')
      .attr('class', 'legendOrdinal')
      .style('fill', 'currentColor')
      .style('fill-opacity', '0.7')
      .style('font-family', 'inherit')
      .style('font-size', '10px')

    if (this.props.hasRightLegend) {
      var legendOrdinal = legendColor()
        .shape(
          'path',
          symbol()
            .type(symbolCircle)
            .size(75)()
        )
        .orient('vertical')
        .shapePadding(5)
        .labelWrap(120)
        .scale(this.legendScale)
    } else if (this.props.hasBottomLegend) {
      var legendOrdinal = legendColor()
        .shape(
          'path',
          symbol()
            .type(symbolCircle)
            .size(75)()
        )
        .orient('horizontal')
        .shapePadding(self.LEGEND_PADDING)
        .labelWrap(120)
        .labelAlign('left')
        // .cellFilter(d => {
        //   return d[self.props.labelValueY] !== 'e'
        // })
        // .labels(formattedLabels)
        // .titleWidth(600)
        .scale(this.legendScale)
    }

    svg.select('.legendOrdinal').call(legendOrdinal)
  }

  renderAxis = () => {
    const self = this
    const axis = this.props.orient === 'Bottom' ? axisBottom() : axisLeft()

    axis
      .scale(this.props.scale)
      .tickSizeOuter(0)
      .tickFormat(d => {
        return formatChartLabel(
          d,
          this.props.col,
          this.props.currencyCode,
          this.props.languageCode
        ).formattedLabel
      })

    if (this.props.ticks) {
      axis.tickValues(this.props.ticks)
    }

    if (this.props.showGridLines) {
      axis.tickSizeInner(this.props.tickSizeInner)
    }

    select(this.axisElement).call(axis)

    if (this.props.orient === 'Bottom' && this.props.rotateLabels) {
      // translate labels slightly to line up with ticks once rotated
      select(this.axisElement)
        .selectAll('.tick text')
        .style('transform', 'rotate(-45deg)')
        .style('text-anchor', 'end')
        .attr('dy', '0.5em')
        .attr('dx', '-0.5em')
        .attr('fill-opacity', '0.7')
        .style('font-family', 'inherit')
    }

    if (this.props.hasRightLegend || this.props.hasBottomLegend) {
      this.renderLegend()
    }

    select(this.axisElement)
      .selectAll('.axis text')
      .style('fill', 'currentColor')
      .style('fill-opacity', '0.7')
      .style('font-family', 'inherit')
      .attr('data-for', 'chart-element-tooltip')
      .attr('data-tip', function(d) {
        const { fullWidthLabel, isTruncated } = formatChartLabel(
          d,
          self.props.col,
          self.props.currencyCode,
          self.props.languageCode
        )
        if (isTruncated) {
          return fullWidthLabel
        }
        return null
      })

    select(this.axisElement)
      .selectAll('.axis path')
      .style('display', 'none')

    select(this.axisElement)
      .selectAll('.axis line')
      .style('stroke-width', '1px')
      .style('stroke', 'currentColor')
      .style('opacity', '0.15')
      .style('shape-rendering', 'crispedges')
  }

  render = () => {
    const numSeries =
      (this.props.legendLabels && this.props.legendLabels.length) || 0
    const legendDx = (this.LEGEND_PADDING * (numSeries - 1)) / 2
    const marginLeft = this.props.margins.left || 0

    return (
      <g>
        <g
          className={`axis axis-${this.props.orient}
        ${this.props.rotateLabels ? ' rotated' : ''}`}
          ref={el => {
            this.axisElement = el
          }}
          transform={this.props.translate}
        />
        <g
          ref={el => {
            this.legendElement = el
          }}
          className="legendOrdinal-container"
          transform={
            this.props.hasRightLegend
              ? `translate(${this.props.width + 15},15)`
              : `translate(${(this.props.width - marginLeft) / 2 +
                  marginLeft -
                  legendDx},${this.props.height - 30})`
          }
        />
      </g>
    )
  }
}
