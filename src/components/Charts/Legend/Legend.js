import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { symbol, symbolSquare } from 'd3-shape'

import legendColor from '../D3Legend/D3Legend'

import { deepEqual, removeFromDOM } from '../../../js/Util.js'
import { getLegendLabelsForMultiSeries, mergeBboxes } from '../helpers'
import { AGG_TYPES, NUMBER_COLUMN_TYPE_DISPLAY_NAMES } from '../../../js/Constants'

export default class Legend extends Component {
  constructor(props) {
    super(props)

    this.MAX_LEGEND_WIDTH = 200
    this.MAX_LEGEND_HEIGHT = 200
    this.LEGEND_ID = `axis-${uuid()}`
    this.HORIZONTAL_LEGEND_SPACING = 20
    this.VERTICAL_LEGEND_SPACING = 15
    this.justMounted = true
  }

  static propTypes = {
    title: PropTypes.string,
    legendColumn: PropTypes.shape({}),
    placement: PropTypes.string,
    onLabelChange: PropTypes.func,
    onLegendClick: PropTypes.func,
    onLegendTitleClick: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    scale: PropTypes.func,
    translate: PropTypes.string,
    height: PropTypes.number,
    width: PropTypes.number,
    onRenderComplete: PropTypes.func,
  }

  static defaultProps = {
    title: undefined,
    paddingHorizontal: 10,
    paddingVertical: 10,
    onLabelChange: () => {},
    onLegendClick: () => {},
    onRenderComplete: () => {},
    translate: undefined,
    placement: 'right',
  }

  componentDidMount = () => {
    // https://d3-legend.susielu.com/
    this.renderAllLegends()
  }

  shouldComponentUpdate = (nextProps) => {
    if (!deepEqual(this.props.columns, nextProps.columns)) {
      return true
    }

    if (this.props.height !== nextProps.height || this.props.outerHeight !== nextProps.outerHeight) {
      return true
    }

    return false
  }

  componentDidUpdate = () => {
    this.renderAllLegends()
  }

  componentWillUnmount = () => {
    removeFromDOM(this.legendElement)
    removeFromDOM(this.legendElement2)
  }

  renderAllLegends = () => {
    this.renderLegend(this.legendElement, this.props.legendColumnIndices, this.props.colorScale)
    if (this.props.hasSecondAxis) {
      const isSecondLegend = true
      this.renderLegend(this.legendElement2, this.props.numberColumnIndices2, this.props.colorScale2, isSecondLegend)
    }

    if (this.justMounted) {
      this.justMounted = false
      this.props.onRenderComplete()
    }
  }

  removeHiddenLegendLabels = (legendElement) => {
    const legendContainerBBox = this.legendClippingContainer?.getBoundingClientRect()
    const legendBottom = (legendContainerBBox?.y ?? 0) + (legendContainerBBox?.height ?? 0)

    let hasRemovedElement = false
    let removedElementY = undefined
    let removedElementTransform = undefined

    select(legendElement)
      .selectAll('.cell')
      .each(function (label) {
        if (hasRemovedElement) {
          select(this).remove()
        } else {
          const cellBBox = this.getBoundingClientRect()
          const cellBottom = (cellBBox?.y ?? 0) + (cellBBox?.height ?? 0)
          if (cellBottom > legendBottom) {
            removedElementY = select(this).attr('y')
            removedElementTransform = select(this).attr('transform')
            select(this).remove()

            // Setting this to true lets loop skip bounding rect calculation
            // since every cell after this one should be removed
            hasRemovedElement = true
          }
        }
      })

    if (hasRemovedElement && removedElementTransform) {
      // Add red arrow to bottom of legend to show not all labels are visible
      const tooltipID = this.props.chartTooltipID
      select(legendElement).select('.legend-hidden-field-arrow').remove()
      select(legendElement)
        .append('text')
        .html('&#9660 ...')
        .attr('class', 'legend-hidden-field-arrow')
        .attr('y', removedElementY + 20)
        .attr('transform', removedElementTransform)
        .attr('data-tip', 'Some legend fields are hidden. Please expand the chart size to view them.')
        .attr('data-for', tooltipID)
        .style('font-size', '12px')
        .style('color', 'red')
        .style('font-weight', 'bold')
        .style('cursor', 'default')
    }
  }

