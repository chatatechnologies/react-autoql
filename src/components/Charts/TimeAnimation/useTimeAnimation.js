import { useEffect, useMemo, useState } from 'react'
import { isAggregation } from 'autoql-fe-utils'

import {
  TIME_ANIMATION_BASE_INTERVAL,
  TIME_ANIMATION_SPEEDS,
  buildTimeFrames,
  getAvailableGroupings,
  getDefaultGrouping,
  getFrameDrilldown,
  getTimeAnimationColumnOptions,
  easeLinear,
  easeCubicInOut,
} from './timeAnimationHelpers'

// A jump to a picked frame (not playback) takes this long
const SEEK_TWEEN_DURATION = 300

// Shared playback state for stepping a chart through time. The chart passes in its data and renders
// `currentFrame.rows` in place of its data while `isActive`. Settings persist under one
// `timeAnimation` key in chart controls so every chart type saves them the same way; the play state
// does not persist, so a saved chart always opens showing all of its data.
// - includeAllColumns: any column can be stepped through, not just dates. A date column is still the
//   default; with none, nothing is picked until the user picks a column.
// - showOneFrame: for charts that only ever show one period. Always active, opens on the latest period,
//   and exit() just pauses.
export const useTimeAnimation = ({
  data,
  columns,
  initialChartControls,
  onChartControlsChange,
  excludedColumnIndices = [],
  dataFormatting,
  includeAllColumns = false,
  showOneFrame = false,
}) => {
  const saved = initialChartControls?.timeAnimation || {}
  const isAggregated = useMemo(() => isAggregation(columns), [columns])

  const columnOptionIndices = useMemo(
    () => getTimeAnimationColumnOptions(columns, excludedColumnIndices, includeAllColumns),
    [columns, excludedColumnIndices.join(','), includeAllColumns],
  )
  // Only a date column is ever picked automatically
  const defaultColumnIndex = useMemo(
    () => getTimeAnimationColumnOptions(columns, excludedColumnIndices)[0],
    [columns, excludedColumnIndices.join(',')],
  )

  const [columnIndex, setColumnIndex] = useState(() =>
    columnOptionIndices.includes(saved.columnIndex) ? saved.columnIndex : defaultColumnIndex,
  )
  const [savedGrouping, setGrouping] = useState(saved.grouping)
  const [speed, setSpeed] = useState(TIME_ANIMATION_SPEEDS.includes(saved.speed) ? saved.speed : 1)
  // Loops unless it's been turned off
  const [loop, setLoop] = useState(saved.loop ?? true)
  const [cumulative, setCumulative] = useState(!!saved.cumulative)

  const [activeState, setIsActive] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  // null means the last frame
  const [frameIndex, setFrameIndex] = useState(showOneFrame ? null : 0)
  const firstFrameIndex = showOneFrame ? null : 0

  // Auto-corrections stay local (not persisted) so dashboards don't loop
  const validColumnIndex = columnOptionIndices.includes(columnIndex) ? columnIndex : defaultColumnIndex
  const column = columns?.[validColumnIndex]

  const groupingOptions = useMemo(
    () => (column ? getAvailableGroupings(data, validColumnIndex, column, isAggregated) : []),
    [data, column, validColumnIndex, isAggregated],
  )
  const grouping = groupingOptions.includes(savedGrouping)
    ? savedGrouping
    : getDefaultGrouping(data, validColumnIndex, column, isAggregated)

  const frames = useMemo(
    () =>
      validColumnIndex === undefined
        ? []
        : buildTimeFrames({ data, columns, columnIndex: validColumnIndex, grouping, cumulative, dataFormatting }),
    [data, columns, validColumnIndex, grouping, cumulative, dataFormatting],
  )

  const isAvailable = frames.length > 1
  const isActive = showOneFrame ? frames.length > 0 : activeState
  const lastFrameIndex = Math.max(0, frames.length - 1)
  const currentFrameIndex = Math.min(frameIndex ?? lastFrameIndex, lastFrameIndex)
  const frameInterval = TIME_ANIMATION_BASE_INTERVAL / speed
  // While playing, each tween lasts the whole frame at a constant speed, so one period flows into the
  // next with no pause or slow-down between them. A jump to a picked frame eases in and out quickly.
  const tweenDuration = isPlaying ? frameInterval : SEEK_TWEEN_DURATION
  const ease = isPlaying ? easeLinear : easeCubicInOut

  useEffect(() => {
    if (!isAvailable && (activeState || isPlaying)) {
      setIsActive(false)
      setIsPlaying(false)
    }
  }, [isAvailable, activeState, isPlaying])

  useEffect(() => {
    if (!isPlaying || !isActive) {
      return
    }
    const timeout = setTimeout(() => {
      if (currentFrameIndex < lastFrameIndex) {
        setFrameIndex(currentFrameIndex + 1)
      } else if (loop) {
        setFrameIndex(0)
      } else {
        setIsPlaying(false)
      }
    }, frameInterval)
    return () => clearTimeout(timeout)
  }, [isPlaying, isActive, currentFrameIndex, lastFrameIndex, loop, frameInterval])

  const persist = (updates) => {
    onChartControlsChange?.({
      ...(initialChartControls || {}),
      timeAnimation: {
        columnIndex: validColumnIndex,
        grouping,
        speed,
        loop,
        cumulative,
        ...updates,
      },
    })
  }

  const play = () => {
    if (!isAvailable) {
      return
    }
    // Starting fresh, or from the end of a finished run, goes back to the first period
    if (!isActive || currentFrameIndex >= lastFrameIndex) {
      setFrameIndex(0)
    }
    setIsActive(true)
    setIsPlaying(true)
  }

  const pause = () => setIsPlaying(false)

  const togglePlay = () => (isPlaying ? pause() : play())

  // Jumping to a frame (eg. from the timeline) pauses, so it stays on the frame that was picked
  const goToFrame = (index) => {
    if (!isAvailable) {
      return
    }
    setIsActive(true)
    setIsPlaying(false)
    setFrameIndex(Math.max(0, Math.min(lastFrameIndex, index)))
  }

  const exit = () => {
    setIsActive(false)
    setIsPlaying(false)
    setFrameIndex(firstFrameIndex)
  }

  // Changing what a frame is restarts from the first one
  const updateSettings = (updates) => {
    if ('columnIndex' in updates) {
      setColumnIndex(updates.columnIndex)
    }
    if ('grouping' in updates) {
      setGrouping(updates.grouping)
    }
    if ('speed' in updates) {
      setSpeed(updates.speed)
    }
    if ('loop' in updates) {
      setLoop(updates.loop)
    }
    if ('cumulative' in updates) {
      setCumulative(updates.cumulative)
    }
    if ('columnIndex' in updates || 'grouping' in updates || 'cumulative' in updates) {
      setFrameIndex(firstFrameIndex)
    }
    persist(updates)
  }

  const currentFrame = isActive ? frames[currentFrameIndex] : undefined

  return {
    isAvailable,
    isActive,
    isPlaying,
    frames,
    frameIndex: currentFrameIndex,
    currentFrame,
    column,
    isAggregated,
    tweenDuration,
    ease,
    settings: { columnIndex: validColumnIndex, grouping, speed, loop, cumulative },
    columnOptionIndices,
    includeAllColumns,
    showOneFrame,
    groupingOptions,
    play,
    pause,
    togglePlay,
    goToFrame,
    exit,
    updateSettings,
    getDrilldown: () =>
      currentFrame
        ? getFrameDrilldown({ frames, frameIndex: currentFrameIndex, column, cumulative, isAggregated })
        : undefined,
  }
}
