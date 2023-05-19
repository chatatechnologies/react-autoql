import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { symbol, symbolSquare } from 'd3-shape'

import legendColor from '../D3Legend/D3Legend'

import { deepEqual, removeFromDOM, invertArray } from '../../../js/Util.js'
import { getLegendLabelsForMultiSeries, mergeBboxes } from '../helpers'
import { AGG_TYPES, NUMBER_COLUMN_TYPE_DISPLAY_NAMES } from '../../../js/Constants'

export default class Legend extends Component {
  constructor(props) {
    super(props)

    this.legendElements = []
    this.legendLabels1 = []
    this.legendLabels2 = []

    this.MAX_LEGEND_WIDTH = 100
    this.MAX_LEGEND_HEIGHT = 200
    this.LEGEND_ID = `axis-${uuid()}`
    this.BORDER_PADDING = 10
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
    this.legendElements?.forEach((el) => removeFromDOM(el))
  }

  renderAllLegends = () => {
    this.legendLabels1 = getLegendLabelsForMultiSeries(
      this.props.columns,
      this.props.colorScale,
      this.props.legendColumnIndices,
    )

    if (this.props.hasSecondAxis) {
      this.legendLabels2 = getLegendLabelsForMultiSeries(
        this.props.columns,
        this.props.colorScale2,
        this.props.numberColumnIndices2,
      )
    }

    this.legendLabelSections = this.getlegendLabelSections(this.legendLabels1, this.legendLabels2)

    this.legendLabelSections?.forEach((legendLabels, i) => {
      if (legendLabels[0]?.legendNumber === 1) {
        this.renderLegend(legendLabels, i)
      }
    })

    // this.renderLegend(this.legendElement, this.props.legendColumnIndices, legendLabels1)
    // if (this.props.hasSecondAxis) {
    //   const isSecondLegend = true
    //   this.renderLegend(this.legendElement2, this.props.numberColumnIndices2, legendLabels2, isSecondLegend)
    // }

    if (this.justMounted) {
      this.justMounted = false
      this.props.onRenderComplete()
    }
  }

  distributeListsEvenly = (list1Orig, list2Orig, numColumns) => {
    const list1 = _cloneDeep(list1Orig)
    const list2 = _cloneDeep(list2Orig)
    const totalSize = (list1?.length ?? 0) + (list2?.length ?? 0)
    const columns = []
    let currentListIndex = 0

    for (let i = 0; i < numColumns; i++) {
      columns.push([])
    }

    for (let i = 0; i < totalSize; i++) {
      const column = columns[i % numColumns]
      if (!column) return

      const currentList = currentListIndex === 0 ? list1 : list2
      if (currentList.length > 0) {
        const labelObj = currentList.shift()
        labelObj.legendNumber = currentListIndex + 1
        labelObj.legendSectionIndex = i
        column.push(labelObj)
      } else {
        currentListIndex = 1 - currentListIndex // Switch to the other list
        i-- // Repeat the current index to ensure even distribution
      }
    }

    return columns
    // console.log('TODO')
    // return invertArray(columns)
  }