  styleLegendTitleNoBorder = (legendElement) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .attr('fill-opacity', 0.9)
  }

  styleLegendTitleWithBorder = (legendElement) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .append('tspan')
      .text('  ▼')
      .style('font-size', '8px')
      .style('opacity', 0)
      .attr('class', 'react-autoql-axis-selector-arrow')

    // Add border that shows on hover
    this.titleBBox = {}
    try {
      this.titleBBox = select(legendElement).select('.legendTitle').node().getBBox()
    } catch (error) {
      console.error(error)
    }
  }

  onClick = (labelText, legendLabels) => {
    const label = legendLabels?.find((l) => l.label === labelText)
    const isHidingLabel = !label?.hidden
    const visibleLegendLabels = legendLabels?.filter((l) => !l.hidden)
    const allowClick = !isHidingLabel || visibleLegendLabels?.length > 1

    if (allowClick) {
      this.props.onLegendClick(label)
    }
  }

  getLegendTitleFromColumns = (columnIndices) => {
    if (this.props.isAggregated) {
      return this.props.legendColumn?.display_name ?? 'Legend'
    }

    let title = 'Fields'

    const legendColumns = columnIndices.map((index) => this.props.columns[index])

    const columnTypeArray = columnIndices.map((index) => this.props.columns[index].type)
    const allTypesEqual = !columnTypeArray.find((type) => type !== columnTypeArray[0])
    if (this.props.hasSecondAxis && allTypesEqual) {
      const columnTypeName = NUMBER_COLUMN_TYPE_DISPLAY_NAMES[columnTypeArray[0]]
      if (columnTypeName) {
        title = `${columnTypeName} ${title}`
      }
    }

    const aggTypeArray = legendColumns.map((col) => col.aggType)
    const allAggTypesEqual = !aggTypeArray.find((agg) => agg !== aggTypeArray[0])
    if (allAggTypesEqual) {
      const aggName = AGG_TYPES.find((agg) => agg.value === aggTypeArray[0])?.displayName
      if (aggName) {
        title = `${title} (${aggName})`
      }
    }

    return title
  }

  renderLegend = (legendElement, columnIndices, colorScale, isSecondLegend) => {
    try {
      const self = this
      const legendLabels = getLegendLabelsForMultiSeries(this.props.columns, colorScale, columnIndices)

      if (!legendLabels?.length) {
        return
      }

      const title = this.getLegendTitleFromColumns(columnIndices)
      const legendScale = this.getLegendScale(legendLabels)
      const maxWidth = this.MAX_LEGEND_WIDTH - this.props.paddingHorizontal * 2

      var legendOrdinal = legendColor()
        .orient('vertical')
        .path(symbol().type(symbolSquare).size(100)())
        .shapePadding(8)
        .labelWrap(maxWidth)
        .labelOffset(10)
        .scale(legendScale)
        .title(title)
        .titleWidth(maxWidth)
        .on('cellclick', function (d) {
          self.onClick(d, legendLabels)
        })

      if (isSecondLegend) {
        legendOrdinal.shape('line')
      } else if (this.props.shape) {
        legendOrdinal.shape(this.props.shape)
      }

      select(legendElement)
        .call(legendOrdinal)
        .attr('class', 'legendOrdinal')
        .attr('transform', `translate(0,${this.props.paddingVertical})`)
        .style('fill', 'currentColor')
        .style('fill-opacity', '1')
        .style('font-family', 'inherit')
        .style('font-size', '12px')

      if (isSecondLegend) {
        const legendBBox1 = this.legendElement?.getBoundingClientRect()
        if (this.props.placement === 'right') {
          const topLegendBottomY = legendBBox1?.height ?? 0
          select(legendElement).attr(
            'transform',
            `translate(0, ${topLegendBottomY + this.props.paddingVertical * 2 + this.VERTICAL_LEGEND_SPACING})`,
          )
        } else if (this.props.placement === 'bottom') {
          const legendRightX = legendBBox1?.width ?? 0
          select(legendElement).attr(
            'transform',
            `translate(${legendRightX + this.props.paddingHorizontal * 2 + this.HORIZONTAL_LEGEND_SPACING}, ${
              this.props.paddingVertical
            })`,
          )
        }
      }

      if (title) {
        if (this.props.onLegendTitleClick) {
          this.styleLegendTitleWithBorder(legendElement)
        } else {
          this.styleLegendTitleNoBorder(legendElement)
        }
      }

      const legendBBox1 = this.legendElement?.getBoundingClientRect()
      const legendBBox2 = this.legendElement2?.getBoundingClientRect()
      const mergedBBox = mergeBboxes([legendBBox1, legendBBox2])

      let combinedLegendWidth = !isNaN(mergedBBox?.width) ? mergedBBox?.width : 0
      let combinedLegendHeight = !isNaN(mergedBBox?.height) ? mergedBBox?.height : 0
      if (this.props.placement === 'right') {
        if (combinedLegendWidth > this.MAX_LEGEND_WIDTH - this.props.paddingHorizontal * 2) {
          combinedLegendWidth = this.MAX_LEGEND_WIDTH - this.props.paddingHorizontal * 2
        }

        const maxLegendHeight = this.props.height
        select(this.legendClippingContainer)
          .attr('height', maxLegendHeight)
          .attr('width', combinedLegendWidth + this.props.paddingHorizontal * 2)
      } else if (this.props.placement === 'bottom') {
        if (combinedLegendHeight > this.MAX_LEGEND_HEIGHT - this.props.paddingVertical * 2) {
          combinedLegendHeight = this.MAX_LEGEND_HEIGHT - this.props.paddingVertical * 2
        }

        const maxLegendWidth = this.props.width
        select(this.legendClippingContainer)
          .attr('height', combinedLegendHeight + this.props.paddingVertical * 2)
          .attr('width', maxLegendWidth)
      }

      this.removeHiddenLegendLabels(legendElement)
      this.applyStylesForHiddenSeries(legendElement, legendLabels)
    } catch (error) {
      console.error(error)
    }
  }

  applyStylesForHiddenSeries = (legendElement, legendLabels) => {
    try {
      select(legendElement)
        .selectAll('.cell')
        .each(function (label) {
          const legendLabel = legendLabels.find((l) => l.label === label)
          if (legendLabel) {
            select(this).select('.swatch').attr('stroke', legendLabel.color).attr('stroke-location', 'outside')
            if (legendLabel.hidden) {
              select(this).attr('class', 'cell hidden')
            } else {
              select(this).attr('class', 'cell visible')
            }
          }
        })
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

  render = () => {
    return (
      <g data-test='legend' transform={`translate(${this.props.paddingHorizontal}, ${this.props.paddingVertical})`}>
        <g
          ref={(el) => (this.legendElement = el)}
          id={this.LEGEND_ID}
          data-test='react-autoql-legend'
          className='legendOrdinal react-autoql-legend'
        />
        {this.props.hasSecondAxis && (
          <g
            ref={(el) => (this.legendElement2 = el)}
            id={this.LEGEND_ID}
            data-test='react-autoql-legend-2'
            className='legendOrdinal react-autoql-legend-2'
          />
        )}
        <rect
          ref={(el) => (this.legendClippingContainer = el)}
          width={0}
          height={0}
          transform={`translate(${-this.props.paddingHorizontal},${-this.props.paddingVertical})`}
          style={{
            stroke: 'transparent',
            fill: 'transparent',
            pointerEvents: 'none',
          }}
        />
      </g>
    )
  }
}
