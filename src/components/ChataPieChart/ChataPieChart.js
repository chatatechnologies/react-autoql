import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'
import _get from 'lodash.get'
import uuid from 'uuid'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { pie, arc, symbol, symbolCircle } from 'd3-shape'
import { entries } from 'd3-collection'
import { legendColor } from 'd3-svg-legend'
import 'd3-transition'

import dayjs from 'dayjs'

import { formatChartLabel, formatElement } from '../../js/Util'

export default class Axis extends Component {
  CHART_ID = uuid.v4()

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

  renderPieContainer = () => {
    const { width, height } = this.props
    if (this.pieChartContainer) {
      // Remove previous pie slices
      this.pieChartContainer.remove()
    }

    this.pieChartContainer = select(this.chartElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('class', 'slices')
      .attr(
        'transform',
        `translate(${width / 2 + this.outerRadius},${height / 2})`
      )
  }

  setColorScale = () => {
    const self = this

    this.color = scaleOrdinal()
      .domain(
        self.sortedData.map(d => {
          return d[self.props.labelValue]
        })
      )
      .range(this.props.chartColors)

    const pieChart = pie().value(d => {
      return d.value[self.props.dataValue]
    })

    this.dataReady = pieChart(entries(self.sortedData))
  }

  renderPieSlices = () => {
    const self = this

    // build the pie chart
    this.pieChartContainer
      .selectAll('.slices')
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
      .attr('data-for', 'chart-element-tooltip')
      .attr('data-tip', function(d) {
        return self.props.tooltipFormatter(d)
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
          // .attr('transform', 'translate(,0)')
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

  centerVisualization = () => {
    const containerBBox = select(`#pie-chart-container-${this.CHART_ID}`)
      .node()
      .getBBox()

    const containerWidth = containerBBox.width
    const currentXPosition = containerBBox.x
    const finalXPosition = (this.props.width - containerWidth) / 2
    const xDelta = finalXPosition - currentXPosition

    select(`#pie-chart-container-${this.CHART_ID}`).attr(
      'transform',
      `translate(${xDelta},0)`
    )
  }

  renderLegend = () => {
    const self = this
    const { height, margin, labelValue, dataValue, chartColors } = this.props

    const legendLabels = this.sortedData.map(d => {
      const legendString = `${formatElement(
        d[labelValue],
        _get(d, 'origColumns[0]')
      )}: ${formatElement(d[dataValue][0], _get(d, 'origColumns[1]'))}`
      return legendString.trim()
    })

    let legendScale
    if (legendLabels) {
      legendScale = scaleOrdinal()
        .domain(legendLabels)
        .range(chartColors)
    } else {
      return
    }

    // The legend wrap length threshold should be half of the width
    // Because the pie will never be larger than half the width
    const legendWrapLength = this.props.width / 2 - 50 // 30 for the width of the circles and padding

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
      .labelWrap(legendWrapLength)
      .scale(legendScale)

    svg.select('.legendOrdinal').call(legendOrdinal)

    const legendBBox = svg
      .select('.legendOrdinal')
      .node()
      .getBBox()

    const legendHeight = legendBBox.height
    const legendWidth = legendBBox.width
    const legendXPosition = this.props.width / 2 - legendWidth - 20
    const legendYPosition =
      legendHeight < height - 20 ? (height - legendHeight) / 2 : 15

    svg
      .select('.legendOrdinal')
      .attr('transform', `translate(${legendXPosition}, ${legendYPosition})`)
  }

  setPieRadius = () => {
    const { width, height, margin } = this.props

    let pieWidth
    if (width < height) {
      pieWidth = width / 2 - margin
    } else if (height * 2 < width) {
      pieWidth = height - margin
    } else {
      pieWidth = width / 2 - margin
    }

    this.outerRadius = pieWidth / 2
    this.innerRadius = this.outerRadius - 40 > 15 ? this.outerRadius - 40 : 0
  }

  renderPie = () => {
    const self = this
    const { data, width, height, margin } = this.props

    this.setPieRadius()

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
    this.renderLegend()

    // Finally, translate container of legend and pie chart to center of parent container
    this.centerVisualization()
  }

  render = () => {
    return (
      <g id={`pie-chart-container-${this.CHART_ID}`}>
        <svg
          className="pie-chart"
          ref={el => {
            this.chartElement = el
          }}
          width={this.props.width}
          height={this.props.height}
          // transform={this.props.translate}
          // transform="translate(100, 0)"
        />
        <g
          ref={el => {
            this.legendElement = el
          }}
          className="legendOrdinal-container"
          // transform="translate(15, 15)"
          // transform={`translate(${}, 20)`}
        />
      </g>
    )
  }
}
