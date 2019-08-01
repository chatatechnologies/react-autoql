import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'

import { select, selectAll } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { pie, arc } from 'd3-shape'
import { entries } from 'd3-collection'
import { interpolate } from 'd3-interpolate'
import 'd3-transition'

import dayjs from 'dayjs'

import './ChataPieChart.css'

export default class Axis extends Component {
  static propTypes = {
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    data: PropTypes.arrayOf(PropTypes.shape()).isRequired,
    margin: PropTypes.number
  }

  static defaultProps = {
    margin: 20
  }

  componentDidMount = () => {
    this.renderPie()
  }

  componentDidUpdate = () => {
    this.renderPie()
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
      return `${formattedLabel.substring(0, 25)}...`
    }
    return formattedLabel
  }

  renderPie = () => {
    const self = this
    // 100 pixel max for labels.
    // Might want to calculate max label length and use that if it is much less than 100px
    const labelMargin = 100

    const { data, width, height, margin } = this.props
    const outerRadius = Math.min(width - labelMargin * 2, height) / 2 - margin
    const innerRadius = outerRadius - 100 > 40 ? outerRadius - 100 : 40

    const sortedData = data.sort(
      (a, b) =>
        parseFloat(a[self.props.dataValue]) -
        parseFloat(b[self.props.dataValue])
    )

    // make pie element container and center
    const pieChartContainer = select(this.chartElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('class', 'slices')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')

    // set the color scale
    const color = scaleOrdinal()
      .domain(
        sortedData.map(d => {
          return d[self.props.labelValue]
        })
      )
      .range(['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'])

    const pieChart = pie().value(d => {
      return d.value[self.props.dataValue]
    })

    const dataReady = pieChart(entries(sortedData))

    // transition boiler plate (not working)
    // pieChartContainer
    //   .select('slices')
    //   .selectAll('path.slice')
    //   .transition()
    //   .duration(1000)
    //   .attrTween('d', function(d) {
    //     this._current = this._current || d
    //     var interpolate = interpolate(this._current, d)
    //     this._current = interpolate(0)
    //     return function(t) {
    //       return arc(interpolate(t))
    //     }
    //   })

    // second transition attempt (also not working)
    // selectAll('path.slice')
    // .transition()
    // .duration(2000)
    // .attrTween('d', function(b) {
    //   var i = interpolate(
    //     { startAngle: 1.1 * Math.PI, endAngle: 1.1 * Math.PI },
    //     b
    //   )
    //   return function(t) {
    //     return arc(i(t))
    //   }
    // })

    // build the pie chart
    pieChartContainer
      .selectAll('slices')
      .data(dataReady)
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr(
        'd',
        arc()
          .innerRadius(innerRadius)
          .outerRadius(outerRadius)
      )
      .attr('fill', d => {
        return color(d.data.value[self.props.labelValue])
      })
      .style('fill-opacity', 0.85)
      .style('stroke-width', '0')
      .on('mouseover', function(d) {
        select(this).style('fill-opacity', 1)
      })
      .on('mouseout', function(d) {
        select(this).style('fill-opacity', 0.85)
      })
      .on('click', function(d) {
        // if already expanded, we want to move it back so skip this step
        if (!d._expanded) {
          pieChartContainer
            .selectAll('path.slice')
            .each(function(data) {
              // reset all slices to not expanded
              data._expanded = false
            })
            .transition()
            .duration(500)
            .attr('transform', 'translate(0,0)')
        }

        select(this)
          .transition()
          .duration(500)
          .attr('transform', function(d) {
            if (!d._expanded) {
              d._expanded = true
              const a =
                d.startAngle + (d.endAngle - d.startAngle) / 2 - Math.PI / 2
              const x = Math.cos(a) * 20
              const y = Math.sin(a) * 20
              // move it away from the circle center
              return 'translate(' + x + ',' + y + ')'
            } else {
              d._expanded = false
              // move it back
              return 'translate(0,0)'
            }
          })
      })
  }

  render = () => {
    return (
      <svg
        className="pie-chart"
        ref={el => {
          this.chartElement = el
        }}
        width={this.props.width}
        height={this.props.height}
        transform={this.props.translate}
      />
    )
  }
}
