import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import _cloneDeep from 'lodash.clonedeep'
import { isMobile } from 'react-device-detect'
import { symbol, symbolSquare } from 'd3-shape'
import { Icon } from '../../Icon'
import LegendSelector from '../Legend/LegendSelector'
import LegendPopover from '../Legend/LegendPopover'
import './Legend.scss'

import {
  legendColor,
  deepEqual,
  removeFromDOM,
  COLUMN_TYPES,
  AGG_TYPES,
  getLegendLabelsForMultiSeries,
  mergeBoundingClientRects,
  getTitleCase,
} from 'autoql-fe-utils'

import safeGetBBox from '../../../utils/safeGetBBox'

// Module-level storage for filtered labels to persist across component remounts
const legendFilterStore = new Map()

export default class Legend extends React.Component {
  constructor(props) {
    super(props)

    this.legendElements = []
    this.legendLabels1 = []
    this.legendLabels2 = []

    this.LEGEND_ID = `axis-${uuid()}`
    this.BORDER_PADDING = isMobile ? 10 : 15
    this.BORDER_THICKNESS = 1
    this.HORIZONTAL_LEGEND_SPACING = isMobile ? 15 : 20
    this.VERTICAL_LEGEND_SPACING = isMobile ? 15 : 25
    this.SHAPE_SIZE = isMobile ? 50 : 75
    this.TOP_ADJUSTMENT = isMobile ? 12 : props.isAggregated ? 8 : 16
    this.DEFAULT_MAX_WIDTH = isMobile ? 100 : 140
    this.AXIS_TITLE_BORDER_PADDING_LEFT = 5
    this.AXIS_TITLE_BORDER_PADDING_TOP = 3
    this.justMounted = true
    this.allLegendLabels = [] // Store all labels before removing hidden ones
    this.filterButtonD3Element = null

    // Stable filter key per query + legend column
    const queryID = props.queryID || 'no-query-id'
    const legendColumnIdentifier = props.legendColumn?.name || props.legendColumn?.index || 'default'
    this.LEGEND_FILTER_KEY = `legend-${queryID}-${legendColumnIdentifier}`

    // Initialize persisted filter for this legend
    const savedFilter = props.legendFilterConfig?.[legendColumnIdentifier]?.filteredOutLabels

    if (savedFilter) {
      // Use filter from props (dashboard persistence)
      legendFilterStore.set(this.LEGEND_FILTER_KEY, savedFilter)
    } else if (!legendFilterStore.has(this.LEGEND_FILTER_KEY)) {
      // Initialize empty filter if it doesn't exist
      legendFilterStore.set(this.LEGEND_FILTER_KEY, [])
    }

    this.LEGEND_FILTER_KEY_2 = `${this.LEGEND_FILTER_KEY}-axis2`
    const axis2Identifier = `${legendColumnIdentifier}-axis2`
    const savedFilter2 = props.legendFilterConfig?.[axis2Identifier]?.filteredOutLabels
    if (savedFilter2) {
      legendFilterStore.set(this.LEGEND_FILTER_KEY_2, savedFilter2)
    } else if (!legendFilterStore.has(this.LEGEND_FILTER_KEY_2)) {
      legendFilterStore.set(this.LEGEND_FILTER_KEY_2, [])
    }

    this.state = {
      isColumnSelectorOpen: false,
      isLegendPopoverOpen: false,
      activeFilterSection: 0, // Which section's filter popover is open (0 = axis1, 1 = axis2)
    }
  }

  static propTypes = {
    title: PropTypes.string,
    paddingLeft: PropTypes.number,
    paddingRight: PropTypes.number,
    paddingTop: PropTypes.number,
    paddingBottom: PropTypes.number,
    legendColumn: PropTypes.shape({
      name: PropTypes.string,
      index: PropTypes.number,
      display_name: PropTypes.string,
    }),
    orientation: PropTypes.string,
    onLabelChange: PropTypes.func,
    onLegendClick: PropTypes.func,
    onLegendTitleClick: PropTypes.func,
    onVisibleLabelsChange: PropTypes.func,
    legendFilterConfig: PropTypes.shape({
      filteredOutLabels: PropTypes.arrayOf(PropTypes.string),
    }),
    onLegendFilterChange: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    scale: PropTypes.func,
    translate: PropTypes.string,
    height: PropTypes.number,
    width: PropTypes.number,
    onRenderComplete: PropTypes.func,
    queryID: PropTypes.string,

    // Additional commonly-used props (not exhaustive)
    columns: PropTypes.array,
    colorScale: PropTypes.func,
    colorScale2: PropTypes.func,
    legendColumnIndices: PropTypes.arrayOf(PropTypes.number),
    numberColumnIndices2: PropTypes.arrayOf(PropTypes.number),
    chartPadding: PropTypes.number,
    outerWidth: PropTypes.number,
    outerHeight: PropTypes.number,
    hasSecondAxis: PropTypes.bool,
    hiddenLegendLabels: PropTypes.array,
    popoverParentElement: PropTypes.any,
    fontSize: PropTypes.number,
    originalColumns: PropTypes.array,
    tableConfig: PropTypes.object,
    chartContainerRef: PropTypes.any,
  }

