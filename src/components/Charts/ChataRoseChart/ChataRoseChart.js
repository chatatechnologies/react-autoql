import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { arc as d3Arc } from 'd3-shape'
import { scaleRadial } from 'd3-scale'
import { select } from 'd3-selection'
import 'd3-transition'

import {
  getChartColorVars,
  getThemeValue,
  isColumnNumberType,
  isColumnStringType,
  isAggregation,
  findRoseColumns,
  formatElement,
  getDataFormatting,
  getAutoQLConfig,
  MAX_ROSE_CATEGORIES,
} from 'autoql-fe-utils'
import { DataLimitWarning } from '../../DataLimitWarning'
import SankeyColumnSelector from '../ChataSankeyDiagram/SankeyColumnSelector'
import { BAR_GRADIENT_OPACITY_STOPS, SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'
import { buildRoseData } from './buildRoseData'
import { buildNumericCategories } from './numericCategories'
import {
  DEFAULT_ROSE_SCALE,
  ROSE_SCALES,
  ROSE_SCALE_LABELS,
  buildMeasureFrames,
  getMeasureScaleTicks,
} from './measureScales'
import RoseSettingsControl, { ROSE_MODES } from './RoseSettingsControl'
import {
  useTimeAnimation,
  TimeAnimationControl,
  TimeAnimationTimeline,
  easeCubicInOut,
  getTimelineExtraHeight,
} from '../TimeAnimation'

import '../ChataSankeyDiagram/ChataSankeyDiagram.scss'
import './ChataRoseChart.scss'

const MAX_LAYERS = 4
// Measures mode is the default when there's a date to step through and at least this many measures
const MIN_DEFAULT_MEASURES = 3
const MIN_MEASURES = 2
const FONT_SIZE = 11
const TICK_FONT_SIZE = 9
// Rough average glyph width, to avoid measuring text in the DOM
const CHAR_WIDTH = FONT_SIZE * 0.6
const LABEL_OFFSET = 8
// Space reserved beside the rose for labels; labels can use more when the chart is wider than it needs
const LABEL_RESERVED_WIDTH = 110
const MAX_LABEL_WIDTH = 260
const LABEL_EDGE_PADDING = 4
const INNER_RADIUS_RATIO = 0.12
const TWEEN_DURATION = 500
const MIN_WEDGES = 8
const RADIUS_PER_WEDGE = 10
const OTHER_MAX_RATIO = 2

// Match the network graph's control buttons
const BUTTON_SIZE = 30
const BUTTON_RIGHT_OFFSET = 37
const BUTTON_TOP = 10
const BUTTON_STEP = 35
const MARGIN_TOP = 10

// The time animation's timeline sits beside the rose when there's room, otherwise under it
const TIMELINE_BESIDE_MIN_WIDTH = 480
const TIMELINE_MIN_WIDTH = 150
// Width the timeline gets beside the rose when there's no spare room to give it
const TIMELINE_MAX_WIDTH = 240
const TIMELINE_WIDTH_RATIO = 0.3
const TIMELINE_MAX_HEIGHT = 140
const TIMELINE_BELOW_HEIGHT = 80
const TIMELINE_GAP = 16

const FALLBACK_COLORS = ['#5C7AFF', '#00C1D4', '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f']
const FALLBACK_NEGATIVE_COLOR = '#CA0B00'

const escapeHtml = (value = '') => {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const areNumberArraysEqual = (a = [], b = []) => a.length === b.length && a.every((value, i) => value === b[i])

const truncateToWidth = (text, width) => {
  const maxChars = Math.floor(width / CHAR_WIDTH)
  if (text.length <= maxChars) {
    return text
  }
  if (maxChars <= 3) {
    return ''
  }
  return `${text.substring(0, maxChars - 1)}…`
}

const LABEL_PADDING = 2

// Places labels in priority order, skipping any whose (estimated) box would overlap one already placed.
// Hidden labels are still in their wedge's tooltip.
export const placeRoseLabels = (labels) => {
  const placed = []
  labels
    .slice()
    .sort((a, b) => b.priority - a.priority)
    .forEach((label) => {
      const left =
        label.textAnchor === 'start'
          ? label.x
          : label.textAnchor === 'end'
          ? label.x - label.width
          : label.x - label.width / 2
      const box = {
        left: left - LABEL_PADDING,
        right: left + label.width + LABEL_PADDING,
        top: label.y - FONT_SIZE * 0.8 - LABEL_PADDING,
        bottom: label.y + FONT_SIZE * 0.25 + LABEL_PADDING,
      }
      const overlaps = placed.some(
        ({ box: other }) =>
          box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top,
      )
      if (!overlaps) {
        placed.push({ ...label, box })
      }
    })
  return placed
}

const getStackSize = (category) => category.values.reduce((sum, value) => sum + Math.abs(value), 0)

// "Other" sums everything that didn't get its own wedge, so it can dwarf the real categories and
// shrink them to slivers. It's drawn to scale up to OTHER_MAX_RATIO times the biggest real wedge;
// beyond that it stops at that size and is marked as not to scale.
const getScaleMaxStack = (categories) => {
  const realCategories = categories.filter((category) => !category.isOther)
  if (!realCategories.length) {
    return Math.max(0, ...categories.map(getStackSize))
  }
  const maxRealStack = Math.max(0, ...realCategories.map(getStackSize))
  const otherStack = Math.max(0, ...categories.filter((category) => category.isOther).map(getStackSize))
  return Math.max(maxRealStack, Math.min(otherStack, maxRealStack * OTHER_MAX_RATIO))
}

// Fewer wedges on smaller charts so each stays wide enough to see, hover and label
export const getRoseMaxCategories = (outerRadius) =>
  Math.min(MAX_ROSE_CATEGORIES, Math.max(MIN_WEDGES, Math.floor(outerRadius / RADIUS_PER_WEDGE)))

const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const SEGMENT_GEOMETRY_KEYS = ['startAngle', 'endAngle', 'innerRadius', 'outerRadius']
const lerpSegment = (from, to, t) => {
  const segment = { ...to }
  SEGMENT_GEOMETRY_KEYS.forEach((key) => {
    segment[key] = from[key] + (to[key] - from[key]) * t
  })
  return segment
}
const isSameGeometry = (a, b) => SEGMENT_GEOMETRY_KEYS.every((key) => a[key] === b[key])

const ChataRoseChart = forwardRef((props, forwardedRef) => {
  const columns = props.columns || []
  const gradientIdPrefix = useRef(`rose-gradient-${uuid()}`).current
  const pathRefs = useRef(new Map())
  const previousRenderRef = useRef(null)
  // The shape each wedge is drawn with right now, mid-tween included
  const drawnSegmentsRef = useRef(new Map())

  // Number columns can be the category too: their values (or ranges of them) become the wedges
  const categoryColumnOptionIndices = useMemo(
    () =>
      columns
        .map((col, index) => ({ col, index }))
        .filter(({ col }) => col?.is_visible !== false && (isColumnStringType(col) || isColumnNumberType(col)))
        .map(({ index }) => index),
    [props.columns],
  )

  const numberColumnIndices = useMemo(
    () =>
      columns
        .map((col, index) => ({ col, index }))
        .filter(({ col }) => col?.is_visible !== false && isColumnNumberType(col))
        .map(({ index }) => index),
    [props.columns],
  )

  // Data-aware defaults: a non-date category column with a sensible number of values, Count for percent/ratio-only data
  const detectedColumns = useMemo(() => findRoseColumns(columns, props.data), [props.columns, props.data])

  // Grouped (aggregated) responses already have one row per group, so "Count" would count groups,
  // not records - only offer it for list queries
  const isAggregatedData = useMemo(() => isAggregation(columns), [props.columns])
  const valueColumnOptionIndices = isAggregatedData
    ? numberColumnIndices
    : [SANKEY_VALUE_COUNT_SENTINEL, ...numberColumnIndices]

  const getValidValueColumnIndices = (indices) =>
    Array.from(new Set((indices || []).filter((index) => valueColumnOptionIndices.includes(index)))).slice(
      0,
      MAX_LAYERS,
    )

  // Category columns with a single value would draw one full circle, so they can't be picked
  const singleValueColumnIndices = useMemo(
    () =>
      categoryColumnOptionIndices.filter((index) => {
        const first = props.data?.find(Boolean)?.[index]
        return !props.data?.some((row) => row && row[index] !== first)
      }),
    [categoryColumnOptionIndices, props.data],
  )

  const isValidCategoryColumnIndex = (index) => categoryColumnOptionIndices.includes(index)

  const getDefaultCategoryColumnIndex = () => {
    const persisted = props.initialChartControls?.roseCategoryColumnIndex
    if (isValidCategoryColumnIndex(persisted)) {
      return persisted
    }
    if (isValidCategoryColumnIndex(detectedColumns.categoryColumnIndex)) {
      return detectedColumns.categoryColumnIndex
    }
    return categoryColumnOptionIndices[0] ?? -1
  }

  const getDefaultValueColumnIndices = () => {
    const persisted = getValidValueColumnIndices(props.initialChartControls?.roseValueColumnIndices)
    if (persisted.length) {
      return persisted
    }
    if (detectedColumns.countAsValue && !isAggregatedData) {
      return [SANKEY_VALUE_COUNT_SENTINEL]
    }
    const detected = getValidValueColumnIndices(detectedColumns.valueColumnIndices)
    if (detected.length) {
      return detected
    }
    return valueColumnOptionIndices.length ? [numberColumnIndices[0] ?? SANKEY_VALUE_COUNT_SENTINEL] : []
  }

  // Measures mode: each wedge is a number column (or Count, for list queries), shown one period at a time
  const measureOptionIndices = isAggregatedData
    ? numberColumnIndices
    : [SANKEY_VALUE_COUNT_SENTINEL, ...numberColumnIndices]
  const hasDateColumn = columns.some(
    (col) => col?.is_visible !== false && (col.type === 'DATE' || col.type === 'DATE_STRING'),
  )
  const measuresDisabledReason =
    measureOptionIndices.length < MIN_MEASURES ? `Needs at least ${MIN_MEASURES} number columns` : undefined

  const getDefaultMode = () => {
    const persisted = props.initialChartControls?.roseMode
    if (ROSE_MODES.includes(persisted) && !(persisted === 'measures' && measuresDisabledReason)) {
      return persisted
    }
    return hasDateColumn && numberColumnIndices.length >= MIN_DEFAULT_MEASURES ? 'measures' : 'values'
  }

  const getDefaultMeasureColumnIndices = () => {
    const persisted = (props.initialChartControls?.roseMeasureColumnIndices || []).filter((index) =>
      measureOptionIndices.includes(index),
    )
    return persisted.length >= MIN_MEASURES ? persisted : numberColumnIndices.slice(0, MAX_ROSE_CATEGORIES)
  }

  const [categoryColumnIndex, setCategoryColumnIndex] = useState(getDefaultCategoryColumnIndex)
  const [valueColumnIndices, setValueColumnIndices] = useState(getDefaultValueColumnIndices)
  const [mode, setMode] = useState(getDefaultMode)
  const [measureColumnIndices, setMeasureColumnIndices] = useState(getDefaultMeasureColumnIndices)
  const [scale, setScale] = useState(() =>
    ROSE_SCALES.includes(props.initialChartControls?.roseScale)
      ? props.initialChartControls.roseScale
      : DEFAULT_ROSE_SCALE,
  )
  const [showMeasureDropdown, setShowMeasureDropdown] = useState(false)
  // Auto-corrections stay local (not persisted) so dashboards don't loop
  const isMeasures = mode === 'measures' && !measuresDisabledReason
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showValueDropdown, setShowValueDropdown] = useState(false)
  const [activeKey, setActiveKey] = useState(null)

  // Keep selections valid if columns change underneath us (eg. a column is hidden).
  // Auto-corrections are local only, so they don't trigger dashboard update loops.
  useEffect(() => {
    if (!isValidCategoryColumnIndex(categoryColumnIndex)) {
      const next = getDefaultCategoryColumnIndex()
      if (next !== categoryColumnIndex) {
        setCategoryColumnIndex(next)
      }
    }
  }, [categoryColumnOptionIndices, categoryColumnIndex])

  useEffect(() => {
    setValueColumnIndices((prev) => {
      const validPrev = getValidValueColumnIndices(prev)
      const next = validPrev.length ? validPrev : getDefaultValueColumnIndices()
      return areNumberArraysEqual(prev, next) ? prev : next
    })
  }, [props.columns])

  const persistRoseControls = (updates) => {
    if (!props.onChartControlsChange) {
      return
    }
    props.onChartControlsChange({ ...(props.initialChartControls || {}), ...updates })
  }

  const handleCategoryColumnChange = ([nextCategoryColumnIndex] = []) => {
    if (nextCategoryColumnIndex === undefined || nextCategoryColumnIndex === categoryColumnIndex) {
      return
    }
    setCategoryColumnIndex(nextCategoryColumnIndex)
    persistRoseControls({ roseCategoryColumnIndex: nextCategoryColumnIndex })
  }

  const handleValueColumnsChange = (nextValueColumnIndices) => {
    if (!nextValueColumnIndices?.length || areNumberArraysEqual(nextValueColumnIndices, valueColumnIndices)) {
      return
    }
    setValueColumnIndices(nextValueColumnIndices)
    persistRoseControls({ roseValueColumnIndices: nextValueColumnIndices })
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    persistRoseControls({ roseMode: nextMode })
  }

  const handleScaleChange = (nextScale) => {
    setScale(nextScale)
    persistRoseControls({ roseScale: nextScale })
  }

  const handleMeasureColumnsChange = (nextMeasureColumnIndices) => {
    if (!nextMeasureColumnIndices?.length || areNumberArraysEqual(nextMeasureColumnIndices, measureColumnIndices)) {
      return
    }
    setMeasureColumnIndices(nextMeasureColumnIndices)
    persistRoseControls({ roseMeasureColumnIndices: nextMeasureColumnIndices })
  }

  const closeDropdowns = () => {
    setShowCategoryDropdown(false)
    setShowValueDropdown(false)
    setShowMeasureDropdown(false)
  }

  const formattingConfig = useMemo(
    () => getDataFormatting(props.dataFormatting || getAutoQLConfig(props.autoQLConfig)?.dataFormatting),
    [props.dataFormatting, props.autoQLConfig],
  )

  // A date category is already spread around the circle, so it can't also be what plays over time. In
  // measures mode one period is always shown.
  const animation = useTimeAnimation({
    data: props.data,
    columns,
    initialChartControls: props.initialChartControls,
    onChartControlsChange: props.onChartControlsChange,
    // Any column can be stepped through in measures mode; picking a measure takes it out of the measures
    excludedColumnIndices: isMeasures ? [] : categoryColumnIndex >= 0 ? [categoryColumnIndex] : [],
    dataFormatting: formattingConfig,
    includeAllColumns: isMeasures,
    showOneFrame: isMeasures,
  })

  // The column being stepped through can't also be a measure
  const stepColumnIndex = animation.settings.columnIndex
  const availableMeasureOptionIndices = measureOptionIndices.filter((index) => index !== stepColumnIndex)
  const validMeasureColumnIndices = measureColumnIndices.filter((index) =>
    availableMeasureOptionIndices.includes(index),
  )

  const totalWidth = props.width || 600
  const totalHeight = props.height || 400
  const buttonX = totalWidth - BUTTON_RIGHT_OFFSET
  // Keep the rose clear of the right-side controls
  const areaWidth = Math.max(0, buttonX - 10)
  const areaHeight = Math.max(0, totalHeight - MARGIN_TOP)
  const timelinePlacement = !animation.isActive ? null : areaWidth >= TIMELINE_BESIDE_MIN_WIDTH ? 'beside' : 'below'

  // The widest label the rose might draw (a measure name or a category value), so it keeps room for its
  // labels when the timeline beside it takes the rest of the width
  const longestLabelWidth = useMemo(() => {
    const names = isMeasures
      ? validMeasureColumnIndices.map((index) =>
          index === SANKEY_VALUE_COUNT_SENTINEL ? 'Count' : columns[index]?.display_name || columns[index]?.name || '',
        )
      : Array.from(new Set((props.data || []).map((row) => `${row?.[categoryColumnIndex] ?? ''}`)))
    const longest = names.reduce((max, name) => Math.max(max, name.length), 0)
    return Math.min(MAX_LABEL_WIDTH, longest * CHAR_WIDTH + LABEL_EDGE_PADDING)
  }, [isMeasures, validMeasureColumnIndices.join(','), props.data, categoryColumnIndex, props.columns])

  // Beside the rose, the timeline fills whatever width the rose (sized by the height) and its labels
  // don't need, and never gets narrower than its usual width
  const heightLimitedRadius = Math.max(0, areaHeight / 2 - FONT_SIZE - LABEL_OFFSET)
  const roseWidthAtFullHeight = 2 * (heightLimitedRadius + LABEL_OFFSET + longestLabelWidth)
  const usualTimelineWidth = Math.min(
    TIMELINE_MAX_WIDTH,
    Math.max(TIMELINE_MIN_WIDTH, areaWidth * TIMELINE_WIDTH_RATIO),
  )
  const timelineWidth =
    timelinePlacement === 'beside'
      ? Math.max(usualTimelineWidth, areaWidth - roseWidthAtFullHeight - TIMELINE_GAP)
      : areaWidth
  const plotWidth = timelinePlacement === 'beside' ? Math.max(0, areaWidth - timelineWidth - TIMELINE_GAP) : areaWidth
  // One sparkline per value layer, and a row of values for each in the timeline's header
  const timelineExtraHeight = getTimelineExtraHeight(
    isMeasures ? validMeasureColumnIndices.length : valueColumnIndices.length,
  )
  const timelineBelowHeight = TIMELINE_BELOW_HEIGHT + timelineExtraHeight
  const plotHeight =
    timelinePlacement === 'below' ? Math.max(0, areaHeight - timelineBelowHeight - TIMELINE_GAP) : areaHeight
  // Room kept beside the rose for labels: no more than its longest label needs
  const labelWidth = Math.min(LABEL_RESERVED_WIDTH, plotWidth * 0.2, longestLabelWidth)
  const outerRadius = Math.max(
    0,
    Math.min(plotWidth / 2 - labelWidth - LABEL_OFFSET, plotHeight / 2 - FONT_SIZE - LABEL_OFFSET),
  )
  const innerRadius = outerRadius * INNER_RADIUS_RATIO
  const centerX = plotWidth / 2
  const centerY = MARGIN_TOP + plotHeight / 2
  const maxCategories = getRoseMaxCategories(outerRadius)

  // A number category gets its wedges up front: its values smallest first, or ranges when there are too many
  const isNumberCategory = isColumnNumberType(columns[categoryColumnIndex])
  const numericCategories = useMemo(
    () => (isNumberCategory ? buildNumericCategories(props.data, categoryColumnIndex, maxCategories) : null),
    [isNumberCategory, props.data, categoryColumnIndex, maxCategories],
  )

  const allData = useMemo(
    () =>
      buildRoseData(
        props.data,
        categoryColumnIndex,
        valueColumnIndices,
        maxCategories,
        numericCategories?.categories,
        numericCategories?.getKey,
      ),
    [props.data, categoryColumnIndex, valueColumnIndices, maxCategories, numericCategories],
  )
  const { totalCategories, isTruncated } = allData

  // While playing over time, every period uses the categories of the full data, so wedges keep their
  // places, and one scale across all periods, so sizes can be compared from one period to the next
  const frameData = useMemo(
    () =>
      animation.isActive && !isMeasures
        ? animation.frames.map((frame) =>
            buildRoseData(
              frame.rows,
              categoryColumnIndex,
              valueColumnIndices,
              maxCategories,
              allData.categories,
              numericCategories?.getKey,
            ),
          )
        : null,
    [
      animation.isActive,
      isMeasures,
      animation.frames,
      allData,
      categoryColumnIndex,
      valueColumnIndices,
      maxCategories,
      numericCategories,
    ],
  )
  // Measures mode: one category per measure in each period, scaled against every period
  const measureData = useMemo(
    () => (isMeasures ? buildMeasureFrames(animation.frames, validMeasureColumnIndices, scale) : null),
    [isMeasures, animation.frames, validMeasureColumnIndices.join(','), scale],
  )

  const categories = measureData
    ? measureData.frames[animation.frameIndex]?.categories ?? []
    : frameData
    ? frameData[animation.frameIndex]?.categories ?? []
    : allData.categories

  const scaleMaxStack = useMemo(
    () =>
      measureData
        ? measureData.domainMax
        : frameData
        ? Math.max(0, ...frameData.map((frame) => getScaleMaxStack(frame.categories)))
        : getScaleMaxStack(categories),
    [measureData, frameData, categories],
  )

  // Radial scale keeps wedge area (not length) proportional to value, so large values don't look inflated
  const radiusScale = useMemo(
    () =>
      scaleRadial()
        .domain([0, scaleMaxStack || 1])
        .range([innerRadius, outerRadius]),
    [scaleMaxStack, innerRadius, outerRadius],
  )

  const angleStep = categories.length ? (2 * Math.PI) / categories.length : 0

  // One segment per category and value column, stacked outward. Negative values are drawn by magnitude.
  // While playing over time, empty segments are kept (with no thickness) so they can grow and shrink.
  const keepEmptySegments = animation.isActive
  const segments = useMemo(() => {
    const padAngle = categories.length > 1 ? Math.min(0.03, angleStep * 0.2) : 0
    return categories.flatMap((category, i) => {
      const stackSize = getStackSize(category)
      const shrink = stackSize > scaleMaxStack && scaleMaxStack > 0 ? scaleMaxStack / stackSize : 1
      let cumulative = 0
      return category.values
        .map((value, layer) => {
          const magnitude = Math.abs(value) * shrink
          if (!magnitude && !keepEmptySegments) {
            return null
          }
          const segment = {
            key: `${category.key}|${layer}`,
            category,
            layer,
            value,
            isNotToScale: shrink < 1,
            startAngle: i * angleStep,
            endAngle: (i + 1) * angleStep,
            padAngle,
            innerRadius: radiusScale(cumulative),
            outerRadius: radiusScale(cumulative + magnitude),
          }
          cumulative += magnitude
          return segment
        })
        .filter(Boolean)
    })
  }, [categories, radiusScale, angleStep, scaleMaxStack, keepEmptySegments])

  const arcGenerator = useMemo(() => d3Arc().padRadius(outerRadius).cornerRadius(1), [outerRadius])

  // Tween wedges from the shape they're drawn with when the data or picks change (not on resize), so
  // stepping through time animates without any extra work. Starting from the drawn shape, not the last
  // target, means a tween that's cut short carries on from where it got to instead of jumping.
  useLayoutEffect(() => {
    const previous = previousRenderRef.current
    previousRenderRef.current = { outerRadius }
    const drawn = drawnSegmentsRef.current
    const keys = new Set(segments.map((segment) => segment.key))
    Array.from(drawn.keys()).forEach((key) => !keys.has(key) && drawn.delete(key))

    if (!previous || previous.outerRadius !== outerRadius || prefersReducedMotion()) {
      segments.forEach((segment) => {
        const element = pathRefs.current.get(segment.key)
        if (element) {
          select(element).interrupt()
        }
        drawn.set(segment.key, segment)
      })
      return
    }

    // Playback moves at a constant speed for the whole frame; anything else eases in and out
    const ease = animation.isActive ? animation.ease : easeCubicInOut
    const duration = animation.isActive ? animation.tweenDuration : TWEEN_DURATION

    segments.forEach((segment) => {
      const element = pathRefs.current.get(segment.key)
      if (!element) {
        return
      }
      const from = drawn.get(segment.key) ?? { ...segment, outerRadius: segment.innerRadius }
      if (isSameGeometry(from, segment)) {
        drawn.set(segment.key, segment)
        return
      }
      select(element)
        .interrupt()
        .attr('d', arcGenerator(from))
        .transition()
        .duration(duration)
        .ease((t) => t)
        .attrTween('d', () => (t) => {
          const current = lerpSegment(from, segment, ease(t))
          drawn.set(segment.key, current)
          return arcGenerator(current)
        })
    })
  }, [segments])

  useEffect(() => {
    const paths = pathRefs.current
    return () => paths.forEach((element) => select(element).interrupt())
  }, [])

  const palette = useMemo(() => {
    const chartPalette = getChartColorVars()?.chartColors?.filter(Boolean) || []
    return chartPalette.length ? chartPalette : FALLBACK_COLORS
  }, [props.themeConfig])
  const layerColors = valueColumnIndices.map((_, layer) => palette[layer % palette.length])
  // Each measure has its own color, matching its line in the timeline
  const measureColors = validMeasureColumnIndices.map((_, i) => palette[i % palette.length])

  const enableDrilldowns = getAutoQLConfig(props.autoQLConfig).enableDrilldowns
  // Set inline (not via CSS var) so colors carry over to the exported PNG
  const themeTextColor = getThemeValue('text-color-primary')
  const themeSecondaryTextColor = getThemeValue('text-color-secondary') || themeTextColor
  const themeBorderColor = getThemeValue('border-color') || '#D8D8D8'
  const negativeColor = getThemeValue('danger-color') || FALLBACK_NEGATIVE_COLOR

  const categoryColumn = columns[categoryColumnIndex]
  const getColumnLabel = (column) => column?.display_name || column?.name || ''
  const getValueLabel = (columnIndex) =>
    columnIndex === SANKEY_VALUE_COUNT_SENTINEL ? 'Count' : getColumnLabel(columns[columnIndex]) || 'Value'

  const formatValue = (value, columnIndex) => {
    if (columnIndex === SANKEY_VALUE_COUNT_SENTINEL || !columns[columnIndex]) {
      return `${value?.toLocaleString?.() ?? value}`
    }
    return `${formatElement({ element: value, column: columns[columnIndex], config: formattingConfig })}`
  }

  // Linear and log rings are labelled in the measures' units when they all share one
  const formatMeasureTick = (value) => {
    const types = new Set(validMeasureColumnIndices.map((index) => columns[index]?.type ?? 'count'))
    return types.size === 1 ? formatValue(value, validMeasureColumnIndices[0]) : `${value.toLocaleString()}`
  }

  const formatCategoryValue = (value) =>
    `${formatElement({ element: value, column: categoryColumn, config: formattingConfig })}`

  const getCategoryName = (category) => {
    if (category.measureColumnIndex !== undefined) {
      return getValueLabel(category.measureColumnIndex)
    }
    if (category.isOther) {
      return 'Other'
    }
    if (category.range) {
      return `${formatCategoryValue(category.range[0])} – ${formatCategoryValue(category.range[1])}`
    }
    const displayValue = formatElement({ element: category.rawValue, column: categoryColumn, config: formattingConfig })
    return displayValue === null || displayValue === undefined || displayValue === '' ? '(Blank)' : `${displayValue}`
  }

  // A total only makes sense when every layer is in the same units
  const canShowTotal =
    valueColumnIndices.length > 1 &&
    new Set(valueColumnIndices.map((index) => (index === SANKEY_VALUE_COUNT_SENTINEL ? 'count' : columns[index]?.type)))
      .size === 1

  const getPeriodLabel = () =>
    animation.currentFrame
      ? animation.settings.cumulative
        ? `Through ${animation.currentFrame.label}`
        : animation.currentFrame.label
      : ''

  // What the wedge's length means for the current scale
  const getScaledDescription = (category) => {
    const scaled = category.values[0]
    const { stats, measureColumnIndex } = category
    switch (scale) {
      case 'normalized':
        return `${scaled >= 0 ? '+' : '−'}${Math.abs(scaled).toFixed(2)}σ from its average (${formatValue(
          stats.mean,
          measureColumnIndex,
        )})`
      case 'minmax':
        return `${Math.round(scaled * 100)}% of its range (${formatValue(
          stats.min,
          measureColumnIndex,
        )} – ${formatValue(stats.max, measureColumnIndex)})`
      default:
        return undefined
    }
  }

  const getMeasureTooltipHtml = (category) => {
    const lines = [`<strong>${escapeHtml(getCategoryName(category))}</strong>`]
    if (animation.currentFrame) {
      lines.push(`<strong>${escapeHtml(getColumnLabel(animation.column))}:</strong> ${escapeHtml(getPeriodLabel())}`)
    }
    if (category.measureValue === null) {
      lines.push('<em>No data in this period</em>')
      return lines.join('<br/>')
    }
    lines.push(`<strong>Value:</strong> ${escapeHtml(formatValue(category.measureValue, category.measureColumnIndex))}`)
    const description = getScaledDescription(category)
    if (description) {
      lines.push(escapeHtml(description))
    }
    return lines.join('<br/>')
  }

  const getTooltipHtml = (category, isNotToScale) => {
    if (category.measureColumnIndex !== undefined) {
      return getMeasureTooltipHtml(category)
    }
    const name = category.isOther ? `Other (${category.otherCount} categories)` : getCategoryName(category)
    const lines = [`<strong>${escapeHtml(getColumnLabel(categoryColumn))}:</strong> ${escapeHtml(name)}`]
    if (animation.currentFrame) {
      lines.push(`<strong>${escapeHtml(getColumnLabel(animation.column))}:</strong> ${escapeHtml(getPeriodLabel())}`)
    }
    valueColumnIndices.forEach((columnIndex, layer) => {
      lines.push(
        `<strong>${escapeHtml(getValueLabel(columnIndex))}:</strong> ${escapeHtml(
          formatValue(category.values[layer], columnIndex),
        )}`,
      )
    })
    if (canShowTotal) {
      lines.push(`<strong>Total:</strong> ${escapeHtml(formatValue(category.total, valueColumnIndices[0]))}`)
    }
    if (isNotToScale) {
      lines.push('<em>Not drawn to scale</em>')
    }
    return lines.join('<br/>')
  }

  // A measure isn't a value to filter on, so a measure wedge drills into the period being shown
  const onMeasureWedgeClick = (category) => {
    const frameDrilldown = animation.getDrilldown()
    if (!frameDrilldown) {
      return
    }
    const key = `rose-${category.key}`
    setActiveKey(key)
    if (frameDrilldown.groupBy) {
      props.onChartClick({ groupBys: [frameDrilldown.groupBy], activeKey: key })
    } else {
      props.onChartClick({ filters: [frameDrilldown.filter], activeKey: key })
    }
  }

  const onWedgeClick = (event, category) => {
    event.stopPropagation()
    closeDropdowns()

    if (category.measureColumnIndex !== undefined) {
      if (enableDrilldowns && props.onChartClick) {
        onMeasureWedgeClick(category)
      }
      return
    }

    if (!enableDrilldowns || !props.onChartClick || category.isOther || !categoryColumn?.name) {
      return
    }

    // While showing one period, the drilldown is limited to that period too. Some periods (eg. a
    // running total over date strings) can't be expressed as a filter, so those can't be drilled into.
    const frameDrilldown = animation.currentFrame ? animation.getDrilldown() : undefined
    if (animation.currentFrame && !frameDrilldown) {
      return
    }

    const key = `rose-${category.key}`

    // A range of a number column drills down with a between filter, like a histogram bar. It can only be
    // combined with a period that is a filter too.
    if (category.range) {
      if (frameDrilldown && !frameDrilldown.filter) {
        return
      }
      setActiveKey(key)
      props.onChartClick({
        filters: [
          {
            name: categoryColumn.name,
            operator: 'between',
            value: `${category.range[0]},${category.range[1]}`,
            column_type: categoryColumn.type,
          },
          ...(frameDrilldown?.filter ? [frameDrilldown.filter] : []),
        ],
        activeKey: key,
      })
      return
    }

    setActiveKey(key)

    // Same shape as treemap drilldowns: a group-by when the category column is one, otherwise
    // (eg. list queries) a filter on the category value that QueryOutput builds from the row
    const { rawValue } = category
    if (categoryColumn.groupable && (!frameDrilldown || frameDrilldown.groupBy)) {
      props.onChartClick({
        groupBys: [
          {
            name: categoryColumn.name,
            drill_down: categoryColumn.drill_down,
            value: `${rawValue}`,
            operator: rawValue === null || rawValue === undefined ? 'is' : '=',
          },
          ...(frameDrilldown?.groupBy ? [frameDrilldown.groupBy] : []),
        ],
        activeKey: key,
      })
      return
    }

    const row = new Array(columns.length).fill(undefined)
    row[categoryColumnIndex] = rawValue ?? null
    props.onChartClick({
      stringColumnIndices: [categoryColumnIndex],
      rows: [row],
      extraFilters: frameDrilldown?.filter ? [frameDrilldown.filter] : undefined,
      activeKey: key,
    })
  }

  const renderGradients = () => {
    // Same 3-stop opacity gradient as bars/columns, running outward from the centre
    const renderGradient = (id, color) => (
      <radialGradient key={id} id={id} gradientUnits='userSpaceOnUse' cx={0} cy={0} r={outerRadius || 1}>
        <stop offset='0%' stopColor={color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[0]} />
        <stop offset='50%' stopColor={color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[1]} />
        <stop offset='100%' stopColor={color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[2]} />
      </radialGradient>
    )
    return (
      <defs>
        {layerColors.map((color, layer) => renderGradient(`${gradientIdPrefix}-${layer}`, color))}
        {measureColors.map((color, i) => renderGradient(`${gradientIdPrefix}-measure-${i}`, color))}
        {renderGradient(`${gradientIdPrefix}-negative`, negativeColor)}
      </defs>
    )
  }

  const renderGrid = () => {
    const tickFormatColumnIndex = valueColumnIndices[0]
    const tickLabels = measureData
      ? getMeasureScaleTicks(scale, scaleMaxStack, formatMeasureTick)
      : radiusScale.ticks(4).map((tick) => ({ magnitude: tick, label: formatValue(tick, tickFormatColumnIndex) }))
    const visibleTicks = tickLabels.filter(
      ({ magnitude }) => magnitude > 0 && radiusScale(magnitude) < outerRadius - TICK_FONT_SIZE,
    )
    const ticks = visibleTicks.map(({ magnitude }) => magnitude)

    return (
      <g className='rose-grid' style={{ pointerEvents: 'none' }}>
        {[...ticks.map((tick) => radiusScale(tick)), outerRadius].map((radius, i) => (
          <circle
            key={`ring-${i}`}
            r={radius}
            fill='none'
            stroke={themeBorderColor}
            strokeOpacity={i === ticks.length ? 0.8 : 0.5}
          />
        ))}
        {categories.length > 1 &&
          categories.map((category, i) => {
            const angle = i * angleStep
            return (
              <line
                key={`spoke-${category.key}`}
                x1={innerRadius * Math.sin(angle)}
                y1={-innerRadius * Math.cos(angle)}
                x2={outerRadius * Math.sin(angle)}
                y2={-outerRadius * Math.cos(angle)}
                stroke={themeBorderColor}
                strokeOpacity={0.5}
              />
            )
          })}
        {visibleTicks.map(({ magnitude, label }) => (
          <text
            key={`tick-${magnitude}`}
            className='rose-tick-label'
            x={2}
            y={-radiusScale(magnitude) - 2}
            fontSize={TICK_FONT_SIZE}
            fill={themeSecondaryTextColor}
          >
            {label}
          </text>
        ))}
      </g>
    )
  }

  const allDataCategoryByKey = useMemo(
    () => new Map(allData.categories.map((category) => [category.key, category])),
    [allData],
  )

  const renderLabels = () => {
    const labelRadius = outerRadius + LABEL_OFFSET
    const candidates = categories
      .map((category, i) => {
        const angle = (i + 0.5) * angleStep
        const sin = Math.sin(angle)
        const cos = Math.cos(angle)
        const x = labelRadius * sin
        const textAnchor = sin > 0.1 ? 'start' : sin < -0.1 ? 'end' : 'middle'
        // Truncate to the room between the label and the edge of the chart, not a fixed width, so labels
        // use the empty space beside a height-limited rose
        const roomToEdge = centerX - Math.abs(x) - LABEL_EDGE_PADDING
        const availableWidth = Math.min(MAX_LABEL_WIDTH, textAnchor === 'middle' ? 2 * roomToEdge : roomToEdge)
        const text = truncateToWidth(getCategoryName(category), availableWidth)
        if (!text) {
          return null
        }
        // Below the centre, hang the text under its anchor point; at the sides, centre it vertically
        const dy = cos < -0.1 ? FONT_SIZE * 0.8 : cos > 0.1 ? 0 : FONT_SIZE * 0.35
        return {
          key: category.key,
          text,
          x,
          y: -labelRadius * cos + dy,
          width: text.length * CHAR_WIDTH,
          textAnchor,
          // Biggest wedges get their labels first; "Other" last. While playing over time, sizes over all
          // of the data are used, so the same labels stay put from one period to the next.
          // Measures keep their order, so the same labels stay put from one period to the next.
          priority:
            category.measureIndex !== undefined
              ? -category.measureIndex
              : category.isOther
              ? -1
              : getStackSize(allDataCategoryByKey.get(category.key) ?? category),
        }
      })
      .filter(Boolean)

    return (
      <g className='rose-labels' style={{ pointerEvents: 'none' }}>
        {placeRoseLabels(candidates).map((label) => (
          <text
            key={`label-${label.key}`}
            className='rose-label'
            x={label.x}
            y={label.y}
            textAnchor={label.textAnchor}
            fontSize={FONT_SIZE}
            fill={themeTextColor}
          >
            {label.text}
          </text>
        ))}
      </g>
    )
  }

  const renderWedges = () =>
    segments.map((segment) => {
      const isActive = activeKey === `rose-${segment.category.key}`
      const fill =
        segment.value < 0
          ? `url(#${gradientIdPrefix}-negative)`
          : segment.category.measureIndex !== undefined
          ? `url(#${gradientIdPrefix}-measure-${segment.category.measureIndex})`
          : `url(#${gradientIdPrefix}-${segment.layer})`
      return (
        <path
          key={segment.key}
          ref={(element) => {
            if (element) {
              pathRefs.current.set(segment.key, element)
            } else {
              pathRefs.current.delete(segment.key)
            }
          }}
          className={`rose-wedge${isActive ? ' active' : ''}${segment.category.isOther ? ' rose-wedge-other' : ''}`}
          d={arcGenerator(segment)}
          fill={fill}
          stroke={segment.isNotToScale ? themeSecondaryTextColor : undefined}
          strokeDasharray={segment.isNotToScale ? '3,2' : undefined}
          data-tooltip-id={props.chartTooltipID}
          data-tooltip-html={getTooltipHtml(segment.category, segment.isNotToScale)}
          onClick={(e) => onWedgeClick(e, segment.category)}
        />
      )
    })

  // One sparkline per value layer: the layer summed over all categories in each period. In measures mode,
  // one per measure, in its own units and color.
  const timelineSeries = useMemo(
    () =>
      measureData
        ? validMeasureColumnIndices.map((columnIndex, measureIndex) => ({
            key: `measure:${columnIndex}`,
            label: getValueLabel(columnIndex),
            values: measureData.frames.map((frame) => frame.categories[measureIndex]?.measureValue ?? NaN),
            color: measureColors[measureIndex],
            formatValue: (value) => formatValue(value, columnIndex),
          }))
        : valueColumnIndices.map((columnIndex, layer) => ({
            key: `${columnIndex}`,
            label: getValueLabel(columnIndex),
            values: (frameData || []).map((frame) =>
              frame.categories.reduce((sum, category) => sum + (category.values[layer] || 0), 0),
            ),
            color: layerColors[layer],
            formatValue: (value) => formatValue(value, columnIndex),
          })),
    [frameData, measureData, valueColumnIndices, palette, columns, formattingConfig],
  )

  const renderTimeline = () => {
    if (!timelinePlacement) {
      return null
    }
    const isBeside = timelinePlacement === 'beside'
    const height = isBeside ? Math.min(TIMELINE_MAX_HEIGHT + timelineExtraHeight, areaHeight) : timelineBelowHeight
    return (
      <TimeAnimationTimeline
        x={isBeside ? plotWidth + TIMELINE_GAP : 0}
        y={isBeside ? MARGIN_TOP + (areaHeight - height) / 2 : totalHeight - timelineBelowHeight}
        width={timelineWidth}
        height={height}
        frames={animation.frames}
        series={timelineSeries}
        frameIndex={animation.frameIndex}
        cumulative={animation.settings.cumulative}
        textColor={themeTextColor}
        secondaryTextColor={themeSecondaryTextColor}
        borderColor={themeBorderColor}
        tweenDuration={prefersReducedMotion() ? 0 : animation.tweenDuration}
        ease={animation.ease}
        onSeek={animation.goToFrame}
        onClose={isMeasures ? undefined : animation.exit}
      />
    )
  }

  const getEmptyMessage = () => {
    if (isMeasures) {
      if (stepColumnIndex === undefined) {
        return 'Pick a column to step through in the time settings'
      }
      if (validMeasureColumnIndices.length < MIN_MEASURES) {
        return `Pick at least ${MIN_MEASURES} measures`
      }
      if (!animation.frames.length) {
        return `No ${getColumnLabel(animation.column)} values to step through`
      }
      return 'No values to display'
    }
    if (!categoryColumnOptionIndices.length) {
      return 'No columns to group by'
    }
    if (!valueColumnIndices.length) {
      return 'No number column to size wedges by'
    }
    // One wedge would be a full circle, which says nothing
    if (categories.length === 1) {
      return `Only one ${getColumnLabel(categoryColumn)} value (${getCategoryName(
        categories[0],
      )}). Pick a different category.`
    }
    return 'No values to display'
  }

  const renderWarning = () => {
    if (!isTruncated || isMeasures) {
      return null
    }
    const message = `Only the ${
      maxCategories - 1
    } largest categories (out of ${totalCategories}) are shown. The rest are combined into "Other".`
    return <DataLimitWarning tooltipID={props.tooltipID} isTruncated customMessage={message} />
  }

  return (
    <g
      ref={forwardedRef}
      className={`react-autoql-rose ${enableDrilldowns ? 'enable-drilldown' : ''}`}
      data-test='react-autoql-rose'
      onClick={closeDropdowns}
    >
      {renderWarning()}

      {outerRadius <= 0 ? null : categories.length > 1 && (segments.length || animation.isActive) ? (
        <g className='rose-plot' transform={`translate(${centerX}, ${centerY})`}>
          {renderGradients()}
          {renderGrid()}
          <g className='rose-wedges'>{renderWedges()}</g>
          {renderLabels()}
        </g>
      ) : (
        <text
          className='rose-empty-message'
          x={plotWidth / 2}
          y={MARGIN_TOP + plotHeight / 2}
          textAnchor='middle'
          fill={themeTextColor}
        >
          {getEmptyMessage()}
        </text>
      )}

      {renderTimeline()}

      <RoseSettingsControl
        mode={isMeasures ? 'measures' : 'values'}
        scale={scale}
        onModeChange={handleModeChange}
        onScaleChange={handleScaleChange}
        measuresDisabledReason={measuresDisabledReason}
        x={buttonX}
        y={BUTTON_TOP}
        size={BUTTON_SIZE}
        chartTooltipID={props.chartTooltipID}
      />

      {/* Column selectors share the Sankey selector UI */}
      {isMeasures ? (
        <SankeyColumnSelector
          columns={columns}
          type='path'
          pathColumnIndices={validMeasureColumnIndices}
          pathColumnOptionIndices={availableMeasureOptionIndices}
          onPathChange={handleMeasureColumnsChange}
          minPathColumns={MIN_MEASURES}
          maxPathColumns={MAX_ROSE_CATEGORIES}
          pathTitle='Measures'
          pathSubtitle='One wedge each'
          pathLabel='Measures'
          pathIconType='layers'
          showDropdown={showMeasureDropdown}
          setShowDropdown={setShowMeasureDropdown}
          buttonX={buttonX}
          buttonY={BUTTON_TOP + BUTTON_STEP}
          buttonSize={BUTTON_SIZE}
          chartTooltipID={props.chartTooltipID}
        />
      ) : (
        <>
          <SankeyColumnSelector
            columns={columns}
            type='path'
            pathColumnIndices={categoryColumnIndex >= 0 ? [categoryColumnIndex] : []}
            pathColumnOptionIndices={categoryColumnOptionIndices}
            onPathChange={handleCategoryColumnChange}
            minPathColumns={1}
            maxPathColumns={1}
            pathTitle='Category'
            pathSubtitle='One wedge per value'
            pathLabel='Category'
            pathIconType='rose'
            disabledPathColumnIndices={singleValueColumnIndices}
            disabledPathColumnTooltip='Only one value in this column'
            showDropdown={showCategoryDropdown}
            setShowDropdown={setShowCategoryDropdown}
            buttonX={buttonX}
            buttonY={BUTTON_TOP + BUTTON_STEP}
            buttonSize={BUTTON_SIZE}
            chartTooltipID={props.chartTooltipID}
          />
          <SankeyColumnSelector
            columns={columns}
            type='path'
            pathColumnIndices={valueColumnIndices}
            pathColumnOptionIndices={valueColumnOptionIndices}
            onPathChange={handleValueColumnsChange}
            minPathColumns={1}
            maxPathColumns={MAX_LAYERS}
            pathTitle='Values'
            pathSubtitle='Stacked from the centre outward'
            pathLabel='Values'
            pathIconType='layers'
            disabled={isAggregatedData && numberColumnIndices.length <= 1}
            disabledTooltip='Values are already aggregated by the query'
            showDropdown={showValueDropdown}
            setShowDropdown={setShowValueDropdown}
            buttonX={buttonX}
            buttonY={BUTTON_TOP + 2 * BUTTON_STEP}
            buttonSize={BUTTON_SIZE}
            chartTooltipID={props.chartTooltipID}
          />
        </>
      )}
      <TimeAnimationControl
        animation={animation}
        columns={columns}
        x={buttonX}
        y={BUTTON_TOP + (isMeasures ? 2 : 3) * BUTTON_STEP}
        size={BUTTON_SIZE}
        chartTooltipID={props.chartTooltipID}
      />
    </g>
  )
})

ChataRoseChart.displayName = 'ChataRoseChart'

ChataRoseChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.array),
  columns: PropTypes.arrayOf(PropTypes.shape({})),
  width: PropTypes.number,
  height: PropTypes.number,
  onChartClick: PropTypes.func,
  themeConfig: PropTypes.shape({}),
  dataFormatting: PropTypes.shape({}),
  autoQLConfig: PropTypes.shape({}),
  initialChartControls: PropTypes.shape({
    roseCategoryColumnIndex: PropTypes.number,
    roseValueColumnIndices: PropTypes.arrayOf(PropTypes.number),
    roseMode: PropTypes.oneOf(ROSE_MODES),
    roseMeasureColumnIndices: PropTypes.arrayOf(PropTypes.number),
    roseScale: PropTypes.oneOf(ROSE_SCALES),
    timeAnimation: PropTypes.shape({}),
  }),
  onChartControlsChange: PropTypes.func,
  tooltipID: PropTypes.string,
  chartTooltipID: PropTypes.string,
}

ChataRoseChart.defaultProps = {
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

export default ChataRoseChart
