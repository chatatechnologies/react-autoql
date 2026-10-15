import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { hierarchy, treemap as d3Treemap, treemapResquarify } from 'd3-hierarchy'
import { scaleOrdinal } from 'd3-scale'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import 'd3-transition'
import { MdOutlineFitScreen } from 'react-icons/md'

import {
  getChartColorVars,
  getThemeValue,
  isColumnNumberType,
  isColumnStringType,
  isAggregation,
  findTreemapColumns,
  formatElement,
  getDataFormatting,
  getAutoQLConfig,
  MAX_TREEMAP_LEAVES,
} from 'autoql-fe-utils'
import { DataLimitWarning } from '../../DataLimitWarning'
import SankeyColumnSelector from '../ChataSankeyDiagram/SankeyColumnSelector'
import {
  BAR_GRADIENT_OPACITY_STOPS,
  SANKEY_VALUE_COUNT_SENTINEL,
  getPersistedColumnName,
  resolvePersistedColumnIndex,
  resolvePersistedColumnIndices,
} from '../chartPropHelpers'

import '../ChataSankeyDiagram/ChataSankeyDiagram.scss'
import './ChataTreemap.scss'

/** Persisted in `treemapValueColumnIndex` to size boxes by row count (same sentinel as Sankey). */
export const TREEMAP_VALUE_COUNT_SENTINEL = SANKEY_VALUE_COUNT_SENTINEL

const MAX_GROUP_LEVELS = 4
const FONT_SIZE = 11
// Rough average glyph widths, to avoid measuring text in the DOM. Labels are also clipped to their box,
// so an underestimate can only cut text short, never draw it outside the box.
const CHAR_WIDTH = FONT_SIZE * 0.6
const BOLD_CHAR_WIDTH = FONT_SIZE * 0.68
const LINE_HEIGHT = FONT_SIZE + 3
const LABEL_PADDING = 4
const PARENT_HEADER_HEIGHT = LINE_HEIGHT + 4
const PARENT_PADDING = 2
const MIN_LABEL_WIDTH = 30
// A group only gets a header strip when it's big enough on screen to hold one and still leave
// room for its boxes; smaller groups give all their space to their children.
const MIN_HEADER_GROUP_HEIGHT = 2 * PARENT_HEADER_HEIGHT + 2 * PARENT_PADDING
const LEAF_CORNER_RADIUS = 2
const MAX_ZOOM = 32

// Match the network graph's control buttons
const BUTTON_SIZE = 30
const BUTTON_RIGHT_OFFSET = 37
const BUTTON_TOP = 10
const BUTTON_STEP = 35
const BUTTON_ICON_SIZE = 20
const MARGIN_TOP = 10

const FALLBACK_COLORS = ['#5C7AFF', '#00C1D4', '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f']

