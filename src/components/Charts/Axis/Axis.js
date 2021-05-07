import React, { Component } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import { select } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'
import { legendColor } from 'd3-svg-legend'
import { symbol, symbolCircle } from 'd3-shape'
import { scaleOrdinal } from 'd3-scale'

import { formatChartLabel } from '../../../js/Util.js'

import './Axis.scss'
import { themeConfigType, dataFormattingType } from '../../../props/types.js'
import {
  themeConfigDefault,
  dataFormattingDefault,
} from '../../../props/defaults.js'

export default class Axis extends Component {
  LEGEND_PADDING = 130
  LEGEND_ID = `axis-${uuid.v4()}`

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,

    scale: PropTypes.func.isRequired,
    margins: PropTypes.shape({}),
    height: PropTypes.number,
    orient: PropTypes.string,
    tickSizeInner: PropTypes.number,
    translate: PropTypes.string,
    ticks: PropTypes.array,
    rotateLabels: PropTypes.bool,
    type: PropTypes.string,
    col: PropTypes.shape({}),
    hasRightLegend: PropTypes.bool,
    hasBottomLegend: PropTypes.bool,
    onLegendClick: PropTypes.func,
    onLegendTitleClick: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    margins: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    orient: 'Bottom',
    hasRightLegend: false,
    hasBottomLegend: false,
    onLegendClick: () => {},
    onLegendTitleClick: undefined,
  }

  componentDidMount = () => {
    this.renderAxis()
  }

  componentDidUpdate = () => {
    this.renderAxis()
  }

  styleLegendTitleNoBorder = (svg) => {
    svg
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .style('transform', 'translate(0, -5px)')
      .attr('data-test', 'legend-title')
  }

  styleLegendTitleWithBorder = (svg) => {
    svg
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .style('transform', 'translate(0, -5px)')
      .attr('data-test', 'legend-title')
      .append('tspan')
      .text('  ▼')
      .style('font-size', '8px')
      .style('opacity', 0)
      .attr('class', 'react-autoql-axis-selector-arrow')

    // Add border that shows on hover
    let titleBBox = {}
    try {
      titleBBox = svg
        .select('.legendTitle')
        .node()
        .getBBox()
    } catch (error) {}

    select(this.legendBorder)
      .attr('class', 'legend-title-border')
      .attr('width', _get(titleBBox, 'width', 0) + 20)
      .attr('height', _get(titleBBox, 'height', 0) + 10)
      .attr('x', _get(titleBBox, 'x', 0) - 10)
      .attr('y', _get(titleBBox, 'y', 0) - 10)
      .attr('stroke', 'transparent')
      .attr('stroke-width', '1px')
      .attr('fill', 'transparent')
      .attr('rx', 4)

    // Move to front
    const legendElement = select(this.legendBorder).node()
    legendElement.parentNode.appendChild(legendElement)
  }

  removeOverlappingLegendLabels = () => {
    const legendContainer = select(
      `#legend-bounding-box-${this.LEGEND_ID}`
    ).node()

    select(this.rightLegendElement)
      .selectAll('.cell')
      .attr('opacity', function(d) {
        // todo: fix this so the bboxes are absolute and intersection is possible
        // const tspanElement = select(this)
        //   .select('tspan')
        //   .node()
        // const isOverflowing = doesElementOverflowContainer(
        //   this,
        //   legendContainer
        // )
        // if (isOverflowing) {
        //   return 0
        // }
        // return 1
      })
  }

  renderLegend = () => {
    try {
      const self = this
      const { legendLabels } = this.props

      if (!legendLabels) {
        return
      }

      const legendScale = this.getLegendScale()

      if (this.props.hasRightLegend) {
        const svg = select(this.rightLegendElement)

        svg
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

        if (this.props.legendTitle) {
          legendOrdinal.title(this.props.legendTitle).titleWidth(100)
        }

        svg.call(legendOrdinal).style('font-family', 'inherit')

        if (this.props.legendTitle) {
          if (this.props.onLegendTitleClick) {
            this.styleLegendTitleWithBorder(svg)
          } else {
            this.styleLegendTitleNoBorder(svg)
          }
        }

        // adjust container width to exact width of legend
        // this is so the updateMargins function works properly
        const legendWidth = select(this.rightLegendElement)
          .node()
          .getBBox().width
        select(this.legendClippingContainer).attr('width', legendWidth + 30)
        svg.attr('clip-path', `url(#legend-clip-area-${this.LEGEND_ID})`)
      } else if (this.props.hasBottomLegend) {
        const svg = select(this.bottomLegendElement)
        svg
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
          .orient('horizontal')
          .shapePadding(self.LEGEND_PADDING)
          .labelWrap(120)
          .labelAlign('left')
          .scale(legendScale)
          .on('cellclick', function(d) {
            self.props.onLegendClick(d)
          })

        svg.call(legendOrdinal).style('font-family', 'inherit')
      }

      this.applyStylesForHiddenSeries()
      // todo: get this working properly
      // this.removeOverlappingLegendLabels()
    } catch (error) {
      console.error(error)
    }
  }

  applyStylesForHiddenSeries = () => {
    try {
      const legendLabelTexts = this.props.legendLabels
        .filter((l) => {
          return l.hidden
        })
        .map((l) => l.label)

      const legendSwatchElements = document.querySelectorAll(
        `#${this.LEGEND_ID} .label`
      )

      if (legendSwatchElements) {
        legendSwatchElements.forEach((el) => {
          let textStrings = []
          el.querySelectorAll('tspan').forEach((tspan) => {
            textStrings.push(tspan.textContent)
          })

          const legendLabelText = textStrings.join(' ')
          const swatchElement = el.parentElement.querySelector('.swatch')

          if (legendLabelTexts.includes(legendLabelText)) {
            swatchElement.style.opacity = 0.3
          } else {
            swatchElement.style.opacity = 1
          }
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  getLegendScale = () => {
    const colorRange = this.props.legendLabels.map((obj) => {
      return obj.color
    })

    return scaleOrdinal()
      .domain(
        this.props.legendLabels.map((obj) => {
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
          config: self.props.dataFormatting,
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
      // https://d3-legend.susielu.com/
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
          config: self.props.dataFormatting,
        })
        if (isTruncated) {
          return fullWidthLabel
        }
        return null
      })
      .attr('data-effect', 'float')

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
      .filter((d) => d == 0)
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
          ref={(el) => {
            this.axisElement = el
          }}
          transform={this.props.translate}
        />
        {this.props.hasRightLegend && (
          <g
            ref={(el) => {
              this.rightLegendElement = el
            }}
            id={this.LEGEND_ID}
            data-test="right-legend"
            className="legendOrdinal"
            transform={`translate(${this.props.width + 15}, ${
              this.props.legendTitle ? '30' : '25'
            })`}
          >
            <clipPath id={`legend-clip-area-${this.LEGEND_ID}`}>
              <rect
                ref={(el) => {
                  this.legendClippingContainer = el
                }}
                id={`legend-bounding-box-${this.LEGEND_ID}`}
                height={
                  this.props.height -
                  this.props.margins.top -
                  // make legend smaller if labels are not rotated
                  // because they might overlap the legend
                  (!this.props.rotateLabels ? this.props.margins.bottom : 44) + // distance to bottom of axis labels
                  20 // account for translation
                }
                width={this.props.margins.right + 30}
                style={{ transform: 'translate(-30px, -30px)' }}
              />
            </clipPath>
            {this.props.onLegendTitleClick && (
              <rect
                ref={(el) => {
                  this.legendBorder = el
                }}
                onClick={this.props.onLegendTitleClick}
              />
            )}
          </g>
        )}
        {this.props.hasBottomLegend && (
          <g
            ref={(el) => {
              this.bottomLegendElement = el
            }}
            data-test="bottom-legend"
            id={this.LEGEND_ID}
            className="legendOrdinal"
            transform={`translate(${(this.props.width - marginLeft) / 2 +
              marginLeft -
              legendDx},${this.props.height - 30})`}
          />
        )}
      </g>
    )
  }
}
