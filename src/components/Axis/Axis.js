import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'

import { select } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'

import dayjs from 'dayjs'

import './Axis.css'

export default class Axis extends Component {
  static propTypes = {
    orient: PropTypes.string,
    tickSizeInner: PropTypes.number,
    translate: PropTypes.string,
    scale: PropTypes.func,
    ticks: PropTypes.array,
    tickValues: PropTypes.array,
    rotateLabels: PropTypes.bool,
    type: PropTypes.string,
    col: PropTypes.shape({})
  }

  static defaultProps = {
    orient: 'Bottom'
  }

  componentDidMount = () => {
    if (this.props.orient === 'Bottom') {
      this.renderXAxis()
    } else {
      this.renderYAxis()
    }
  }

  componentDidUpdate = () => {
    if (this.props.orient === 'Bottom') {
      this.renderXAxis()
    } else {
      this.renderYAxis()
    }
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
        if (Number(d) % 1 !== 0) {
          formattedLabel = Numbro(d).format('0,0.0')
        }
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
      return `${formattedLabel.substring(0, 25)}...`
    }
    return formattedLabel
  }

  renderXAxis = () => {
    const self = this
    const axis = axisBottom()
      .scale(this.props.scale)
      .tickSizeOuter(0)
      .tickValues(this.props.ticks)
      .tickFormat(d => {
        return self.formatLabel(d)
      })

    // if (this.props.tickValues) {
    //   axis.tickValues(this.props.tickValues)
    // }

    select(this.axisElement).call(axis)

    if (this.props.rotateLabels) {
      // translate labels slightly to line up with ticks once rotated
      select(this.axisElement)
        .selectAll('text')
        .attr('dy', '0.5em')
        .attr('dx', '-0.5em')
    }

    // select(this.axisElement)
    //   .selectAll('.x-axis-label')
    //   .remove()

    // select(this.axisElement)
    //   .append('text')
    //   .attr('class', 'x-axis-label')
    //   .attr('text-anchor', 'middle')
    //   .attr('font-weight', 'bold')
    //   .attr(
    //     'x',
    //     // (this.props.width - this.props.margins.left) / 2 +
    //     //   this.props.margins.left
    //     this.props.width / 2
    //   )
    //   .attr('y', this.props.margins.bottom - 15) // height minus font height
    //   .text(this.props.col.title)
  }

  renderYAxis = () => {
    const self = this
    const axis = axisLeft()
      .scale(this.props.scale)
      .tickSizeOuter(0)
      .ticks(6)
      .tickSizeInner(this.props.tickSizeInner)
      .tickFormat(d => {
        return self.formatLabel(d)
      })

    select(this.axisElement).call(axis)

    // select(this.axisElement)
    //   .selectAll('.y-axis-label')
    //   .remove()

    // select(this.axisElement)
    //   .append('text')
    //   .attr('class', 'y-axis-label')
    //   .attr('text-anchor', 'middle')
    //   .attr('transform', 'rotate(-90)')
    //   .attr('font-weight', 'bold')
    //   .attr('y', -this.props.margins.left + 10) // This needs to be improved........
    //   .attr('x', -((this.props.height - this.props.margins.bottom) / 2))
    //   .text(this.props.col.title)
  }

  render = () => {
    return (
      <g
        className={`axis axis-${this.props.orient}${
          this.props.rotateLabels ? ' rotated' : ''
        }`}
        ref={el => {
          this.axisElement = el
        }}
        transform={this.props.translate}
      />
    )
  }
}
