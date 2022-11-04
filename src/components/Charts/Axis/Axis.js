import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import { select, selectAll } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleOrdinal } from 'd3-scale'

import LegendSelector from './LegendSelector'
import legendColor from '../Legend/Legend'
import AxisScaler from './AxisScaler'

import { formatChartLabel, removeFromDOM } from '../../../js/Util.js'
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
    if (this.props.hasRightLegend || this.props.hasBottomLegend) {
      // https://d3-legend.susielu.com/
      this.renderLegend()
    }

    this.props.onLabelChange()
  }

  componentDidUpdate = (prevProps) => {
    this.renderAxis()

    // only render legend once... unless labels changed
    if (
      (this.props.hasRightLegend || this.props.hasBottomLegend) &&
      !_isEqual(this.props.legendLabels, prevProps.legendLabels)
    ) {
      this.renderLegend()
    }

    if (this.props.rotateLabels !== prevProps.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  componentWillUnmount = () => {
    removeFromDOM(this.legendElement)
    removeFromDOM(this.legendSwatchElements)
    removeFromDOM(this.swatchElements)
  }

  styleLegendTitleNoBorder = (svg) => {
    svg
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .style('transform', 'translate(0, -5px)')
      .attr('data-test', 'legend-title')
      .attr('fill-opacity', 0.9)
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
    this.titleBBox = {}
    try {
      this.titleBBox = svg.select('.legendTitle').node().getBBox()
    } catch (error) {
      console.error(error)
    }

    select(this.legendBorder)
      .attr('class', 'legend-title-border')
      .attr('width', _get(this.titleBBox, 'width', 0) + this.BUTTON_PADDING * 2)
      .attr('height', _get(this.titleBBox, 'height', 0) + this.BUTTON_PADDING * 2)
      .attr('x', _get(this.titleBBox, 'x', 0) - this.BUTTON_PADDING)
      .attr('y', _get(this.titleBBox, 'y', 0) - this.BUTTON_PADDING)
      .attr('stroke', 'transparent')
      .attr('stroke-width', '1px')
      .attr('fill', 'transparent')
      .attr('rx', 4)

    // Move to front
    this.legendElement = select(this.legendBorder).node()
    this.legendElement.parentNode.appendChild(this.legendElement)
  }

  styleAxisScalerBorder = () => {
    select(this.axisScaler)
      .attr('class', 'legend-title-border')
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

  // TODO: remove last visible legend label if it is cut off
  // removeOverlappingLegendLabels = () => {
  //   const legendContainer = select(
  //     `#legend-bounding-box-${this.LEGEND_ID}`
  //   ).node()

  //   select(this.rightLegendElement)
  //     .selectAll('.cell')
  //     .attr('opacity', function(d) {
  //       // todo: fix this so the bboxes are absolute and intersection is possible
  //       // const tspanElement = select(this)
  //       //   .select('tspan')
  //       //   .node()
  //       // const isOverflowing = doesElementOverflowContainer(
  //       //   this,
  //       //   legendContainer
  //       // )
  //       // if (isOverflowing) {
  //       //   return 0
  //       // }
  //       // return 1
  //     })
  // }

  renderLegend = () => {
    try {
      const self = this
      const { legendLabels } = this.props

      if (!legendLabels) {
        return
      }

      const legendScale = this.getLegendScale(legendLabels)

      if (this.props.hasRightLegend) {
        this.legendSVG = select(this.rightLegendElement)

        this.legendSVG
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '10px')

        var legendOrdinal = legendColor()
          .orient('vertical')
          .shapePadding(5)
          .labelWrap(100)
          .scale(legendScale)
          .on('cellclick', function (d) {
            self.props.onLabelChange({ setLoading: false })
            self.props.onLegendClick(legendLabels.find((label) => label.label === d))
          })

        if (this.props.legendTitle) {
          legendOrdinal.title(this.props.legendTitle).titleWidth(100)
        }

        this.legendSVG.call(legendOrdinal).style('font-family', 'inherit')

        if (this.props.legendTitle) {
          if (this.props.onLegendTitleClick) {
            this.styleLegendTitleWithBorder(this.legendSVG)
          } else {
            this.styleLegendTitleNoBorder(this.legendSVG)
          }
        }

        // adjust container width to exact width of legend
        // this is so the updateMargins function works properly
        const legendWidth = select(this.rightLegendElement).node().getBBox().width
        select(this.legendClippingContainer).attr('width', legendWidth + 30)
        this.legendSVG.attr('clip-path', `url(#legend-clip-area-${this.LEGEND_ID})`)
      } else if (this.props.hasBottomLegend) {
        this.legendSVG = select(this.bottomLegendElement)
        this.legendSVG
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '10px')

        var legendOrdinal = legendColor()
          .orient('horizontal')
          .shapePadding(self.LEGEND_PADDING)
          .labelWrap(120)
          .labelAlign('left')
          .scale(legendScale)
          .on('cellclick', function (d) {
            self.props.onLegendClick(d)
          })

        this.legendSVG.call(legendOrdinal).style('font-family', 'inherit')
      }

      this.applyStylesForHiddenSeries(legendLabels)
      // todo: get this working properly
      // this.removeOverlappingLegendLabels()
    } catch (error) {
      console.error(error)
    }
  }

  applyStylesForHiddenSeries = (legendLabels) => {
    try {
      const legendLabelTexts = legendLabels
        .filter((l) => {
          return l.hidden
        })
        .map((l) => l.label)

      this.legendSwatchElements = document.querySelectorAll(`#${this.LEGEND_ID} .label`)

      if (this.legendSwatchElements) {
        this.legendSwatchElements.forEach((el, i) => {
          const textStrings = []
          el.querySelectorAll('tspan').forEach((tspan) => {
            textStrings.push(tspan.textContent)
          })

          const legendLabelText = textStrings.join(' ')
          this.swatchElements[i] = el.parentElement.querySelector('.swatch')

          if (legendLabelTexts.includes(legendLabelText)) {
            this.swatchElements[i].style.opacity = 0.3
          } else {
            this.swatchElements[i].style.opacity = 1
          }
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  getLegendScale = (legendLabels) => {
    const colorRange = legendLabels.map((obj) => {
      return obj.color
    })

    return scaleOrdinal()
      .domain(
        legendLabels.map((obj) => {
          return obj.label
        }),
      )
      .range(colorRange)
  }

  renderAxis = () => {
    const self = this
    const axis = this.props.orient === 'Bottom' ? axisBottom() : axisLeft()

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
      .attr('data-for', this.props.tooltipID)
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
        {this.props.hasRightLegend && (
          <g
            ref={(el) => {
              this.rightLegendElement = el
            }}
            id={this.LEGEND_ID}
            data-test='right-legend'
            className='legendOrdinal right-legend'
            transform={`translate(${this.props.width + 15}, ${this.props.legendTitle ? '30' : '25'})`}
          >
            <clipPath id={`legend-clip-area-${this.LEGEND_ID}`}>
              <rect
                ref={(el) => {
                  this.legendClippingContainer = el
                }}
                id={`legend-bounding-box-${this.LEGEND_ID}`}
                height={legendClippingHeight}
                width={this.props.rightMargin + 30}
                style={{ transform: 'translate(-30px, -30px)' }}
              />
            </clipPath>
            {this.props.legendColumn && (
              <LegendSelector
                {...this.props}
                column={this.props.legendColumn}
                positions={['bottom']}
                align='end'
                childProps={{
                  ref: (r) => (this.legendBorder = r),
                  x: _get(this.titleBBox, 'x', 0) - this.BUTTON_PADDING,
                  y: _get(this.titleBBox, 'y', 0) - this.BUTTON_PADDING,
                  width: _get(this.titleBBox, 'width', 0) + this.BUTTON_PADDING * 2,
                  height: _get(this.titleBBox, 'height', 0) + this.BUTTON_PADDING * 2,
                  transform: this.props.translate,
                }}
              />
            )}
          </g>
        )}
        {this.props.hasBottomLegend && (
          <g
            ref={(el) => {
              this.bottomLegendElement = el
            }}
            data-test='bottom-legend'
            id={this.LEGEND_ID}
            className='legendOrdinal'
            transform={`translate(${(this.props.width - marginLeft) / 2 + marginLeft - legendDx},${
              this.props.height - 30
            })`}
          />
        )}
        {!!this.labelBBox && this.props.scale?.type === 'LINEAR' && (
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