  static defaultProps = {
    title: undefined,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 11,
    onLabelChange: () => {},
    onLegendClick: () => {},
    onRenderComplete: () => {},
    translate: undefined,
    orientation: 'vertical',

    // sensible defaults for commonly-used props
    columns: [],
    colorScale: () => {},
    colorScale2: () => {},
    legendColumnIndices: [],
    numberColumnIndices2: [],
    chartPadding: 10,
    outerWidth: 800,
    outerHeight: 600,
    hasSecondAxis: false,
    hiddenLegendLabels: [],
    popoverParentElement: null,
    originalColumns: [],
    tableConfig: {},
    chartContainerRef: null,
  }

  componentDidMount = () => {
    // https://d3-legend.susielu.com/
    this.renderAllLegends()

    // Initialize hidden state for filtered labels on mount
    this.initializeFilteredLabelsFromConfig()
  }

  initializeFilteredLabelsFromConfig = () => {
    const filteredOutLabels1 = legendFilterStore.get(this.LEGEND_FILTER_KEY) || []
    const filteredOutLabels2 = legendFilterStore.get(this.LEGEND_FILTER_KEY_2) || []

    if (this.allLegendLabels.length > 0 && (filteredOutLabels1.length > 0 || filteredOutLabels2.length > 0)) {
      const allLabelStrings = this.allLegendLabels.map((l) => l.label)
      const visibleLabels = allLabelStrings.filter(
        (label) => !filteredOutLabels1.includes(label) && !filteredOutLabels2.includes(label),
      )

      if (this.props.onVisibleLabelsChange) {
        this.props.onVisibleLabelsChange(visibleLabels)
      }

      ;[...filteredOutLabels1, ...filteredOutLabels2].forEach((labelText) => {
        const labelObj = this.allLegendLabels.find((l) => l.label === labelText)
        if (labelObj && !labelObj.hidden) {
          this.props.onLegendClick?.(labelObj)
        }
      })
    }
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    // deep compare arrays/objects where appropriate
    if (!deepEqual(this.props.columns, nextProps.columns)) return true

    // primitive checks
    if (this.props.height !== nextProps.height) return true
    if (this.props.width !== nextProps.width) return true
    if (this.props.outerHeight !== nextProps.outerHeight) return true
    if (this.props.outerWidth !== nextProps.outerWidth) return true
    if (this.props.chartPadding !== nextProps.chartPadding) return true
    if (this.props.fontSize !== nextProps.fontSize) return true
    if (this.props.orientation !== nextProps.orientation) return true
    if (this.props.hasSecondAxis !== nextProps.hasSecondAxis) return true

    // reference checks for functions/scale objects
    if (this.props.colorScale !== nextProps.colorScale) return true
    if (this.props.colorScale2 !== nextProps.colorScale2) return true

    // deep compare arrays for indices and filter config
    if (!deepEqual(this.props.legendColumnIndices, nextProps.legendColumnIndices)) return true
    if (!deepEqual(this.props.numberColumnIndices2, nextProps.numberColumnIndices2)) return true
    if (!deepEqual(this.props.legendFilterConfig, nextProps.legendFilterConfig)) return true

    // UI state
    if (this.state.isColumnSelectorOpen !== nextState.isColumnSelectorOpen) return true
    if (this.state.isLegendPopoverOpen !== nextState.isLegendPopoverOpen) return true

    return false
  }

  componentDidUpdate = (prevProps) => {
    // Update filter key and load appropriate filter if legend column or queryID changed
    const prevLegendColumnId = prevProps.legendColumn?.name || prevProps.legendColumn?.index || 'default'
    const currentLegendColumnId = this.props.legendColumn?.name || this.props.legendColumn?.index || 'default'
    const prevQueryID = prevProps.queryID || 'no-query-id'
    const currentQueryID = this.props.queryID || 'no-query-id'

    if (prevLegendColumnId !== currentLegendColumnId || prevQueryID !== currentQueryID) {
      this.LEGEND_FILTER_KEY = `legend-${currentQueryID}-${currentLegendColumnId}`
      this.LEGEND_FILTER_KEY_2 = `${this.LEGEND_FILTER_KEY}-axis2`
      const axis2Identifier = `${currentLegendColumnId}-axis2`

      // Load filter from props (dashboard persistence) or initialize empty
      const savedFilter = this.props.legendFilterConfig?.[currentLegendColumnId]?.filteredOutLabels
      if (savedFilter) {
        legendFilterStore.set(this.LEGEND_FILTER_KEY, savedFilter)
      } else if (!legendFilterStore.has(this.LEGEND_FILTER_KEY)) {
        legendFilterStore.set(this.LEGEND_FILTER_KEY, [])
      }

      const savedFilter2 = this.props.legendFilterConfig?.[axis2Identifier]?.filteredOutLabels
      if (savedFilter2) {
        legendFilterStore.set(this.LEGEND_FILTER_KEY_2, savedFilter2)
      } else if (!legendFilterStore.has(this.LEGEND_FILTER_KEY_2)) {
        legendFilterStore.set(this.LEGEND_FILTER_KEY_2, [])
      }

      this.initializeFilteredLabelsFromConfig()
    } else if (
      this.props.legendFilterConfig?.[currentLegendColumnId]?.filteredOutLabels !==
        prevProps.legendFilterConfig?.[currentLegendColumnId]?.filteredOutLabels ||
      this.props.legendFilterConfig?.[`${currentLegendColumnId}-axis2`]?.filteredOutLabels !==
        prevProps.legendFilterConfig?.[`${currentLegendColumnId}-axis2`]?.filteredOutLabels
    ) {
      legendFilterStore.set(
        this.LEGEND_FILTER_KEY,
        this.props.legendFilterConfig?.[currentLegendColumnId]?.filteredOutLabels || [],
      )
      legendFilterStore.set(
        this.LEGEND_FILTER_KEY_2,
        this.props.legendFilterConfig?.[`${currentLegendColumnId}-axis2`]?.filteredOutLabels || [],
      )
      this.initializeFilteredLabelsFromConfig()
    }

    this.renderAllLegends()
  }

