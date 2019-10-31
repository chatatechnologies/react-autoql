import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'
import _get from 'lodash.get'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { pie, arc } from 'd3-shape'
import { entries } from 'd3-collection'
import { interpolate } from 'd3-interpolate'
import 'd3-transition'

import dayjs from 'dayjs'

import { formatChartLabel } from '../../js/Util'

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
    // this.renderPie()
  }

  renderPieContainer = () => {
    const { width, height } = this.props
    this.pieChartContainer = select(this.chartElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('class', 'slices')
      .attr('transform', `translate(${width / 2},${height / 2})`)
  }

  setColorScale = () => {
    const self = this
    this.color = scaleOrdinal()
      .domain(
        self.sortedData.map(d => {
          return d[self.props.labelValue]
        })
      )
      .range(['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'])

    const pieChart = pie().value(d => {
      return d.value[self.props.dataValue]
    })

    this.dataReady = pieChart(entries(self.sortedData))
  }

  renderPieSlices = () => {
    const self = this
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
    this.pieChartContainer
      .selectAll('slices')
      .data(self.dataReady)
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr(
        'd',
        arc()
          .innerRadius(self.innerRadius)
          .outerRadius(self.outerRadius)
      )
      .attr('fill', d => {
        return self.color(d.data.value[self.props.labelValue])
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
          self.pieChartContainer
            .selectAll('path.slice')
            .each(function(data) {
              // reset all slices to not expanded
              data._expanded = false
            })
            .transition()
            .duration(500)
            .attr('transform', 'translate(,0)')
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

  renderLabels = () => {
    const self = this

    const text = this.pieChartContainer
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(self.dataReady)

    function midAngle(d) {
      return d.startAngle + (d.endAngle - d.startAngle) / 2
    }

    var prev
    var textOffset = 14

    text
      .enter()
      .append('text')
      .attr('dy', '.35em')
      .style('fill', 'currentColor')
      .style('fill-opacity', 0.7)
      .text(function(d) {
        const data = _get(d, `data.value[${self.props.labelValue}]`)
        const column = _get(d, `data.value.origColumns[0]`)

        return formatChartLabel(data, column).formattedLabel
      })
      .transition()
      .duration(2000)
      .each(function(d, i) {
        if (i > 0) {
          var thisbb = this.getBoundingClientRect(),
            prevbb = prev.getBoundingClientRect()
          // move if they overlap
          if (
            !(
              thisbb.right < prevbb.left ||
              thisbb.left > prevbb.right ||
              thisbb.bottom < prevbb.top ||
              thisbb.top > prevbb.bottom
            )
          ) {
            var ctx = thisbb.left + (thisbb.right - thisbb.left) / 2,
              cty = thisbb.top + (thisbb.bottom - thisbb.top) / 2,
              cpx = prevbb.left + (prevbb.right - prevbb.left) / 2,
              cpy = prevbb.top + (prevbb.bottom - prevbb.top) / 2,
              off =
                Math.sqrt(Math.pow(ctx - cpx, 2) + Math.pow(cty - cpy, 2)) / 2
            select(this).attr(
              'transform',
              'translate(' +
                Math.cos((d.startAngle + d.endAngle - Math.PI) / 2) *
                  (self.outerRadius + textOffset + off) +
                ',' +
                Math.sin((d.startAngle + d.endAngle - Math.PI) / 2) *
                  (self.outerRadius + textOffset + off) +
                ')'
            )
          }
        }
        prev = this
      })
      .attrTween('transform', function(d) {
        this._current = this._current || d
        const interpolated = interpolate(this._current, d)
        this._current = interpolated(0)
        return function(t) {
          var d2 = interpolated(t)
          var pos = self.outerArc.centroid(d2)
          // pos[0] = self.outerRadius * (midAngle(d2) < Math.PI ? 1.2 : -1.2)
          pos[0] = pos[0] + 10 * (midAngle(d2) < Math.PI ? 1.2 : -1.2)
          return 'translate(' + pos + ')'
        }
      })
      .styleTween('text-anchor', function(d) {
        this._current = this._current || d
        const interpolated = interpolate(this._current, d)
        this._current = interpolated(0)
        return function(t) {
          var d2 = interpolated(t)
          return midAngle(d2) < Math.PI ? 'start' : 'end'
        }
      })

    text.exit().remove()
  }

  renderLabelLines = () => {
    const self = this

    const arcForLabels = arc()
      .innerRadius(self.outerRadius * 0.5)
      .outerRadius(self.outerRadius * 1.1)

    this.pieChartContainer
      .selectAll('allPolylines')
      .data(self.dataReady)
      .enter()
      .append('polyline')
      .attr('stroke', 'currentColor')
      .style('fill', 'none')
      .attr('stroke-width', 1)
      .style('stroke-opacity', 0.7)
      .attr('points', function(d) {
        var posA = arcForLabels.centroid(d) // line insertion in the slice
        var posB = self.outerArc.centroid(d) // line break: we use the other arc generator that has been built only for that
        // var posC = self.outerArc.centroid(d) // Label position = almost the same as posB
        var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2 // we need the angle to see if the X position will be at the extreme right or extreme left
        // posC[0] = self.outerRadius * 1.15 * (midangle < Math.PI ? 1 : -1) // multiply by 1 or -1 to put it on the right or on the left
        var posC = self.outerArc.centroid(d)
        posC[0] = posC[0] + 10 * (midangle < Math.PI ? 1 : -1)
        return [posA, posB, posC]
      })
  }

  renderPie = () => {
    const self = this

    // 100 pixel max for labels.
    // Might want to calculate max label length and use that if it is much less than 100px
    const labelMargin = 100

    const { data, width, height, margin } = this.props
    this.outerRadius =
      Math.min(width - labelMargin * 2, height - 25) / 2 - margin
    this.innerRadius = this.outerRadius - 100 > 40 ? this.outerRadius - 100 : 40
    this.outerArc = arc()
      .innerRadius(self.outerRadius * 1.1)
      .outerRadius(self.outerRadius * 1.1)

    this.sortedData = data.sort(
      (a, b) =>
        parseFloat(a[self.props.dataValue]) -
        parseFloat(b[self.props.dataValue])
    )

    this.renderPieContainer()
    this.setColorScale()
    this.renderPieSlices()
    this.renderLabelLines()
    this.renderLabels()
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
