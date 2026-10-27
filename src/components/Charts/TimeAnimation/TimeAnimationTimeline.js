import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { line as d3Line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import 'd3-transition'

import './TimeAnimation.scss'

const TITLE_FONT_SIZE = 11 // Same size as the chart labels; bold sets it apart
const VALUE_FONT_SIZE = 11
const AXIS_FONT_SIZE = 9
const TITLE_HEIGHT = 22
const LEGEND_ROW_HEIGHT = 15
const AXIS_HEIGHT = 14
const CLOSE_SIZE = 16
const PADDING = 6
const SWATCH_SIZE = 8
const SWATCH_GAP = 5
const LEGEND_GAP = 10
const SPARK_TOP_PADDING = 6
// Smallest sparkline that's still readable
const SPARK_MIN_HEIGHT = 40

const truncate = (text, width, fontSize = AXIS_FONT_SIZE) => {
  const maxChars = Math.floor(width / (fontSize * 0.6))
  if (text.length <= maxChars) {
    return text
  }
  return maxChars > 3 ? `${text.substring(0, maxChars - 1)}…` : ''
}

const getHeaderHeight = (seriesCount) => TITLE_HEIGHT + LEGEND_ROW_HEIGHT * Math.max(1, seriesCount)

// The least height that fits the legend and a readable sparkline, for charts sizing the timeline
export const getTimelineMinHeight = (seriesCount) => getHeaderHeight(seriesCount) + SPARK_MIN_HEIGHT + AXIS_HEIGHT

const getYScale = (values, top, bottom) => {
  const finite = values.filter(Number.isFinite)
  const min = Math.min(0, ...finite)
  const max = Math.max(0, ...finite)
  return scaleLinear()
    .domain([min, max === min ? min + 1 : max])
    .range([bottom, top])
}

// The period being shown, a legend with each series' color, name and value in that period, and one line
// chart of every series over all periods, with a marker on the current one. Click or drag along the chart
// to jump to a period. Series can be in different units, so each line has its own vertical scale: the
// lines show how each one rises and falls over time, and the legend gives their actual values.
// Chart-agnostic: it only needs the frames, a value per frame for each series, and a box to draw in.
const TimeAnimationTimeline = ({
  x,
  y,
  width,
  height,
  frames,
  series,
  frameIndex,
  cumulative,
  textColor,
  secondaryTextColor,
  borderColor,
  tweenDuration,
  ease,
  onSeek,
  onClose,
}) => {
  const isDragging = useRef(false)
  const markerRef = useRef(null)
  const dotRefs = useRef([])
  // Where the marker is drawn right now, mid-tween included
  const drawnPositionRef = useRef(null)

  const sparkX = PADDING
  const sparkWidth = Math.max(0, width - 2 * PADDING)
  const sparkTop = getHeaderHeight(series.length) + SPARK_TOP_PADDING
  const sparkBottom = Math.max(sparkTop, height - AXIS_HEIGHT)

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(1, frames.length - 1)])
        .range([sparkX, sparkX + sparkWidth]),
    [frames.length, sparkX, sparkWidth],
  )

  const lines = useMemo(
    () =>
      series.map(({ values }) => {
        const yScale = getYScale(values, sparkTop, sparkBottom)
        const getY = (value) => yScale(Number.isFinite(value) ? value : 0)
        return {
          getY,
          linePath: d3Line()
            .x((_, frame) => xScale(frame))
            .y(getY)(values),
        }
      }),
    [series, xScale, sparkTop, sparkBottom],
  )

  const markerX = xScale(frameIndex)
  const markerYs = lines.map((line, i) => line.getY(series[i].values[frameIndex]))
  const markerYsKey = markerYs.join(',')

  // Glide the marker to the new period in step with the chart's own tween. Moving in a straight line
  // at a constant speed during playback keeps each dot on its sparkline between two periods.
  useLayoutEffect(() => {
    const to = { x: markerX, ys: markerYs }
    // A series added or removed since the last frame has nowhere to come from, so don't tween
    const from = drawnPositionRef.current?.ys.length === to.ys.length ? drawnPositionRef.current : null
    const setPosition = (position) => {
      drawnPositionRef.current = position
      markerRef.current?.setAttribute('transform', `translate(${position.x}, 0)`)
      position.ys.forEach((dotY, i) => {
        dotRefs.current[i]?.setAttribute('cx', position.x)
        dotRefs.current[i]?.setAttribute('cy', dotY)
      })
    }

    if (!from || !tweenDuration || !markerRef.current) {
      setPosition(to)
      return
    }

    setPosition(from)
    select(markerRef.current)
      .interrupt()
      .transition()
      .duration(tweenDuration)
      .ease((t) => t)
      .tween('position', () => (t) => {
        const progress = ease(t)
        setPosition({
          x: from.x + (to.x - from.x) * progress,
          ys: from.ys.map((fromY, i) => fromY + (to.ys[i] - fromY) * progress),
        })
      })
  }, [markerX, markerYsKey])

  useLayoutEffect(() => {
    const marker = markerRef.current
    return () => marker && select(marker).interrupt()
  }, [])

  if (!frames.length || !series.length || width <= 0 || height <= 0) {
    return null
  }

  const frame = frames[frameIndex]
  const title = cumulative ? `Through ${frame?.label ?? ''}` : frame?.label ?? ''
  const halfAxisWidth = sparkWidth / 2

  const getFrameIndexAt = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    // The hit area spans the sparkline exactly, so its screen width maps straight onto the frames
    const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0
    return Math.round(Math.max(0, Math.min(1, ratio)) * (frames.length - 1))
  }

  const handlePointerDown = (event) => {
    event.stopPropagation()
    isDragging.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onSeek(getFrameIndexAt(event))
  }

  const handlePointerMove = (event) => {
    if (isDragging.current) {
      onSeek(getFrameIndexAt(event))
    }
  }

  const handlePointerUp = (event) => {
    isDragging.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  // A swatch, the name, and the value in the current period (always shown in full; the name gets the rest)
  const renderLegendRow = ({ key, label, values, color, formatValue }, i) => {
    const value = `${formatValue(values[frameIndex])}`
    const textY = TITLE_HEIGHT + LEGEND_ROW_HEIGHT * i + VALUE_FONT_SIZE - 1
    const textX = PADDING + SWATCH_SIZE + SWATCH_GAP
    const valueWidth = value.length * VALUE_FONT_SIZE * 0.6
    const nameWidth = Math.max(0, width - PADDING - textX - valueWidth - LEGEND_GAP)
    return (
      <g key={`legend-${key}`} className='time-animation-timeline-legend-row'>
        <rect
          x={PADDING}
          y={textY - VALUE_FONT_SIZE * 0.35 - SWATCH_SIZE / 2}
          width={SWATCH_SIZE}
          height={SWATCH_SIZE}
          rx={2}
          fill={color}
        />
        <text className='time-animation-timeline-label' x={textX} y={textY} fontSize={VALUE_FONT_SIZE} fill={textColor}>
          {truncate(label ?? '', nameWidth, VALUE_FONT_SIZE)}
        </text>
        <text
          className='time-animation-timeline-value'
          x={width - PADDING}
          y={textY}
          fontSize={VALUE_FONT_SIZE}
          textAnchor='end'
          fill={textColor}
        >
          {value}
        </text>
      </g>
    )
  }

  return (
    <g className='time-animation-timeline' transform={`translate(${x}, ${y})`}>
      {/* Colors are set inline so they carry over to the exported PNG */}
      <text
        className='time-animation-timeline-title'
        x={PADDING}
        y={TITLE_FONT_SIZE + 2}
        fontSize={TITLE_FONT_SIZE}
        fontWeight='bold'
        fill={textColor}
      >
        {truncate(title, width - CLOSE_SIZE - 2 * PADDING, TITLE_FONT_SIZE)}
      </text>

      {series.map(renderLegendRow)}

      <line
        x1={sparkX}
        x2={sparkX + sparkWidth}
        y1={sparkBottom}
        y2={sparkBottom}
        stroke={borderColor}
        style={{ pointerEvents: 'none' }}
      />
      {series.map((item, i) => (
        <path
          key={`line-${item.key}`}
          className='time-animation-timeline-line'
          d={lines[i].linePath}
          fill='none'
          stroke={item.color}
          strokeWidth={1.25}
        />
      ))}

      <g ref={markerRef} className='time-animation-timeline-marker' transform={`translate(${markerX}, 0)`}>
        <line y1={sparkTop} y2={sparkBottom} stroke={textColor} strokeOpacity={0.5} strokeDasharray='2,2' />
      </g>
      {series.map(({ key, color }, i) => (
        <circle
          key={`dot-${key}`}
          ref={(element) => {
            dotRefs.current[i] = element
          }}
          className='time-animation-timeline-dot'
          r={3}
          fill={color}
          stroke={textColor}
          strokeWidth={1}
          cx={markerX}
          cy={markerYs[i]}
        />
      ))}

      {/* Last, so it's on top: click or drag anywhere along the chart to pick a period */}
      <rect
        className='time-animation-timeline-hit'
        x={sparkX}
        y={sparkTop}
        width={sparkWidth}
        height={sparkBottom - sparkTop}
        fill='transparent'
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(event) => event.stopPropagation()}
      />

      <text
        x={sparkX}
        y={height - 2}
        fontSize={AXIS_FONT_SIZE}
        fill={secondaryTextColor}
        style={{ pointerEvents: 'none' }}
      >
        {truncate(frames[0].label, halfAxisWidth)}
      </text>
      <text
        x={sparkX + sparkWidth}
        y={height - 2}
        fontSize={AXIS_FONT_SIZE}
        textAnchor='end'
        fill={secondaryTextColor}
        style={{ pointerEvents: 'none' }}
      >
        {truncate(frames[frames.length - 1].label, halfAxisWidth)}
      </text>

      {onClose && (
        <g
          className='time-animation-timeline-close'
          transform={`translate(${width - CLOSE_SIZE}, 2)`}
          opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <title>Show all data</title>
          <rect width={CLOSE_SIZE} height={CLOSE_SIZE} rx={3} fill='transparent' />
          <path
            d={`M4,4 L${CLOSE_SIZE - 4},${CLOSE_SIZE - 4} M${CLOSE_SIZE - 4},4 L4,${CLOSE_SIZE - 4}`}
            stroke='currentColor'
            strokeWidth={1.5}
            strokeLinecap='round'
          />
        </g>
      )}
    </g>
  )
}

TimeAnimationTimeline.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  frames: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string })).isRequired,
  // One line each, eg. one per value column: a value for every frame
  series: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string,
      values: PropTypes.arrayOf(PropTypes.number).isRequired,
      color: PropTypes.string.isRequired,
      formatValue: PropTypes.func.isRequired,
    }),
  ).isRequired,
  frameIndex: PropTypes.number.isRequired,
  cumulative: PropTypes.bool,
  textColor: PropTypes.string,
  secondaryTextColor: PropTypes.string,
  borderColor: PropTypes.string,
  tweenDuration: PropTypes.number,
  ease: PropTypes.func,
  onSeek: PropTypes.func.isRequired,
  onClose: PropTypes.func,
}

TimeAnimationTimeline.defaultProps = {
  cumulative: false,
  textColor: '#5d5d5d',
  secondaryTextColor: '#808080',
  borderColor: '#D8D8D8',
  tweenDuration: 0,
  ease: (t) => t,
  onClose: undefined,
}

export default TimeAnimationTimeline