  componentWillUnmount = () => {
    this.legendElements?.forEach((el) => removeFromDOM(el))
    // Clear D3/DOM references to avoid retaining closures and improve test isolation
    this.filterButtonD3Element = null
    this.filterButtonPosition = null
    this.filterButtonPositions = [] // One position per section for multi-section legends
    this.columnSelectorPositions = [] // One position per section for dropdown rects
    this.legendElements = []
  }

  getTotalLeftPadding = () => {
    return this.props.paddingLeft + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalRightPadding = () => {
    return this.props.paddingRight + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalHorizontalPadding = () => {
    return this.getTotalLeftPadding() + this.getTotalRightPadding()
  }

  getTotalBottomPadding = () => {
    return this.props.paddingBottom + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalTopPadding = () => {
    return this.props.paddingTop + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalVerticalPadding = () => {
    return this.getTotalBottomPadding() + this.getTotalTopPadding()
  }

  getMaxLegendHeight = () => {
    if (this.props.orientation === 'vertical') {
      return this.props.height - this.getTotalVerticalPadding()
    }

    return Math.floor(0.5 * this.props.outerHeight) - Math.ceil(2 * this.BORDER_PADDING)
  }

  getMaxSectionWidth = () => {
    let maxWidth = this.DEFAULT_MAX_WIDTH
    if (this.props.orientation === 'horizontal') {
      const minSections = 2
      const totalHorizontalPadding = this.getTotalHorizontalPadding()
      const spacingBetweenSections = (minSections - 1) * this.HORIZONTAL_LEGEND_SPACING
      const totalChartPadding = this.props.chartPadding * 2
      const totalAvailableWidth =
        this.props.outerWidth - totalHorizontalPadding - spacingBetweenSections - totalChartPadding
      const minWidth = Math.floor(totalAvailableWidth / minSections)

      if (minWidth < this.DEFAULT_MAX_WIDTH) {
        maxWidth = minWidth
      }
    }

    return maxWidth
  }

  renderAllLegends = () => {
    // Clear any existing legend sections from the DOM
    if (this.legendElements && this.legendElements.length > 0) {
      this.legendElements.forEach((el) => {
        if (el) {
          // Remove all children from this legend section
          while (el.firstChild) {
            el.removeChild(el.firstChild)
          }
        }
      })
    }

    this.legendLabels1 = getLegendLabelsForMultiSeries(
      this.props.columns,
      this.props.colorScale,
      this.props.legendColumnIndices,
    )

    this.legendLabels2 = this.props.hasSecondAxis
      ? (this.legendLabels2 = getLegendLabelsForMultiSeries(
          this.props.columns,
          this.props.colorScale2,
          this.props.numberColumnIndices2,
        ))
      : []

    // Store all legend labels before filtering for the popover
    this.allLegendLabels = [...this.legendLabels1, ...this.legendLabels2]

    // Store unfiltered labels for filter popover (needed when applying filter)
    this.legendLabels1Raw = [...this.legendLabels1]
    this.legendLabels2Raw = [...this.legendLabels2]

    // Filter out labels that were removed via the filter popover (separate filter per axis)
    const filteredOutLabels1 = legendFilterStore.get(this.LEGEND_FILTER_KEY) || []
    const filteredOutLabels2 = legendFilterStore.get(this.LEGEND_FILTER_KEY_2) || []

    if (filteredOutLabels1?.length > 0) {
      this.legendLabels1 = this.legendLabels1.filter((l) => !filteredOutLabels1.includes(l.label))
    }
    if (filteredOutLabels2?.length > 0) {
      this.legendLabels2 = this.legendLabels2.filter((l) => !filteredOutLabels2.includes(l.label))
    }

    this.legendLabelSections = this.getLegendLabelSections(this.legendLabels1, this.legendLabels2)
    this.columnSelectorPositions = []
    this.filterButtonPositions = []

    this.legendLabelSections?.forEach((legendLabels, i) => {
      this.renderLegend(legendLabels, i)
    })

    if (this.justMounted) {
      this.justMounted = false
      this.props.onRenderComplete()
    }
  }

  distributeListsEvenly = (list1Orig, list2Orig, numSections) => {
    const list1 = _cloneDeep(list1Orig)
    const list2 = _cloneDeep(list2Orig)

    const list1Size = list1?.length ?? 0
    const list2Size = list2?.length ?? 0
    const totalSize = list1Size + list2Size
    const list1Distribution = list1Size / totalSize

    let list1NumSections = Math.round(list1Distribution * numSections)
    if (list2Size) {
      if (list1NumSections === numSections && numSections > 1) list1NumSections = numSections - 1
      if (list1NumSections === 0 && numSections > 1) list1NumSections = 1
    }

    const sections = [...new Array(numSections)].map(() => [])

    for (let i = 0; i < totalSize; i++) {
      sections.forEach((sectionList, sectionIndex) => {
        const isSecondLegend = sectionIndex >= list1NumSections
        const currentList = isSecondLegend ? list2 : list1

        if (currentList.length > 0) {
          const labelObj = currentList.shift()
          labelObj.legendNumber = isSecondLegend ? 2 : 1
          labelObj.legendSectionIndex = i

          if (sectionIndex === 0) {
            labelObj.isFirst = true
          } else if (sectionIndex === list1NumSections) {
            labelObj.isFirst = true
          }

          sectionList.push(labelObj)
        }
      })
    }

    return sections
  }

  getLegendLabelSections = (legendLabels1, legendLabels2) => {
    let totalSections = this.totalPossibleSections
    const legendLabels1Size = legendLabels1?.length ?? 0
    const legendLabels2Size = legendLabels2?.length ?? 0
    const totalLabels = legendLabels1Size + legendLabels2Size

    if (totalLabels < this.totalPossibleSections) {
      totalSections = totalLabels
    }

    return this.distributeListsEvenly(legendLabels1, legendLabels2, totalSections)
  }

  openLegendPopover = (sectionIndex = 0) => {
    this.setState({ isLegendPopoverOpen: true, activeFilterSection: sectionIndex })
  }

  closeLegendPopover = () => {
    this.setState({ isLegendPopoverOpen: false })
  }

  handleFilterApply = (visibleLabels) => {
    const sectionIndex = this.state.activeFilterSection
    const filterKey = sectionIndex === 0 ? this.LEGEND_FILTER_KEY : this.LEGEND_FILTER_KEY_2
    const allLabelsForSection = sectionIndex === 0 ? this.legendLabels1Raw : this.legendLabels2Raw
    const allLabelStrings = (allLabelsForSection || []).map((l) => l.label)

    const filteredOutLabels = allLabelStrings.filter((label) => !visibleLabels.includes(label))
    const previousFilteredOut = legendFilterStore.get(filterKey) || []

    const newlyFiltered = filteredOutLabels.filter((label) => !previousFilteredOut.includes(label))
    const newlyVisible = previousFilteredOut.filter((label) => !filteredOutLabels.includes(label))

    legendFilterStore.set(filterKey, filteredOutLabels)

    if (this.props.onLegendFilterChange) {
      const legendColumnIdentifier = this.props.legendColumn?.name || this.props.legendColumn?.index || 'default'
      const configKey = sectionIndex === 0 ? legendColumnIdentifier : `${legendColumnIdentifier}-axis2`
      this.props.onLegendFilterChange({
        [configKey]: { filteredOutLabels },
      })
    }

    if (this.props.onVisibleLabelsChange) {
      const shouldResetColors = visibleLabels.length === allLabelStrings.length
      this.props.onVisibleLabelsChange(shouldResetColors ? null : visibleLabels)
    }

    newlyFiltered.forEach((labelText) => {
      const labelObj = this.allLegendLabels.find((l) => l.label === labelText)
      if (labelObj && !labelObj.hidden) {
        this.props.onLegendClick?.(labelObj)
      }
    })

    newlyVisible.forEach((labelText) => {
      const labelObj = this.allLegendLabels.find((l) => l.label === labelText)
      if (labelObj && labelObj.hidden) {
        this.props.onLegendClick?.(labelObj)
      }
    })

    this.setState((s) => ({ __legendRenderToggle: !s.__legendRenderToggle }))
  }

  removeHiddenLegendLabels = (legendElement) => {
    // Remove red arrow if it has been rendered already
    select(legendElement).select('.legend-hidden-field-arrow').remove()

    const legendContainerBBox = this.legendBorder?.getBoundingClientRect()
    const legendBottom = (legendContainerBBox?.y ?? 0) + (legendContainerBBox?.height ?? 0) - this.BORDER_PADDING

    let hasRemovedElement = false
    let removedElementYBottom = undefined
    let removedElementTransform = undefined

    select(legendElement)
      .selectAll('.cell')
      .each(function () {
        if (hasRemovedElement) {
          select(this).remove()
        } else {
          const cellBBox = this.getBoundingClientRect()
          const cellBottom = (cellBBox?.y ?? 0) + (cellBBox?.height ?? 0) - 5

          if (cellBottom > legendBottom) {
            const bbox = safeGetBBox(this)
            removedElementYBottom = (bbox?.y ?? 0) + (bbox?.height ?? 0)
            removedElementTransform = select(this).attr('transform')
            select(this).remove()

            // Setting this to true lets loop skip bounding rect calculation
            // since every cell after this one should be removed
            hasRemovedElement = true
          }
        }
      })

    // Store state for render method
    this.hasHiddenLegendItems = hasRemovedElement
    this.hiddenLegendButtonY = removedElementYBottom
    this.hiddenLegendButtonTransform = removedElementTransform

    if (hasRemovedElement && removedElementTransform) {
      // Add red arrow indicator
      const tooltipID = this.props.chartTooltipID
      const verticalOffset = 5 // Add some spacing below the last legend item
      select(legendElement)
        .append('text')
        .html('&#9660 ...')
        .attr('class', 'legend-hidden-field-arrow')
        .attr('y', removedElementYBottom + verticalOffset)
        .attr('transform', removedElementTransform)
        .style('font-size', `${((this.props.fontSize - 3) / 16).toFixed(4)}rem`)
        .style('color', 'red')
        .style('font-weight', 'bold')
        .style('cursor', 'default')
        .style('pointer-events', 'none')
    }
  }

  styleLegendTitleNoBorder = (legendElement, isFirstSection) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .attr('fill-opacity', 0.9)
      .style('transform', 'translateY(-5px)')
  }

  styleLegendTitleWithBorder = (legendElement, sectionIndex, isFirstSection) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .append('tspan')
      .text('  ▼')
      .style('font-size', '0.5rem')
      .style('opacity', 0)
      .attr('class', 'react-autoql-axis-selector-arrow')

    this.titleBBox = {}
    try {
      const titleElement = select(legendElement).select('.legendTitle').node()
      const titleBBox = safeGetBBox(titleElement)
      const titleHeight = titleBBox?.height ?? 0
      const titleWidth = titleBBox?.width ?? 0
      this.titleBBox = titleBBox

      if (isFirstSection) {
        // Only add dropdown and filter for sections that have visible titles
        let sectionOffsetX = 0
        let sectionOffsetY = 0
        const transformAttr = legendElement?.getAttribute?.('transform')
        if (transformAttr) {
          const translateMatch = transformAttr.match(/translate\(([^,]+),\s*([^)]+)\)/)
          if (translateMatch) {
            sectionOffsetX = parseFloat(translateMatch[1]) || 0
            sectionOffsetY = parseFloat(translateMatch[2]) || 0
          }
        }

        const rectX = Math.round((titleBBox?.x ?? 0) + sectionOffsetX - this.AXIS_TITLE_BORDER_PADDING_LEFT)
        const rectY = Math.round((titleBBox?.y ?? 0) + sectionOffsetY - this.AXIS_TITLE_BORDER_PADDING_TOP)
        const rectWidth = Math.round(titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT)
        const rectHeight = Math.round(titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP)

        this.columnSelectorPositions[sectionIndex] = { x: rectX, y: rectY, width: rectWidth, height: rectHeight }

        this.renderFilterButtonWithD3(legendElement, titleBBox, sectionIndex)
        this.renderFilterBadge(legendElement, sectionIndex)
      } else {
        select(legendElement).select('.legend-filter-button-d3').remove()
        select(legendElement).select('.legend-filter-badge').remove()
      }
    } catch (error) {
      console.error(error)
    }
  }

  renderFilterButtonWithD3 = (legendElement, titleBBox, sectionIndex = 0) => {
    try {
      select(legendElement).select('.legend-filter-button-d3').remove()

      const iconSize = 14
      const buttonX = titleBBox.x + titleBBox.width + 20
      const buttonY = titleBBox.y + titleBBox.height / 2

      this.filterButtonPositions[sectionIndex] = { x: buttonX, y: buttonY }

      const buttonGroup = select(legendElement)
        .append('g')
        .attr('class', 'legend-filter-button-d3')
        .attr('opacity', '0')
        .style('cursor', 'pointer')
        .attr('role', 'button')
        .attr('tabindex', 0)
        .on('click', (event) => {
          event.stopPropagation()
          this.openLegendPopover(sectionIndex)
        })
        .on('keydown', (event) => {
          if (event && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) {
            event.preventDefault()
            event.stopPropagation()
            this.openLegendPopover(sectionIndex)
          }
        })

      // Background rect for hover - positioned using explicit x/y attributes
      const rectX = buttonX - iconSize / 2 - 2
      const rectY = buttonY - iconSize / 2 - 2

      buttonGroup
        .append('rect')
        .attr('x', rectX)
        .attr('y', rectY)
        .attr('width', iconSize + 4)
        .attr('height', iconSize + 4)
        .attr('fill', 'transparent')
        .attr('stroke', 'transparent')
        .attr('rx', 3)
        .attr('class', 'legend-filter-button-bg')

      // Use native SVG icon instead of foreignObject for better Safari compatibility
      const iconX = buttonX - iconSize / 2
      const iconY = buttonY - iconSize / 2

      // Add react-tooltip data attributes
      const tooltipID = this.props.chartTooltipID || this.props.tooltipID || `legend-filter-tooltip-${this.LEGEND_ID}`
      buttonGroup.attr('data-tooltip-id', tooltipID).attr('data-tooltip-content', 'Filter legend items')

      // Create a group for the icon and scale it to the desired size
      const iconGroup = buttonGroup
        .append('g')
        .attr('class', 'legend-filter-icon')
        .attr('transform', `translate(${iconX}, ${iconY}) scale(${iconSize / 24})`)
        .style('pointer-events', 'none')
        .attr('opacity', '0') // use css to style so it isnt exported in the png/csv

      iconGroup.append('path').attr('fill', 'none').attr('d', 'M0 0H24V24H0z')

      iconGroup
        .append('path')
        .attr('fill', 'currentColor')
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '0')
        .attr('d', 'M21 4v2h-1l-5 7.5V22H9v-8.5L4 6H3V4h18zM6.404 6L11 12.894V20h2v-7.106L17.596 6H6.404z')

      this.filterButtonD3Element = buttonGroup.node()
      this.filterButtonPosition = this.filterButtonPositions[0] || { x: buttonX, y: buttonY }
    } catch (error) {
      console.warn('Error rendering filter button with D3:', error)
    }
  }

