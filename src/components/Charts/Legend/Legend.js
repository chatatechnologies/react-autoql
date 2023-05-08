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
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.LEFT_PADDING = 20
    this.BOTTOM_PADDING = 10
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
    removeFromDOM(this.rightLegendElement)
    removeFromDOM(this.rightLegendElement2)
  }

  renderAllLegends = () => {
    this.renderLegend(this.rightLegendElement, this.props.legendColumnIndices, this.props.colorScale)
    if (this.props.hasSecondAxis) {
      const isSecondLegend = true
      this.renderLegend(
        this.rightLegendElement2,
        this.props.numberColumnIndices2,
        this.props.colorScale2,
        isSecondLegend,
      )
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
      .attr('transform', 'translate(0,-3)')
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
      if (!legendLabels) {
        return
      }

      const title = this.getLegendTitleFromColumns(columnIndices)
      const legendScale = this.getLegendScale(legendLabels)

      if (this.props.placement === 'right') {
        select(legendElement)
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '12px')

        var legendOrdinal = legendColor()
          .orient('vertical')
          .path(symbol().type(symbolSquare).size(100)())
          .shapePadding(8)
          .labelWrap(100)
          .labelOffset(10)
          .scale(legendScale)
          .on('cellclick', function (d) {
            self.onClick(d, legendLabels)
          })
        if (isSecondLegend) {
          legendOrdinal.shape('line')
        } else if (this.props.shape) {
          legendOrdinal.shape(this.props.shape)
        }

        if (title) {
          legendOrdinal.title(title).titleWidth(this.MAX_LEGEND_WIDTH)
        }

        select(legendElement).call(legendOrdinal).style('font-family', 'inherit')

        if (isSecondLegend) {
          const legendBBox1 = this.rightLegendElement?.getBoundingClientRect()
          const topLegendBottomY = legendBBox1?.height ?? 0
          select(legendElement).attr('transform', `translate(${this.LEFT_PADDING}, ${topLegendBottomY + 35})`)
        }

        if (title) {
          if (this.props.onLegendTitleClick) {
            this.styleLegendTitleWithBorder(legendElement)
          } else {
            this.styleLegendTitleNoBorder(legendElement)
          }
        }

        // adjust container width to exact width of legend, to a maximum
        // this is so the updateMargins function works properly
        let legendWidth = select(legendElement).node()?.getBBox()?.width || 0
        if (legendWidth > this.MAX_LEGEND_WIDTH) {
          legendWidth = this.MAX_LEGEND_WIDTH
        }

        const legendBBox1 = this.rightLegendElement?.getBoundingClientRect()
        const legendBBox2 = this.rightLegendElement2?.getBoundingClientRect()
        const mergedBBox = mergeBboxes([legendBBox1, legendBBox2])

        let combinedLegendWidth = !isNaN(mergedBBox?.width) ? mergedBBox?.width : 0
        if (combinedLegendWidth > this.MAX_LEGEND_WIDTH) {
          combinedLegendWidth = this.MAX_LEGEND_WIDTH
        }

        const maxLegendHeight = this.props.height + 10
        select(this.legendClippingContainer)
          .attr('height', maxLegendHeight + this.BOTTOM_PADDING)
          .attr('width', combinedLegendWidth + this.LEFT_PADDING)

        this.removeHiddenLegendLabels(legendElement)
      } else if (this.props.placement === 'bottom') {
        select(this.bottomLegendElement)
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '10px')

        var legendOrdinal = legendColor()
          .orient('horizontal')
          .shapePadding(self.LEGEND_WIDTH)
          .labelWrap(this.MAX_LEGEND_WIDTH)
          .labelAlign('left')
          .scale(legendScale)
          .on('cellclick', function (d) {
            self.onClick(d, legendLabels)
          })

        select(this.bottomLegendElement).call(legendOrdinal).style('font-family', 'inherit')
      }

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
      <g data-test='legend'>
        {this.props.placement === 'right' && (
          <>
            <g
              ref={(el) => (this.rightLegendElement = el)}
              id={this.LEGEND_ID}
              data-test='right-legend'
              className='legendOrdinal right-legend'
              transform={`translate(${this.LEFT_PADDING}, 8)`}
            >
              {/* 
              Keep this around in case we want the ability to switch axis with legend in the future
              {this.props.legendColumn && (
              <LegendSelector
                {...this.props}
                column={this.props.legendColumn}
                positions={['bottom']}
                align='end'
                childProps={{
                  ref: (r) => (this.legendBorder = r),
                  x: (this.titleBBox?.x ?? 0),
                  y: (this.titleBBox?.y ?? 0),
                  width: (this.titleBBox?.width ?? 0) + this.BUTTON_PADDING * 2,
                  height: (this.titleBBox?.height ?? 0) + this.BUTTON_PADDING * 2,
                  transform: this.props.translate,
                }}
              />
            )} */}
            </g>
            {this.props.hasSecondAxis && (
              <g
                ref={(el) => (this.rightLegendElement2 = el)}
                id={this.LEGEND_ID}
                data-test='right-legend-2'
                className='legendOrdinal right-legend-2'
              />
            )}
          </>
        )}
        <rect
          ref={(el) => (this.legendClippingContainer = el)}
          width={0}
          height={this.props.height}
          transform='translate(0,-15)'
          style={{ stroke: 'transparent', fill: 'transparent', pointerEvents: 'none' }}
        />
        {this.props.placement === 'bottom' && (
          <g
            ref={(el) => (this.bottomLegendElement = el)}
            data-test='bottom-legend'
            id={this.LEGEND_ID}
            className='legendOrdinal'
          />
        )}
      </g>
    )
  }
}
