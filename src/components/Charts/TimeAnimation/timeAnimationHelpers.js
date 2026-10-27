import {
  ColumnTypes,
  PrecisionTypes,
  getDayJSObj,
  getStartOfWeek,
  getEndOfWeek,
  getWeekStartDay,
  formatElement,
} from 'autoql-fe-utils'

// Chart-agnostic: turns a date column into an ordered list of frames (one per period), each holding
// the rows in that period. A chart renders a frame exactly as it renders its full data.

export const TIME_ANIMATION_SPEEDS = [0.5, 1, 2]
// How long each period is shown at 1×
export const TIME_ANIMATION_BASE_INTERVAL = 700
// Upper limit on frames, so a fine grouping over a long range can't build thousands of frames
export const MAX_TIME_ANIMATION_FRAMES = 400
// The default grouping is the finest one that gives at most this many frames
const PREFERRED_MAX_FRAMES = 36

// Coarsest last. Enums are read inside functions (see CLAUDE.md), so these are plain strings.
const GROUPINGS = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']
const GROUPING_LABELS = { DAY: 'Day', WEEK: 'Week', MONTH: 'Month', QUARTER: 'Quarter', YEAR: 'Year' }
// Precisions finer than a day can be grouped into any of the groupings
const SUB_DAY_PRECISIONS = ['DATE_HOUR', 'DATE_MINUTE', 'DATE_SECOND', 'DATE_MILLISECOND']

// Easings for tweens between frames (d3-ease isn't a direct dependency)
export const easeLinear = (t) => t
export const easeCubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export const getGroupingLabel = (grouping) => GROUPING_LABELS[grouping] ?? grouping

const isDateColumn = (column) => column?.type === ColumnTypes.DATE
const isDateStringColumn = (column) => column?.type === ColumnTypes.DATE_STRING

// Date columns, or with includeAllColumns any visible column (dates first), since things like a "Round"
// column can be stepped through too
export const getTimeAnimationColumnOptions = (columns = [], excludedColumnIndices = [], includeAllColumns = false) => {
  const visible = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column && column.is_visible !== false && !excludedColumnIndices.includes(index))
  const isDate = ({ column }) => isDateColumn(column) || isDateStringColumn(column)
  const dates = visible.filter(isDate)
  const others = includeAllColumns ? visible.filter((option) => !isDate(option)) : []
  return [...dates, ...others].map(({ index }) => index)
}

// Groupings a column can be bucketed into. Grouped (aggregated) data is locked to the query's own
// precision: re-bucketing it would add up values like averages that can't be added.
export const getGroupingOptions = (column, isAggregated) => {
  if (!isDateColumn(column)) {
    return []
  }
  const precision = column.precision
  if (isAggregated) {
    return GROUPINGS.includes(precision) ? [precision] : []
  }
  if (!precision || precision === PrecisionTypes.DAY || SUB_DAY_PRECISIONS.includes(precision)) {
    return GROUPINGS
  }
  const precisionRank = GROUPINGS.indexOf(precision)
  return precisionRank >= 0 ? GROUPINGS.slice(precisionRank) : GROUPINGS
}

const getRowDate = (row, columnIndex, column) => {
  const value = row?.[columnIndex]
  if (value === null || value === undefined || value === '') {
    return null
  }
  const date = getDayJSObj({ value, column })
  return date?.isValid?.() ? date : null
}

const getBucketStart = (date, grouping, column) => {
  if (grouping === 'WEEK') {
    return getStartOfWeek(date, getWeekStartDay(column)).startOf('day')
  }
  return date.startOf(grouping.toLowerCase())
}

const getBucketEnd = (start, grouping, column) => {
  if (grouping === 'WEEK') {
    return getEndOfWeek(start, getWeekStartDay(column)).endOf('day')
  }
  return start.endOf(grouping.toLowerCase())
}

const getNextBucketStart = (start, grouping) => {
  if (grouping === 'WEEK') {
    return start.add(1, 'week')
  }
  return start.add(1, grouping.toLowerCase())
}

const countBuckets = (minDate, maxDate, grouping, column) => {
  let count = 0
  let start = getBucketStart(minDate, grouping, column)
  while (!start.isAfter(maxDate) && count <= MAX_TIME_ANIMATION_FRAMES) {
    count += 1
    start = getNextBucketStart(start, grouping)
  }
  return count
}

const getDateRange = (data, columnIndex, column) => {
  let minDate
  let maxDate
  data.forEach((row) => {
    const date = getRowDate(row, columnIndex, column)
    if (!date) {
      return
    }
    if (!minDate || date.isBefore(minDate)) {
      minDate = date
    }
    if (!maxDate || date.isAfter(maxDate)) {
      maxDate = date
    }
  })
  return { minDate, maxDate }
}

// Groupings that stay under the frame limit for this data
export const getAvailableGroupings = (data = [], columnIndex, column, isAggregated) => {
  const options = getGroupingOptions(column, isAggregated)
  const { minDate, maxDate } = getDateRange(data, columnIndex, column)
  if (!minDate) {
    return []
  }
  return options.filter((grouping) => countBuckets(minDate, maxDate, grouping, column) <= MAX_TIME_ANIMATION_FRAMES)
}

export const getDefaultGrouping = (data = [], columnIndex, column, isAggregated) => {
  const available = getAvailableGroupings(data, columnIndex, column, isAggregated)
  if (!available.length) {
    return undefined
  }
  const { minDate, maxDate } = getDateRange(data, columnIndex, column)
  return (
    available.find((grouping) => countBuckets(minDate, maxDate, grouping, column) <= PREFERRED_MAX_FRAMES) ??
    available[available.length - 1]
  )
}