const escapeHtml = (value = '') => {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const areNumberArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

const truncateToWidth = (text, width, charWidth = CHAR_WIDTH) => {
  const maxChars = Math.floor(width / charWidth)
  if (maxChars <= 0) {
    return ''
  }
  if (text.length <= maxChars) {
    return text
  }
  if (maxChars <= 3) {
    return ''
  }
  return `${text.substring(0, maxChars - 1)}…`
}

// Sum values (or count rows) per unique combination of group values. Returns leaves sorted largest first.
export const aggregateTreemapLeaves = (data, groupColumnIndices, valueColumnIndex) => {
  const countAsValue = valueColumnIndex === TREEMAP_VALUE_COUNT_SENTINEL
  const leafMap = new Map()

  data?.forEach((row) => {
    if (!row) {
      return
    }
    const value = countAsValue ? 1 : Number(row[valueColumnIndex])
    if (!(value > 0)) {
      return
    }

    const rawValues = groupColumnIndices.map((index) => row[index])
    const key = JSON.stringify(rawValues)
    const existing = leafMap.get(key)
    if (existing) {
      existing.value += value
    } else {
      leafMap.set(key, { rawValues, value })
    }
  })

  return Array.from(leafMap.values()).sort((a, b) => b.value - a.value)
}

// Nest flat leaves into a { children } tree, one level per group column.
export const buildTreemapTree = (leaves, groupColumnIndices, getDisplayValue) => {
  const root = { id: 'root', children: [], childMap: new Map(), path: [] }

  leaves.forEach(({ rawValues, value }) => {
    let node = root
    rawValues.forEach((rawValue, level) => {
      const columnIndex = groupColumnIndices[level]
      const key = `${rawValue ?? ''}`
      let child = node.childMap.get(key)
      if (!child) {
        const displayValue = getDisplayValue(rawValue, columnIndex)
        child = {
          id: `${node.id}|||${key}`,
          name:
            displayValue === null || displayValue === undefined || displayValue === '' ? '(Blank)' : `${displayValue}`,
          path: [...node.path, { columnIndex, rawValue }],
          children: [],
          childMap: new Map(),
        }
        node.childMap.set(key, child)
        node.children.push(child)
      }
      node = child
    })
    node.value = (node.value || 0) + value
  })

  return root
}

const ChataTreemap = forwardRef((props, forwardedRef) => {
  const columns = props.columns || []
  const gradientIdPrefix = useRef(`treemap-gradient-${uuid()}`).current
  const zoomSvgRef = useRef()
  const zoomGroupRef = useRef()
  const labelLayerRef = useRef()
  const committedTransformRef = useRef(zoomIdentity)
  const zoomBehaviorRef = useRef()

  const groupableColumnIndices = useMemo(
    () =>
      columns
        .map((col, index) => ({ col, index }))
        .filter(({ col }) => col?.is_visible !== false && isColumnStringType(col))
        .map(({ index }) => index),
    [props.columns],
  )

  // Data-aware defaults: low-cardinality group columns first, Count for percent/ratio-only data
  const detectedColumns = useMemo(() => findTreemapColumns(columns, props.data), [props.columns, props.data])

  // Grouped (aggregated) responses already have one row per group, so "Count" would count groups,
  // not records - only offer it for list queries
  const isAggregatedData = useMemo(() => isAggregation(columns), [props.columns])
  const numberColumnCount = columns.filter((col) => col?.isNumberType).length

  const isValidValueColumnIndex = (index) =>
    (index === TREEMAP_VALUE_COUNT_SENTINEL && !isAggregatedData) || (index >= 0 && isColumnNumberType(columns[index]))

  // Saved selections are matched by column name first, falling back to the saved index
  const getPersistedGroupColumnIndices = () =>
    resolvePersistedColumnIndices({
      names: props.initialChartControls?.treemapGroupColumnNames,
      indices: props.initialChartControls?.treemapGroupColumnIndices,
      columns,
    })

  const getPersistedValueColumnIndex = () =>
    resolvePersistedColumnIndex({
      name: props.initialChartControls?.treemapValueColumnName,
      index: props.initialChartControls?.treemapValueColumnIndex,
      columns,
    })

  const getValidGroupColumnIndices = (indices) =>
    Array.from(new Set((indices || []).filter((index) => groupableColumnIndices.includes(index)))).slice(
      0,
      MAX_GROUP_LEVELS,
    )

  const getDefaultGroupColumnIndices = () => {
    const persisted = getValidGroupColumnIndices(getPersistedGroupColumnIndices())
    if (persisted.length) {
      return persisted
    }

    const detected = getValidGroupColumnIndices(detectedColumns.groupColumnIndices)
    if (detected.length) {
      return detected
    }

    return groupableColumnIndices.slice(0, 1)
  }

  const getDefaultValueColumnIndex = () => {
    const persisted = getPersistedValueColumnIndex()
    if (isValidValueColumnIndex(persisted)) {
      return persisted
    }
    if (detectedColumns.countAsValue && !isAggregatedData) {
      return TREEMAP_VALUE_COUNT_SENTINEL
    }
    if (detectedColumns.valueColumnIndex >= 0) {
      return detectedColumns.valueColumnIndex
    }
    const firstNumberColumnIndex = columns.findIndex((col) => isColumnNumberType(col))
    if (firstNumberColumnIndex >= 0) {
      return firstNumberColumnIndex
    }
    return isAggregatedData ? -1 : TREEMAP_VALUE_COUNT_SENTINEL
  }

  const [groupColumnIndices, setGroupColumnIndices] = useState(getDefaultGroupColumnIndices)
  const [valueColumnIndex, setValueColumnIndex] = useState(getDefaultValueColumnIndex)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [showValueDropdown, setShowValueDropdown] = useState(false)
  // The zoom transform React last rendered with. Mid-gesture transforms are applied to the DOM directly.
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 })
  const zoomScale = zoomTransform.k
  const [activeKey, setActiveKey] = useState(null)

  // When columns change (eg. a column is added and indices shift), follow the selected columns by
  // name: translate the current indices to names using the previous columns, then find them again.
  const prevColumnsRef = useRef(columns)
  useEffect(() => {
    const prevColumns = prevColumnsRef.current
    prevColumnsRef.current = columns
    if (prevColumns === columns) {
      return
    }

    setGroupColumnIndices((prev) => {
      const next = resolvePersistedColumnIndices({
        names: prev.map((index) => getPersistedColumnName(index, prevColumns)),
        indices: prev,
        columns,
      })
      return areNumberArraysEqual(prev, next) ? prev : next
    })
    setValueColumnIndex((prev) =>
      resolvePersistedColumnIndex({ name: getPersistedColumnName(prev, prevColumns), index: prev, columns }),
    )
  }, [props.columns])

  // Keep selections valid if columns change underneath us (eg. a column is hidden).
  // Auto-corrections are local only, so they don't trigger dashboard update loops.
  useEffect(() => {
    setGroupColumnIndices((prev) => {
      const validPrev = getValidGroupColumnIndices(prev)
      const next = validPrev.length ? validPrev : getDefaultGroupColumnIndices()
      return areNumberArraysEqual(prev, next) ? prev : next
    })
  }, [groupableColumnIndices])

  useEffect(() => {
    if (!isValidValueColumnIndex(valueColumnIndex)) {
      const next = getDefaultValueColumnIndex()
      if (next !== valueColumnIndex) {
        setValueColumnIndex(next)
      }
    }
  }, [props.columns, valueColumnIndex])

  const persistTreemapControls = (updates) => {
    if (!props.onChartControlsChange) {
      return
    }
    props.onChartControlsChange({ ...(props.initialChartControls || {}), ...updates })
  }

  const handleGroupColumnsChange = (nextGroupColumnIndices) => {
    if (!nextGroupColumnIndices?.length || areNumberArraysEqual(nextGroupColumnIndices, groupColumnIndices)) {
      return
    }
    setGroupColumnIndices(nextGroupColumnIndices)
    persistTreemapControls({
      treemapGroupColumnIndices: nextGroupColumnIndices,
      treemapGroupColumnNames: nextGroupColumnIndices.map((index) => getPersistedColumnName(index, columns)),
    })
  }

  const handleValueColumnChange = (nextValueColumnIndex) => {
    if (nextValueColumnIndex === valueColumnIndex) {
      return
    }
    setValueColumnIndex(nextValueColumnIndex)
    persistTreemapControls({
      treemapValueColumnIndex: nextValueColumnIndex,
      treemapValueColumnName: getPersistedColumnName(nextValueColumnIndex, columns),
    })
  }

  const closeDropdowns = () => {
    setShowGroupDropdown(false)
    setShowValueDropdown(false)
  }

  const formattingConfig = useMemo(
    () => getDataFormatting(props.dataFormatting || getAutoQLConfig(props.autoQLConfig)?.dataFormatting),
    [props.dataFormatting, props.autoQLConfig],
  )

  const { tree, totalLeaves, isDataTruncated } = useMemo(() => {
    if (!props.data?.length || !groupColumnIndices.length || !isValidValueColumnIndex(valueColumnIndex)) {
      return { tree: null, totalLeaves: 0, isDataTruncated: false }
    }

    const allLeaves = aggregateTreemapLeaves(props.data, groupColumnIndices, valueColumnIndex)
    const truncated = allLeaves.length > MAX_TREEMAP_LEAVES
    const leaves = truncated ? allLeaves.slice(0, MAX_TREEMAP_LEAVES) : allLeaves

    const getDisplayValue = (rawValue, columnIndex) =>
      formatElement({ element: rawValue, column: columns[columnIndex], config: formattingConfig })

    return {
      tree: leaves.length ? buildTreemapTree(leaves, groupColumnIndices, getDisplayValue) : null,
      totalLeaves: allLeaves.length,
      isDataTruncated: truncated,
    }
  }, [props.data, props.columns, groupColumnIndices, valueColumnIndex, formattingConfig])

  const totalWidth = props.width || 600
  const totalHeight = props.height || 400
  const buttonX = totalWidth - BUTTON_RIGHT_OFFSET
  // Keep the treemap clear of the right-side controls
  const chartWidth = Math.max(0, buttonX - 10)
  const chartHeight = Math.max(0, totalHeight - MARGIN_TOP)

  const hierarchyRoot = useMemo(() => {
    if (!tree) {
      return null
    }
    return hierarchy(tree, (d) => (d.children?.length ? d.children : null))
      .sum((d) => (d.children?.length ? 0 : d.value || 0))
      .sort((a, b) => b.value - a.value)
  }, [tree])

  const hasHeader = (node, k) =>
    node.depth > 0 &&
    !!node.children &&
    (node.y1 - node.y0) * k >= MIN_HEADER_GROUP_HEIGHT &&
    (node.x1 - node.x0) * k >= MIN_LABEL_WIDTH

  // Re-laid out after each zoom with headers, padding and gaps divided by the zoom scale, so they
  // stay the same size on screen and the boxes get the space back. Resquarify reuses the previous
  // arrangement, so boxes resize in place instead of reshuffling. (~1ms for MAX_TREEMAP_LEAVES.)
  const layoutRoot = useMemo(() => {
    if (!hierarchyRoot || chartWidth <= 0 || chartHeight <= 0) {
      return null
    }

    const k = zoomScale
    return d3Treemap()
      .tile(treemapResquarify)
      .size([chartWidth, chartHeight])
      .round(k === 1) // Rounding to whole layout units would distort the scaled-down gaps when zoomed
      .paddingInner(1 / k)
      .paddingOuter((d) => (d.depth > 0 && (d.y1 - d.y0) * k >= MIN_HEADER_GROUP_HEIGHT ? PARENT_PADDING / k : 0))
      .paddingTop((d) => (hasHeader(d, k) ? PARENT_HEADER_HEIGHT / k : 0))(hierarchyRoot)
  }, [hierarchyRoot, chartWidth, chartHeight, zoomScale])

  // Zoom and pan: wheel to zoom, drag to pan, bounded to the treemap so it can't be lost off-screen.
  // The transform is applied directly to the DOM; React only re-renders when a gesture ends so
  // labels can re-fit to the new scale (zooming in reveals labels for smaller boxes).
  useEffect(() => {
    const svgElement = zoomSvgRef.current
    if (!svgElement || !hierarchyRoot || chartWidth <= 0 || chartHeight <= 0) {
      return
    }

    const svg = select(svgElement)
    const extent = [
      [0, 0],
      [chartWidth, chartHeight],
    ]

    const zoomBehavior = zoom()
      .extent(extent)
      .translateExtent(extent)
      .scaleExtent([1, MAX_ZOOM])
      .clickDistance(4) // Small mouse jitter during a click should still drill down
      .filter((event) => {
        if (event.type === 'wheel' || event.type.startsWith('touch')) {
          return true
        }
        return event.type === 'mousedown' && event.button === 0
      })
      .on('zoom', (event) => {
        const t = event.transform
        select(zoomGroupRef.current).attr('transform', t)

        // Labels are drawn in screen space for the last committed transform. Until the gesture ends,
        // move them with the boxes by applying only the change since then.
        const t0 = committedTransformRef.current
        const s = t.k / t0.k
        select(labelLayerRef.current).attr('transform', `translate(${t.x - s * t0.x}, ${t.y - s * t0.y}) scale(${s})`)
      })
      .on('end', (event) => {
        const { k, x, y } = event.transform
        committedTransformRef.current = event.transform
        setZoomTransform({ k, x, y })
      })

    zoomBehaviorRef.current = zoomBehavior
    svg.style('touch-action', 'none').call(zoomBehavior).on('dblclick.zoom', null)

    // New layout (data, columns or size changed): start from the fitted view
    committedTransformRef.current = zoomIdentity
    svg.call(zoomBehavior.transform, zoomIdentity)
    setZoomTransform({ k: 1, x: 0, y: 0 })

    return () => {
      svg.on('.zoom', null)
    }
  }, [hierarchyRoot, chartWidth, chartHeight])

  // Labels were just re-rendered for the committed transform, so drop the interim gesture transform
  // before the browser paints
  useLayoutEffect(() => {
    if (labelLayerRef.current) {
      select(labelLayerRef.current).attr('transform', null)
    }
  }, [zoomTransform])

  const fitToScreen = (e) => {
    e.stopPropagation()
    closeDropdowns()
    if (zoomSvgRef.current && zoomBehaviorRef.current) {
      select(zoomSvgRef.current).transition().duration(750).call(zoomBehaviorRef.current.transform, zoomIdentity)
    }
  }

  const colorScale = useMemo(() => {
    const chartPalette = getChartColorVars()?.chartColors?.filter(Boolean) || []
    const colors = chartPalette.length ? chartPalette : FALLBACK_COLORS
    return scaleOrdinal().range(colors)
  }, [props.themeConfig])

  const enableDrilldowns = getAutoQLConfig(props.autoQLConfig).enableDrilldowns
  // Set inline (not via CSS var) so labels keep their color in the exported PNG
  const themeTextColor = getThemeValue('text-color-primary')
  const isCountValue = valueColumnIndex === TREEMAP_VALUE_COUNT_SENTINEL
  const valueColumn = isCountValue ? undefined : columns[valueColumnIndex]

  const formatValue = (value) => {
    if (!valueColumn) {
      return `${value?.toLocaleString?.() ?? value}`
    }
    return `${formatElement({ element: value, column: valueColumn, config: formattingConfig })}`
  }

  const formatPercent = (part, whole) => {
    if (!whole) {
      return ''
    }
    return `${((part / whole) * 100).toFixed(1)}%`
  }

  const getTopLevelNode = (node) => node.ancestors().find((ancestor) => ancestor.depth === 1) ?? node

  const getTooltipHtml = (node) => {
    const pathRows = node.data.path
      .map(({ columnIndex }, i) => {
        const column = columns[columnIndex]
        const label = column?.display_name || column?.name || ''
        const value = node.ancestors().reverse()[i + 1]?.data?.name ?? ''
        return `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`
      })
      .join('<br/>')

    const valueLabel = isCountValue ? 'Count' : valueColumn?.display_name || valueColumn?.name || 'Value'
    let html = `${pathRows}<br/><strong>${escapeHtml(valueLabel)}:</strong> ${escapeHtml(formatValue(node.value))}`
    html += `<br/><strong>% of Total:</strong> ${formatPercent(node.value, layoutRoot.value)}`
    if (node.depth > 1 && node.parent) {
      html += `<br/><strong>% of ${escapeHtml(node.parent.data.name)}:</strong> ${formatPercent(
        node.value,
        node.parent.value,
      )}`
    }
    return html
  }

  const onNodeClick = (event, node) => {
    event.stopPropagation()
    closeDropdowns()

    if (!enableDrilldowns || !props.onChartClick) {
      return
    }

    const path = node.data.path
    if (path.some(({ columnIndex }) => !columns[columnIndex]?.name)) {
      return
    }

    const key = `treemap-${node.data.id}`
    setActiveKey(key)

    // The drilldown endpoint only accepts the query's group-by columns. When every level of the path
    // is one, drill down with group-bys (same shape as table cell drilldowns). Otherwise - eg. list
    // queries, or a level the user picked that isn't a group-by - run the query filtered on each
    // level's value instead (QueryOutput builds those filters, including dates and blanks).
    const allGroupable = path.every(({ columnIndex }) => columns[columnIndex]?.groupable)
    if (allGroupable) {
      const groupBys = path.map(({ columnIndex, rawValue }) => ({
        name: columns[columnIndex].name,
        drill_down: columns[columnIndex].drill_down,
        value: `${rawValue}`,
        operator: rawValue === null || rawValue === undefined ? 'is' : '=',
      }))
      props.onChartClick({ groupBys, activeKey: key })
      return
    }

    const row = new Array(columns.length).fill(undefined)
    path.forEach(({ columnIndex, rawValue }) => {
      row[columnIndex] = rawValue ?? null
    })
    props.onChartClick({
      stringColumnIndices: path.map(({ columnIndex }) => columnIndex),
      rows: path.map(() => row),
      activeKey: key,
    })
  }

  // Labels live outside the zoomed group, positioned in screen coordinates at a normal font size.
  // Drawing them inside the scaled group (with fontSize / k) makes the browser lay out tiny text and
  // scale it up, which visibly widens the letter spacing as you zoom in.
  const renderLabel = (node, isLeaf, clipId) => {
    const { k, x: tx, y: ty } = zoomTransform
    if (!isLeaf && !hasHeader(node, k)) {
      return null
    }

    // On-screen box, then the part of it inside the viewport. Leaf labels stick to the top-left of the
    // visible part, so zooming into the middle of a large box keeps its label in view. Group labels
    // stay in their header strip, sliding only horizontally.
    const boxX0 = node.x0 * k + tx
    const boxY0 = node.y0 * k + ty
    const boxX1 = node.x1 * k + tx
    const boxY1 = node.y1 * k + ty
    const visibleX0 = Math.max(boxX0, 0)
    const visibleX1 = Math.min(boxX1, chartWidth)
    const visibleY0 = isLeaf ? Math.max(boxY0, 0) : boxY0
    const visibleY1 = isLeaf ? Math.min(boxY1, chartHeight) : Math.min(boxY0 + PARENT_HEADER_HEIGHT, boxY1)
    const visibleWidth = visibleX1 - visibleX0
    const visibleHeight = visibleY1 - visibleY0

    const isOffScreen = visibleWidth <= 0 || visibleY1 <= 0 || visibleY0 >= chartHeight
    const availableWidth = visibleWidth - 2 * LABEL_PADDING
    if (isOffScreen || availableWidth < MIN_LABEL_WIDTH || visibleHeight < LINE_HEIGHT + LABEL_PADDING) {
      return null
    }

    const name = truncateToWidth(node.data.name, availableWidth, isLeaf ? CHAR_WIDTH : BOLD_CHAR_WIDTH)
    if (!name) {
      return null
    }

    const showValue = isLeaf && visibleHeight >= 2 * LINE_HEIGHT + LABEL_PADDING
    const value = showValue ? truncateToWidth(formatValue(node.value), availableWidth) : ''
    const textX = visibleX0 + LABEL_PADDING
    const textY = visibleY0 + LABEL_PADDING + FONT_SIZE

    return (
      <g key={clipId} clipPath={`url(#${clipId})`}>
        <clipPath id={clipId}>
          <rect x={visibleX0} y={visibleY0} width={visibleWidth} height={visibleHeight} />
        </clipPath>
        <text
          className='treemap-label'
          x={textX}
          y={textY}
          fill={themeTextColor}
          fontSize={FONT_SIZE}
          fontWeight={isLeaf ? 'normal' : 'bold'}
        >
          {name}
          {!!value && (
            <tspan x={textX} dy={LINE_HEIGHT} fillOpacity={0.75}>
              {value}
            </tspan>
          )}
        </text>
      </g>
    )
  }

  const renderLabels = () => {
    if (!layoutRoot) {
      return null
    }
    return layoutRoot
      .descendants()
      .filter((node) => node.depth > 0)
      .map((node, index) => renderLabel(node, !node.children, `${gradientIdPrefix}-clip-${index}`))
  }

  const renderNodes = () => {
    if (!layoutRoot) {
      return null
    }

    const topLevelColors = new Map()
    layoutRoot.children?.forEach((node, i) => topLevelColors.set(node.data.id, { color: colorScale(node.data.id), i }))

    // Same 3-stop opacity gradient as bars/columns, one per top-level group color
    const gradients = Array.from(topLevelColors.values()).map(({ color, i }) => (
      <linearGradient key={i} id={`${gradientIdPrefix}-${i}`} x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stopColor={color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[0]} />
        <stop offset='50%' stopColor={color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[1]} />
        <stop offset='100%' stopColor={color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[2]} />
      </linearGradient>
    ))

    // descendants() is breadth-first, so parents are drawn before (underneath) their children
    const nodes = layoutRoot
      .descendants()
      .filter((node) => node.depth > 0)
      .map((node) => {
        const isLeaf = !node.children
        const { color, i } = topLevelColors.get(getTopLevelNode(node).data.id)
        const isActive = activeKey === `treemap-${node.data.id}`

        return (
          <g key={node.data.id} className={`treemap-node ${isLeaf ? 'treemap-leaf' : 'treemap-parent'}`}>
            <rect
              className={`${isLeaf ? 'treemap-leaf-rect' : 'treemap-parent-rect'}${isActive ? ' active' : ''}`}
              x={node.x0}
              y={node.y0}
              width={Math.max(0, node.x1 - node.x0)}
              height={Math.max(0, node.y1 - node.y0)}
              rx={isLeaf ? LEAF_CORNER_RADIUS / zoomScale : 0}
              fill={isLeaf ? `url(#${gradientIdPrefix}-${i})` : color}
              fillOpacity={isLeaf ? 1 : 0.1}
              stroke={isLeaf ? 'none' : color}
              strokeOpacity={0.35}
              data-tooltip-id={props.chartTooltipID}
              data-tooltip-html={getTooltipHtml(node)}
              onClick={(e) => onNodeClick(e, node)}
            />
          </g>
        )
      })

    return (
      <>
        <defs>{gradients}</defs>
        {nodes}
      </>
    )
  }

  const renderWarning = () => {
    if (!isDataTruncated) {
      return null
    }
    const message = `Only the ${MAX_TREEMAP_LEAVES} largest groups (out of ${totalLeaves}) are displayed. Consider narrowing your query or removing a group level.`
    return <DataLimitWarning tooltipID={props.tooltipID} isTruncated customMessage={message} />
  }

  return (
    <g
      ref={forwardedRef}
      className={`react-autoql-treemap ${enableDrilldowns ? 'enable-drilldown' : ''}`}
      data-test='react-autoql-treemap'
      onClick={closeDropdowns}
    >
      {renderWarning()}

      {/* Nested svg clips zoomed content so it never draws over the controls */}
      <svg
        ref={zoomSvgRef}
        className='react-autoql-treemap-viz'
        x={0}
        y={MARGIN_TOP}
        width={chartWidth}
        height={chartHeight}
        style={{ overflow: 'hidden' }} // Library CSS can make nested svgs overflow; zoomed content must stay clipped
      >
        <rect className='treemap-background' width={chartWidth} height={chartHeight} fill='transparent' />
        <g ref={zoomGroupRef} className='treemap-nodes'>
          {renderNodes()}
        </g>
        <g ref={labelLayerRef} className='treemap-labels' style={{ pointerEvents: 'none' }}>
          {renderLabels()}
        </g>
        {!tree && (
          <text
            className='treemap-empty-message'
            x={chartWidth / 2}
            y={chartHeight / 2}
            textAnchor='middle'
            fill={themeTextColor}
          >
            No positive values to display
          </text>
        )}
      </svg>

      {/* Fit to screen - same styling as the Sankey reset zoom button */}
      <g
        className='sankey-reset-zoom-button'
        transform={`translate(${buttonX}, ${BUTTON_TOP})`}
        style={{ cursor: 'pointer' }}
        onClick={fitToScreen}
        data-tooltip-id={props.chartTooltipID}
        data-tooltip-html='Fit to screen'
      >
        <rect
          className='sankey-reset-zoom-button-rect'
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          rx='4'
          strokeWidth='1'
          opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
        />
        <g transform={`translate(${(BUTTON_SIZE - BUTTON_ICON_SIZE) / 2}, ${(BUTTON_SIZE - BUTTON_ICON_SIZE) / 2})`}>
          <MdOutlineFitScreen
            className='sankey-reset-zoom-button-icon'
            size={BUTTON_ICON_SIZE}
            style={{ opacity: 0 }}
          />
        </g>
      </g>

      {/* Column selectors share the Sankey selector UI */}
      <SankeyColumnSelector
        columns={columns}
        type='path'
        pathColumnIndices={groupColumnIndices}
        onPathChange={handleGroupColumnsChange}
        minPathColumns={1}
        maxPathColumns={MAX_GROUP_LEVELS}
        pathTitle='Group By'
        pathSubtitle='Order defines nesting (outermost first)'
        pathLabel='Group By'
        pathIconType='treemap'
        showDropdown={showGroupDropdown}
        setShowDropdown={setShowGroupDropdown}
        buttonX={buttonX}
        buttonY={BUTTON_TOP + BUTTON_STEP}
        buttonSize={BUTTON_SIZE}
        chartTooltipID={props.chartTooltipID}
      />
      <SankeyColumnSelector
        columns={columns}
        selectedIndex={valueColumnIndex}
        onSelect={handleValueColumnChange}
        type='value'
        allowCount={!isAggregatedData}
        disabled={isAggregatedData && numberColumnCount <= 1}
        disabledTooltip='Values are already aggregated by the query'
        showDropdown={showValueDropdown}
        setShowDropdown={setShowValueDropdown}
        buttonX={buttonX}
        buttonY={BUTTON_TOP + 2 * BUTTON_STEP}
        buttonSize={BUTTON_SIZE}
        chartTooltipID={props.chartTooltipID}
      />
    </g>
  )
})

ChataTreemap.displayName = 'ChataTreemap'

ChataTreemap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.array),
  columns: PropTypes.arrayOf(PropTypes.shape({})),
  width: PropTypes.number,
  height: PropTypes.number,
  onChartClick: PropTypes.func,
  themeConfig: PropTypes.shape({}),
  dataFormatting: PropTypes.shape({}),
  autoQLConfig: PropTypes.shape({}),
  initialChartControls: PropTypes.shape({
    treemapGroupColumnIndices: PropTypes.arrayOf(PropTypes.number),
    treemapGroupColumnNames: PropTypes.arrayOf(PropTypes.string),
    treemapValueColumnIndex: PropTypes.number,
    treemapValueColumnName: PropTypes.string,
  }),
  onChartControlsChange: PropTypes.func,
  tooltipID: PropTypes.string,
  chartTooltipID: PropTypes.string,
}

ChataTreemap.defaultProps = {
  data: [],
  columns: [],
  width: 800,
  height: 600,
  onChartClick: () => {},
  themeConfig: {},
  dataFormatting: {},
  autoQLConfig: {},
  initialChartControls: undefined,
  onChartControlsChange: undefined,
  tooltipID: undefined,
  chartTooltipID: undefined,
}

export default ChataTreemap