  getlegendLabelSections = (legendLabels1, legendLabels2) => {
    let totalColumns = this.totalPossibleColumns
    const legendLabels1Size = legendLabels1?.length ?? 0
    const legendLabels2Size = legendLabels2?.length ?? 0
    const totalLabels = legendLabels1Size + legendLabels2Size

    if (totalLabels < this.totalPossibleColumns) {
      totalColumns = totalLabels
    }

    return this.distributeListsEvenly(legendLabels1, legendLabels2, totalColumns)
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

  onClick = (labelText, legendNumber) => {
    const labels = legendNumber === 2 ? this.legendLabels2 : this.legendLabels1
    const label = labels?.find((l) => l.label === labelText)

    if (!label) {
      return
    }

    const isHidingLabel = !label.hidden
    const visibleLegendLabels = labels?.filter((l) => !l.hidden)
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

  renderLegend = (legendLabels, sectionIndex) => {
    try {
      const self = this
      if (sectionIndex === 0) {
        this.combinedLegendWidth = 0
      }

      if (!legendLabels?.length) {
        return
      }

      const columnIndices =
        legendLabels[0]?.legendNumber === 2 ? this.props.numberColumnIndices2 : this.props.legendColumnIndices

      const legendElement = this.legendElements[sectionIndex]
      const isSecondLegend = legendLabels[0]?.legendNumber === 2
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
          self.onClick(d, legendLabels[0]?.legendNumber)
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

      if (sectionIndex > 0) {
        const previousLegendSectionsBBox = mergeBboxes(
          this.legendElements.filter((el, i) => el && i < sectionIndex).map((el) => el.getBoundingClientRect()),
        )

        if (this.props.placement === 'right') {
          const sectionShift = (previousLegendSectionsBBox?.height ?? 0) + this.VERTICAL_LEGEND_SPACING
          select(legendElement).attr('transform', `translate(0, ${sectionShift})`)
        } else if (this.props.placement === 'bottom') {
          const sectionShift = (previousLegendSectionsBBox?.width ?? 0) + this.HORIZONTAL_LEGEND_SPACING
          select(legendElement).attr('transform', `translate(${sectionShift}, ${this.props.paddingVertical})`)
        }
      }

      if (title) {
        if (this.props.onLegendTitleClick) {
          this.styleLegendTitleWithBorder(legendElement)
        } else {
          this.styleLegendTitleNoBorder(legendElement)
        }
      }

      const mergedBBox = mergeBboxes(this.legendElements.map((el) => el?.getBoundingClientRect())) // [legendBBox1, legendBBox2])

      this.combinedLegendWidth = !isNaN(mergedBBox?.width) ? mergedBBox?.width : 0
      this.combinedLegendHeight = !isNaN(mergedBBox?.height) ? mergedBBox?.height : 0
      if (this.props.placement === 'right') {
        if (this.combinedLegendWidth > this.MAX_LEGEND_WIDTH - this.props.paddingHorizontal * 2) {
          this.combinedLegendWidth = this.MAX_LEGEND_WIDTH - this.props.paddingHorizontal * 2
        }

        const maxLegendHeight = this.props.height
        select(this.legendClippingContainer)
          .attr('height', maxLegendHeight)
          .attr('width', this.combinedLegendWidth + this.props.paddingHorizontal * 2)
      } else if (this.props.placement === 'bottom') {
        if (this.combinedLegendHeight > this.MAX_LEGEND_HEIGHT - this.props.paddingVertical * 2) {
          this.combinedLegendHeight = this.MAX_LEGEND_HEIGHT - this.props.paddingVertical * 2
        }

        const maxLegendWidth = this.props.innerWidth
        const clippingWidth = maxLegendWidth < this.combinedLegendWidth ? maxLegendWidth : this.combinedLegendWidth
        select(this.legendClippingContainer)
          .attr('height', this.combinedLegendHeight + this.props.paddingVertical * 2)
          .attr('width', clippingWidth)
      }

      this.applyStylesForBorder(mergedBBox)
      this.removeHiddenLegendLabels(legendElement)
      this.applyStylesForHiddenSeries(legendElement, legendLabels)
      this.centerLegend(sectionIndex, mergedBBox)
    } catch (error) {
      console.error(error)
    }
  }

  applyStylesForBorder = (mergedBBox) => {
    if (!mergedBBox) return

    select(this.legendBorder)
      .attr('x', mergedBBox.x - this.BORDER_PADDING)
      .attr('y', mergedBBox.y - this.BORDER_PADDING)
      .attr('height', mergedBBox.width + 2 * this.BORDER_PADDING)
      .attr('width', mergedBBox.height + 2 * this.BORDER_PADDING)
  }

  centerLegend = (sectionIndex, mergedBBox) => {
    if (sectionIndex === this.legendLabelSections?.length - 1 && this.props.placement === 'bottom') {
      if (!mergedBBox || mergedBBox.width > this.props.innerWidth) {
        return
      }

      const centerX = this.props.innerWidth / 2
      const legendLeftX = this.legendContainer?.getBBox()?.x
      const legendCenterX = legendLeftX + mergedBBox.width / 2
      const translateX = centerX - legendCenterX

      select(this.legendContainer).attr('transform', `translate(${translateX}, ${this.props.paddingVertical})`)
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

  renderLegendSections = () => {
    this.totalPossibleColumns =
      Math.floor(this.props.innerWidth / (this.MAX_LEGEND_WIDTH + this.HORIZONTAL_LEGEND_SPACING)) ?? 1

    const sections = []
    for (let i = 0; i < this.totalPossibleColumns; i++) {
      sections.push(
        <g
          ref={(el) => (this.legendElements[i] = el)}
          key={`${this.LEGEND_ID}-${i}`}
          data-test='react-autoql-legend'
          className='legendOrdinal react-autoql-legend'
        />,
      )
    }

    return sections
  }

  renderLegendClippingContainer = () => {
    return (
      <rect
        ref={(el) => (this.legendClippingContainer = el)}
        width={0}
        height={0}
        rx={4}
        transform={`translate(${-this.props.paddingHorizontal},${-this.props.paddingVertical})`}
        style={{
          stroke: 'red', //  'transparent',
          fill: 'transparent',
          pointerEvents: 'none',
        }}
      />
    )
  }

  render = () => {
    return (
      <g
        ref={(r) => (this.legendContainer = r)}
        data-test='legend'
        transform={`translate(${this.props.paddingHorizontal}, ${this.props.paddingVertical})`}
      >
        {this.renderLegendSections()}
        {this.renderLegendClippingContainer()}
      </g>
    )
  }
}