const formatPeriod = (isoStart, column, grouping, dataFormatting) =>
  `${formatElement({ element: isoStart, column: { ...column, precision: grouping }, config: dataFormatting })}`

// One frame per period from the first date to the last, including empty periods so time moves at
// an even pace. Rows with no date belong to no period and are left out.
const buildDateFrames = ({ data, columnIndex, column, grouping, dataFormatting }) => {
  const { minDate, maxDate } = getDateRange(data, columnIndex, column)
  if (!minDate || !GROUPINGS.includes(grouping)) {
    return []
  }

  const frames = []
  const frameByKey = new Map()
  let start = getBucketStart(minDate, grouping, column)
  while (!start.isAfter(maxDate) && frames.length < MAX_TIME_ANIMATION_FRAMES) {
    const isoStart = start.toISOString()
    const frame = {
      key: isoStart,
      label: formatPeriod(isoStart, column, grouping, dataFormatting),
      start: isoStart,
      end: getBucketEnd(start, grouping, column).toISOString(),
      rawValue: undefined,
      rows: [],
    }
    frames.push(frame)
    frameByKey.set(isoStart, frame)
    start = getNextBucketStart(start, grouping)
  }

  data.forEach((row) => {
    const date = getRowDate(row, columnIndex, column)
    if (!date) {
      return
    }
    const frame = frameByKey.get(getBucketStart(date, grouping, column).toISOString())
    if (frame) {
      frame.rows.push(row)
      if (frame.rawValue === undefined) {
        frame.rawValue = row[columnIndex]
      }
    }
  })

  return frames
}

// Date strings (eg. "March", "Monday") can't be bucketed, so each distinct value is a frame,
// in date order when the values parse and first-appearance order when they don't. Any other column
// works the same way: numbers (eg. a "Round" column) smallest first, anything else in first-appearance order.
const buildValueFrames = ({ data, columnIndex, column, dataFormatting }) => {
  const frameByKey = new Map()
  data.forEach((row) => {
    const value = row?.[columnIndex]
    if (value === null || value === undefined || value === '') {
      return
    }
    const key = `${value}`
    let frame = frameByKey.get(key)
    if (!frame) {
      frame = {
        key,
        label: `${formatElement({ element: value, column, config: dataFormatting }) ?? value}`,
        rawValue: value,
        rows: [],
        order: frameByKey.size,
        date: isDateColumn(column) || isDateStringColumn(column) ? getRowDate(row, columnIndex, column) : null,
      }
      frameByKey.set(key, frame)
    }
    frame.rows.push(row)
  })

  const frames = Array.from(frameByKey.values())
  if (frames.every((frame) => frame.date)) {
    frames.sort((a, b) => a.date.valueOf() - b.date.valueOf() || a.order - b.order)
  } else if (frames.every((frame) => Number.isFinite(Number(frame.rawValue)))) {
    frames.sort((a, b) => Number(a.rawValue) - Number(b.rawValue) || a.order - b.order)
  }
  return frames.map((frame) => ({ key: frame.key, label: frame.label, rawValue: frame.rawValue, rows: frame.rows }))
}

// Running totals: each frame holds every row up to and including its period
const accumulateFrames = (frames) => {
  let rows = []
  return frames.map((frame) => {
    rows = rows.concat(frame.rows)
    return { ...frame, rows }
  })
}

export const buildTimeFrames = ({ data = [], columns = [], columnIndex, grouping, cumulative, dataFormatting }) => {
  const column = columns[columnIndex]
  if (!data?.length || !column) {
    return []
  }

  // A date column with no grouping (eg. grouped data at an hourly precision, or no precision) steps
  // through its own date values instead
  const dateFrames = isDateColumn(column)
    ? buildDateFrames({ data, columnIndex, column, grouping, dataFormatting })
    : []
  const frames = dateFrames.length ? dateFrames : buildValueFrames({ data, columnIndex, column, dataFormatting })

  return cumulative ? accumulateFrames(frames) : frames
}

const getFrameFilter = ({ frames, frame, column, cumulative }) => {
  if (isDateColumn(column) && frame.start) {
    const start = cumulative ? frames[0].start : frame.start
    return { name: column.name, operator: 'between', value: `${start},${frame.end}`, column_type: ColumnTypes.DATE }
  }
  // A running total over values is a set of values, which a single filter can't express
  if (!isDateColumn(column) && !cumulative) {
    return { name: column.name, operator: '=', value: `${frame.rawValue}` }
  }
  return null
}

// What a drilldown in this frame has to add so it only returns the frame's period. Returns a groupBy
// when the period is exactly one of the query's own date values (grouped data, not running totals),
// a filter when it's a range the backend can filter on, or null when the frame can't be drilled into.
export const getFrameDrilldown = ({ frames, frameIndex, column, cumulative, isAggregated }) => {
  const frame = frames?.[frameIndex]
  if (!frame || !column?.name) {
    return null
  }

  if (isAggregated && !cumulative && column.groupable && frame.rawValue !== undefined) {
    return {
      groupBy: { name: column.name, drill_down: column.drill_down, value: `${frame.rawValue}` },
      filter: getFrameFilter({ frames, frame, column, cumulative }),
    }
  }

  const filter = getFrameFilter({ frames, frame, column, cumulative })
  return filter ? { groupBy: null, filter } : null
}