  renderFilterBadge = (legendElement, sectionIndex = 0) => {
    try {
      select(legendElement).select('.legend-filter-badge').remove()

      const filterKey = sectionIndex === 0 ? this.LEGEND_FILTER_KEY : this.LEGEND_FILTER_KEY_2
      const filteredOutLabels = legendFilterStore.get(filterKey) || []
      const buttonPos = this.filterButtonPositions[sectionIndex] || this.filterButtonPosition
      if (filteredOutLabels.length === 0 || !buttonPos) {
        return
      }

      const iconSize = 14
      const badgeSize = 4
      const badgeX = buttonPos.x + iconSize / 2 - 4
      const badgeY = buttonPos.y - iconSize / 2 - 4

      const badgeGroup = select(legendElement).append('g').attr('class', 'legend-filter-badge').attr('opacity', '0') // use css to style so it isn't exported in the png/csv

      // Add badge circle - simple yellow dot like Icon component
      badgeGroup
        .append('circle')
        .attr('cx', badgeX)
        .attr('cy', badgeY)
        .attr('r', badgeSize)
        .attr('fill', 'var(--react-autoql-warning-color)')
        .attr('stroke', 'var(--react-autoql-background-color-secondary)')
        .attr('stroke-width', 1)
    } catch (error) {
      console.warn('Error rendering filter badge:', error)
    }
  }

