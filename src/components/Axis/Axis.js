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
  static propTypes = {
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
    hasLegend: PropTypes.bool
  }

  static defaultProps = {
    orient: 'Bottom',
    hasLegend: false,
    currencyCode: undefined,
    languageCode: undefined
  }

  componentDidMount = () => {
    if (this.props.legendLabels) {
      this.legendScale = scaleOrdinal()
        .domain(this.props.legendLabels)
        .range(['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'])
    }

    this.renderAxis()
  }

  componentDidUpdate = () => {
    this.renderAxis()
  }

  renderLegend = () => {
    const self = this
    const { legendLabels, legendColumn } = this.props

    if (!legendLabels || !legendColumn) {
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
      // .labelAlign('left')
      // .cellFilter(d => {
      //   return d[self.props.labelValueY] !== 'e'
      // })
      // .labels(formattedLabels)
      // .titleWidth(600)
      .scale(this.legendScale)

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
        )
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

    if (this.props.hasLegend) {
      this.renderLegend()
    }

    select(this.axisElement)
      .selectAll('.axis text')
      .style('fill', 'currentColor')
      .style('fill-opacity', '0.7')
      .style('font-family', 'inherit')

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
          transform={`translate(${this.props.width + 15},15)`}
        />
      </g>
    )
  }
}
