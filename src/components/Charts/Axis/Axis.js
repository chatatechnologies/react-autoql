import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'
import uuid from 'uuid'

import { select, selectAll } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'
import { legendColor } from 'd3-svg-legend'
import { symbol, symbolCircle } from 'd3-shape'
import { scaleOrdinal } from 'd3-scale'

import dayjs from '../../../js/dayjsWithPlugins'
import { formatChartLabel } from '../../../js/Util.js'

import './Axis.scss'

export default class Axis extends Component {
  LEGEND_PADDING = 130
  LEGEND_ID = `axis-${uuid.v4()}`

  static propTypes = {
    chartColors: PropTypes.arrayOf(PropTypes.string).isRequired,
    margins: PropTypes.shape({}),
    height: PropTypes.number,
    orient: PropTypes.string,
    tickSizeInner: PropTypes.number,
    translate: PropTypes.string,
    scale: PropTypes.func,
    ticks: PropTypes.array,
    rotateLabels: PropTypes.bool,
    type: PropTypes.string,
    col: PropTypes.shape({}),
    hasRightLegend: PropTypes.bool,
    hasBottomLegend: PropTypes.bool,
    onLegendClick: PropTypes.func,
    dataFormatting: PropTypes.shape({
      currencyCode: PropTypes.string,
      languageCode: PropTypes.string,
      currencyDecimals: PropTypes.number,
      quantityDecimals: PropTypes.number,
      comparisonDisplay: PropTypes.string,
      monthYearFormat: PropTypes.string,
      dayMonthYearFormat: PropTypes.string
    })
  }

  static defaultProps = {
    orient: 'Bottom',
    hasRightLegend: false,
    hasBottomLegend: false,
    dataFormatting: {},
    margins: {},
    onLegendClick: () => {}
  }

  componentDidMount = () => {
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

    const legendScale = this.getLegendScale()

    if (this.props.hasRightLegend) {
      const svg = select(this.rightLegendElement)
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
        .labelWrap(100)
        .scale(legendScale)
        .on('cellclick', function(d) {
          self.props.onLegendClick(d)
        })

      svg
        .select('.legendOrdinal')
        .call(legendOrdinal)
        .style('font-family', 'inherit')
    } else if (this.props.hasBottomLegend) {
      const svg = select(this.bottomLegendElement)
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
        // .useClass(true)
        // .classPrefix('item-')
        .orient('horizontal')
        .shapePadding(self.LEGEND_PADDING)
        .labelWrap(120)
        .labelAlign('left')
        // .cellFilter(d => {
        //   return d[self.props.labelValueY] !== 'e'
        // })
        // .labels(formattedLabels)
        // .titleWidth(600)
        .scale(legendScale)
        .on('cellclick', function(d) {
          self.props.onLegendClick(d)
        })
      // .on('cellover', function(d) {
      //   alert('cell over ' + d)
      // })
      // .on('cellout', function(d) {
      //   alert('cell out ' + d)
      // })
      svg
        .select('.legendOrdinal')
        .call(legendOrdinal)
        .style('font-family', 'inherit')
    }

    this.applyStylesForHiddenSeries()
  }

  applyStylesForHiddenSeries = () => {
    const legendLabelTexts = this.props.legendLabels
      .filter(l => l.hidden)
      .map(l => l.label)

    const legendSwatchElements = document.querySelectorAll(
      `#${this.LEGEND_ID} .label tspan`
    )

    if (legendSwatchElements) {
      legendSwatchElements.forEach(el => {
        const swatchElement = el.parentElement.parentElement.querySelector(
          '.swatch'
        )

        if (legendLabelTexts.includes(el.textContent)) {
          swatchElement.style.opacity = 0.3
        } else {
          swatchElement.style.opacity = 1
        }
      })
    }
  }

  getLegendScale = () => {
    const colorRange = this.props.legendLabels.map(obj => {
      return obj.color
    })

    return scaleOrdinal()
      .domain(
        this.props.legendLabels.map(obj => {
          return obj.label
        })
      )
      .range(colorRange)
  }

  renderAxis = () => {
    const self = this
    const axis = this.props.orient === 'Bottom' ? axisBottom() : axisLeft()

    axis
      .scale(this.props.scale)
      .tickSizeOuter(0)
      .tickFormat(function(d) {
        return formatChartLabel({
          d,
          col: self.props.col,
          config: self.props.dataFormatting
        }).formattedLabel
      })

    if (this.props.ticks) {
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
        .attr('fill-opacity', '0.7')
        .style('font-family', 'inherit')
    } else if (this.props.orient === 'Bottom' && !this.props.rotateLabels) {
      select(this.axisElement)
        .selectAll('.tick text')
        .style('transform', 'rotate(0deg)')
        .style('text-anchor', 'middle')
        .attr('dy', '10px')
        .attr('dx', '0')
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
        const { fullWidthLabel, isTruncated } = formatChartLabel({
          d,
          col: self.props.col,
          config: self.props.dataFormatting
        })
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

    // Make tick line at 0 darker
    select(this.axisElement)
      .selectAll('g.tick')
      .filter(d => d == 0)
      .select('line')
      .style('opacity', 0.4)
  }

  render = () => {
    const numSeries =
      (this.props.legendLabels && this.props.legendLabels.length) || 0
    const legendDx = (this.LEGEND_PADDING * (numSeries - 1)) / 2
    const marginLeft = this.props.margins.left || 0

    return (
      <g data-test="axis">
        <g
          className={`axis axis-${this.props.orient}
        ${this.props.rotateLabels ? ' rotated' : ''}`}
          ref={el => {
            this.axisElement = el
          }}
          transform={this.props.translate}
        />
        {this.props.hasRightLegend && (
          <g
            ref={el => {
              this.rightLegendElement = el
            }}
            id={this.LEGEND_ID}
            className="legendOrdinal-container"
            transform={`translate(${this.props.width + 15},15)`}
          />
        )}
        {this.props.hasBottomLegend && (
          <g
            ref={el => {
              this.bottomLegendElement = el
            }}
            id={this.LEGEND_ID}
            className="legendOrdinal-container"
            transform={`translate(${(this.props.width - marginLeft) / 2 +
              marginLeft -
              legendDx},${this.props.height - 30})`}
          />
        )}
        {
          //   <g
          //   ref={el => {
          //     this.legendElement = el
          //   }}
          //   id={this.LEGEND_ID}
          //   className="legendOrdinal-container"
          //   // width={100}
          //   // height={50}
          //   transform={
          //     this.props.hasRightLegend
          //       ? `translate(${this.props.width + 15},15)`
          //       : `translate(${(this.props.width - marginLeft) / 2 +
          //           marginLeft -
          //           legendDx},${this.props.height - 30})`
          //   }
          // />
        }
      </g>
    )
  }
}