  onClick = (labelText, labels) => {
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
      const columnTypeName = COLUMN_TYPES[columnTypeArray[0]]?.description
      if (columnTypeName) {
        title = `${columnTypeName} ${title}`
      }
    }

    const aggTypeArray = legendColumns.map((col) => col.aggType)
    const allAggTypesEqual = !aggTypeArray.find((agg) => agg !== aggTypeArray[0])
    if (allAggTypesEqual) {
      const aggName = AGG_TYPES[aggTypeArray[0]]?.displayName
      if (aggName) {
        title = `${title} (${aggName})`
      }
    }

    return title
  }

  renderLegend = (legendLabels, sectionIndex) => {
    try {
      const self = this

      if (!legendLabels?.length) {
        return
      }

      const legendNumber = legendLabels[0]?.legendNumber
      const columnIndices = legendNumber === 2 ? this.props.numberColumnIndices2 : this.props.legendColumnIndices
      const isFirstSection = !!legendLabels[0]?.isFirst
      const legendElement = this.legendElements[sectionIndex]
      const isSecondLegend = legendNumber === 2
      const allLabels = legendNumber === 2 ? this.legendLabels2 : this.legendLabels1
      const title = getTitleCase(this.getLegendTitleFromColumns(columnIndices))
      const legendScale = this.getLegendScale(legendLabels)
      const maxSectionWidth = this.getMaxSectionWidth()

      const legendOrdinal = legendColor()
        .orient('vertical')
        .path(symbol().type(symbolSquare).size(this.SHAPE_SIZE)())
        .shapePadding(8)
        .labelWrap(maxSectionWidth - 20)
        .labelOffset(10)
        .scale(legendScale)
        .title(title)
        .titleWidth(maxSectionWidth)
        .on('cellclick', function (d) {
          self.onClick(select(this)?.data()?.[0], allLabels)
        })

      if (isSecondLegend) {
        legendOrdinal.shape('line')
      } else if (this.props.shape) {
        legendOrdinal.shape(this.props.shape)
      }

      select(legendElement)
        .call(legendOrdinal)
        .attr('class', 'legendOrdinal')
        .style('fill', 'currentColor')
        .style('fill-opacity', '1')
        .style('font-family', 'inherit')
        .style('font-size', `${(this.props.fontSize / 16).toFixed(4)}rem`)

      select(legendElement)
        .selectAll('.cell')
        .style('font-size', `${((this.props.fontSize - 2) / 16).toFixed(4)}rem`)
        .each(function () {
          const cell = this
          const textElement = select(cell).select('text').node()

          if (!textElement) return

          // Get all text content (including from tspan elements)
          const allTextNodes = [textElement, ...select(textElement).selectAll('tspan').nodes()]

          allTextNodes.forEach((textNode) => {
            const textContent = textNode.textContent || ''
            if (!textContent.trim()) return

            // Split text into words and truncate words longer than 25 characters
            const words = textContent.split(/(\s+)/)
            const processedWords = words.map((word) => {
              const trimmedWord = word.trim()
              // Check if it's a word (not whitespace) and longer than 25 characters
              if (trimmedWord.length > 0 && trimmedWord.length > 25) {
                return word.replace(trimmedWord, trimmedWord.substring(0, 25) + '...')
              }
              return word
            })

            const processedText = processedWords.join('')
            if (processedText !== textContent) {
              textNode.textContent = processedText
            }
          })
        })

      if (sectionIndex > 0) {
        const previousLegendSectionsBBox = mergeBoundingClientRects(
          this.legendElements.filter((el, i) => el && i < sectionIndex).map((el) => el.getBoundingClientRect()),
        )

        if (this.props.orientation === 'vertical') {
          const sectionShift = (previousLegendSectionsBBox?.height ?? 0) + this.VERTICAL_LEGEND_SPACING
          select(legendElement).attr('transform', `translate(0,${sectionShift})`)
        } else if (this.props.orientation === 'horizontal') {
          const sectionShift = (previousLegendSectionsBBox?.width ?? 0) + this.HORIZONTAL_LEGEND_SPACING
          select(legendElement).attr('transform', `translate(${sectionShift},0)`)
        }
      }

      this.applyTitleStyles(title, isFirstSection, legendElement, sectionIndex)

      // Get filtered out labels per section for width calculation
      const filteredOutLabels1 = legendFilterStore.get(this.LEGEND_FILTER_KEY) || []
      const filteredOutLabels2 = legendFilterStore.get(this.LEGEND_FILTER_KEY_2) || []

      // Calculate bounding box only from visible cells (excluding filtered/hidden labels)
      const visibleCellBBoxes = []
      this.legendElements.forEach((el, index) => {
        if (!el) return

        const sectionLabels = index === 0 ? this.legendLabels1 : this.legendLabels2
        const legendLabelsForSection = sectionLabels || []
        const sectionLegendLabels = this.legendLabelSections?.[index] || []
        const isAxis2Section = sectionLegendLabels[0]?.legendNumber === 2
        const filteredOutLabels = isAxis2Section ? filteredOutLabels2 : filteredOutLabels1

        select(el)
          .selectAll('.cell')
          .each(function () {
            const cellData = select(this).data()?.[0]
            if (!cellData) return

            if (filteredOutLabels.includes(cellData)) return

            const labelObj = legendLabelsForSection.find((l) => l.label === cellData)
            if (labelObj?.hidden) return

            const cellBBox = this.getBoundingClientRect()
            if (cellBBox) {
              visibleCellBBoxes.push(cellBBox)
            }
          })
      })

      // Include title and filter button in width calculation
      const allBBoxes = [...visibleCellBBoxes]

      // Add title width from ALL legend sections (for horizontal legends with multiple sections)
      // Use maxSectionWidth since title should wrap to that width
      this.legendElements.forEach((el, index) => {
        if (!el) return
        const titleElement = select(el).select('.legendTitle').node()
        if (titleElement) {
          const titleClientRect = titleElement.getBoundingClientRect()
          if (titleClientRect && titleClientRect.width > 0 && titleClientRect.height > 0) {
            // Use the minimum of actual width and maxSectionWidth (title should wrap)
            const titleWidth = Math.min(titleClientRect.width, maxSectionWidth)
            // Create a rect that represents the wrapped title width
            const wrappedTitleRect = {
              ...titleClientRect,
              width: titleWidth,
              right: titleClientRect.left + titleWidth,
            }
            allBBoxes.push(wrappedTitleRect)
          }
        }

        // Also include the entire legend element's bounding box to ensure we capture everything
        // This is a fallback in case individual elements don't capture the full extent
        const legendElementRect = el.getBoundingClientRect()
        if (legendElementRect && legendElementRect.width > 0 && legendElementRect.height > 0) {
          allBBoxes.push(legendElementRect)
        }
      })

      // Add filter button bounding boxes for all sections
      this.legendElements.forEach((el) => {
        if (!el) return
        const btn = select(el).select('.legend-filter-button-d3').node()
        if (btn) {
          const bbox = btn.getBoundingClientRect()
          if (bbox) allBBoxes.push(bbox)
        }
      })

      const mergedBBox = mergeBoundingClientRects(allBBoxes)

      this.combinedLegendWidth = !isNaN(mergedBBox?.width) ? mergedBBox?.width : 0
      this.combinedLegendHeight = !isNaN(mergedBBox?.height) ? mergedBBox?.height : 0

      const totalHorizontalPadding = this.getTotalHorizontalPadding()
      const totalVerticalPadding = this.getTotalVerticalPadding()

      const maxLegendWidth = this.props.outerWidth - totalHorizontalPadding
      const maxLegendHeight = this.getMaxLegendHeight()

      const height = this.combinedLegendHeight <= maxLegendHeight ? this.combinedLegendHeight : maxLegendHeight
      const width = this.combinedLegendWidth <= maxLegendWidth ? this.combinedLegendWidth : maxLegendWidth

      select(this.legendClippingContainer)
        .attr('height', height + totalVerticalPadding)
        .attr('width', width + totalHorizontalPadding)

      // Set border height to maxLegendHeight when there's overflow so removeHiddenLegendLabels can properly detect overflow
      const borderHeight = this.combinedLegendHeight > maxLegendHeight ? maxLegendHeight : height
      select(this.legendBorder)
        .attr('height', borderHeight + 2 * this.BORDER_PADDING)
        .attr('width', width + 2 * this.BORDER_PADDING)

      this.removeHiddenLegendLabels(legendElement)
      this.applyStylesForHiddenSeries(legendElement, legendLabels)

      if (this.props.isAggregated && isFirstSection && legendElement) {
        setTimeout(() => {
          this.renderFilterBadge(legendElement, sectionIndex)
        }, 0)
      }
    } catch (error) {
      console.error(error)
    }
  }

  applyTitleStyles = (title, isFirstSection, legendElement, sectionIndex) => {
    if (title) {
      if (this.props.isAggregated) {
        this.styleLegendTitleWithBorder(legendElement, sectionIndex, isFirstSection)
      } else {
        this.styleLegendTitleNoBorder(legendElement, isFirstSection)
      }

      if (!isFirstSection) {
        select(legendElement).select('.legendTitle').style('fill-opacity', 0)
      }
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
              select(this).attr('class', 'cell legend-cell-hidden')
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
    if (this.props.orientation === 'horizontal') {
      const maxSectionWidth = this.getMaxSectionWidth()
      const totalHorizontalPadding = this.getTotalHorizontalPadding()
      const totalPossibleWidth = this.props.outerWidth - totalHorizontalPadding

      const availableWidth =
        totalPossibleWidth - this.HORIZONTAL_LEGEND_SPACING * (Math.ceil(totalPossibleWidth / maxSectionWidth) - 1)

      const totalPossibleSections = Math.floor(availableWidth / maxSectionWidth)

      this.totalPossibleSections = totalPossibleSections >= 2 ? totalPossibleSections : 2
    } else if (this.props.hasSecondAxis) {
      this.totalPossibleSections = 2
    }

    if (!this.totalPossibleSections) {
      this.totalPossibleSections = 1
    }

    const sections = [...new Array(this.totalPossibleSections)].map((row, i) => {
      return (
        <g
          ref={(el) => (this.legendElements[i] = el)}
          key={`${this.LEGEND_ID}-${i}`}
          data-test='react-autoql-legend'
          className='legendOrdinal react-autoql-legend'
        />
      )
    })

    return sections
  }

  renderLegendBorder = () => {
    return (
      <rect
        ref={(r) => (this.legendBorder = r)}
        width={0}
        height={0}
        rx={2}
        transform={`translate(${-this.BORDER_PADDING - this.BORDER_THICKNESS},${
          -this.BORDER_PADDING - this.TOP_ADJUSTMENT - this.BORDER_THICKNESS
        })`}
        style={{
          stroke: 'var(--react-autoql-border-color)',
          fill: 'transparent',
          pointerEvents: 'none',
          strokeOpacity: 0.8,
          strokeWidth: 1,
        }}
      />
    )
  }

  renderLegendClippingContainer = (translateX, translateY) => {
    return (
      <rect
        ref={(el) => (this.legendClippingContainer = el)}
        width={0}
        height={0}
        rx={4}
        transform={`translate(${-translateX},${-translateY})`}
        style={{
          stroke: 'transparent',
          fill: 'transparent',
          pointerEvents: 'none',
        }}
      />
    )
  }
  openSelector = () => {
    this.setState({ isColumnSelectorOpen: true }, () => {})
  }

  closeSelector = () => {
    this.setState({ isColumnSelectorOpen: false })
  }

  renderTitleSelector = () => {
    const positions = this.columnSelectorPositions?.filter(Boolean) || []
    return (
      <LegendSelector
        tableConfig={this.props.tableConfig}
        chartContainerRef={this.props.chartContainerRef}
        changeStringColumnIndex={this.props.changeStringColumnIndex}
        changeLegendColumnIndex={this.props.changeLegendColumnIndex}
        legendColumn={this.props.legendColumn}
        popoverParentElement={this.props.popoverParentElement}
        stringColumnIndices={this.props.stringColumnIndices}
        stringColumnIndex={this.props.stringColumnIndex}
        numberColumnIndex={this.props.numberColumnIndex}
        numberColumnIndices={this.props.numberColumnIndices}
        numberColumnIndices2={this.props.numberColumnIndices2}
        hasSecondAxis={this.props.hasSecondAxis}
        isAggregation={this.props.isAggregation}
        tooltipID={this.props.tooltipID}
        columns={this.props.originalColumns}
        align='center'
        positions={['bottom', 'top', 'left', 'right']}
        legendSelectorRef={(r) => (this.columnSelector = r)}
        isOpen={this.state.isColumnSelectorOpen}
        closeSelector={this.closeSelector}
      >
        <g>
          {positions.map((pos, i) => (
            <rect
              key={`column-selector-${i}`}
              className='axis-label-border'
              data-test='axis-label-border'
              x={pos.x}
              y={pos.y}
              width={pos.width}
              height={pos.height}
              onClick={this.openSelector}
              fill='transparent'
              stroke='transparent'
              strokeWidth='1px'
              rx='4'
            />
          ))}
        </g>
      </LegendSelector>
    )
  }

  renderLegendPopover = (sectionIndex, iconSize) => {
    const buttonPos = this.filterButtonPositions[sectionIndex]
    if (!buttonPos) return null

    const filterKey = sectionIndex === 0 ? this.LEGEND_FILTER_KEY : this.LEGEND_FILTER_KEY_2
    const legendLabels = sectionIndex === 0 ? (this.legendLabels1Raw || this.legendLabels1) : (this.legendLabels2Raw || this.legendLabels2)
    const colorScale = sectionIndex === 0 ? this.props.colorScale : this.props.colorScale2

    return (
      <LegendPopover
        key={`legend-popover-${sectionIndex}`}
        isOpen={this.state.isLegendPopoverOpen && this.state.activeFilterSection === sectionIndex}
        legendLabels={legendLabels || []}
        colorScale={colorScale || this.props.colorScale}
        onClose={this.closeLegendPopover}
        popoverParentElement={this.props.popoverParentElement}
        onLegendClick={this.props.onLegendClick}
        onFilterApply={this.handleFilterApply}
        hiddenLegendLabels={this.props.hiddenLegendLabels}
        filteredOutLabels={legendFilterStore.get(filterKey) || []}
        shapeSize={this.SHAPE_SIZE}
        chartHeight={this.props.outerHeight}
      >
        <rect
          x={buttonPos.x - iconSize / 2 - 2}
          y={buttonPos.y - iconSize / 2 - 2}
          width={iconSize + 4}
          height={iconSize + 4}
          fill='transparent'
          stroke='transparent'
          style={{ pointerEvents: 'none' }}
        />
      </LegendPopover>
    )
  }

  render = () => {
    const translateX = this.getTotalLeftPadding()
    const translateY = this.getTotalTopPadding() + this.TOP_ADJUSTMENT
    const iconSize = 14

    return (
      <>
        <g data-test='legend' transform={`translate(${translateX}, ${translateY})`}>
          {this.renderLegendSections()}
          {this.renderLegendClippingContainer(translateX, translateY)}
          {this.renderLegendBorder()}
          {this.props.isAggregated && this.renderTitleSelector()}
          {this.props.isAggregated &&
            (this.filterButtonPositions || []).map((_, i) => this.renderLegendPopover(i, iconSize))}
        </g>
      </>
    )
  }
}
