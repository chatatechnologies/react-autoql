import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'

import { select } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'

import dayjs from 'dayjs'

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
    languageCode: PropTypes.string
  }

  static defaultProps = {
    orient: 'Bottom',
    currencyCode: undefined,
    languageCode: undefined
  }

  componentDidMount = () => {
    this.renderAxis()
  }

  componentDidUpdate = () => {
    this.renderAxis()
  }

  formatLabel = d => {
    const { col } = this.props
    if (!col || !col.type) {
      return d
    }

    let formattedLabel = d
    switch (col.type) {
      case 'STRING': {
        // do nothing
        break
      }
      case 'DOLLAR_AMT': {
        // We will need to grab the actual currency symbol here. Will that be returned in the query response?
        formattedLabel = Numbro(d).formatCurrency({
          thousandSeparated: true,
          mantissa: 0
        })
        break
      }
      case 'QUANTITY': {
        // if (Number(d) % 1 !== 0) {
        //   formattedLabel = Numbro(d).format('0,0.0')
        // }
        break
      }
      case 'DATE': {
        const title = col.title
        if (title && title.includes('Year')) {
          formattedLabel = dayjs.unix(d).format('YYYY')
        } else if (title && title.includes('Month')) {
          formattedLabel = dayjs.unix(d).format('MMMM YYYY')
        }
        formattedLabel = dayjs.unix(d).format('MMMM D, YYYY')
        break
      }
      case 'PERCENT': {
        if (Number(d)) {
          formattedLabel = Numbro(d).format('0.00%')
        }
        break
      }
      default: {
        break
      }
    }

    if (typeof formattedLabel === 'string' && formattedLabel.length > 25) {
      return `${formattedLabel.substring(0, 18)}...`
    }
    return formattedLabel
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
        .selectAll('text')
        .style('transform', 'rotate(-45deg)')
        .style('text-anchor', 'end')
        .attr('dy', '0.5em')
        .attr('dx', '-0.5em')
        .style('font-family', 'inherit')
    }

    select(this.axisElement)
      .selectAll('text')
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
      <g
        className={`axis axis-${this.props.orient}
        ${this.props.rotateLabels ? ' rotated' : ''}`}
        ref={el => {
          this.axisElement = el
        }}
        transform={this.props.translate}
      />
    )
  }
}
