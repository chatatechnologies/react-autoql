import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { area as d3Area, line as d3Line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import 'd3-transition'

import { BAR_GRADIENT_OPACITY_STOPS } from '../chartPropHelpers'

import './TimeAnimation.scss'

const TITLE_FONT_SIZE = 11 // Same size as the chart labels; bold sets it apart
const VALUE_FONT_SIZE = 11
const AXIS_FONT_SIZE = 9
const CHAR_WIDTH = AXIS_FONT_SIZE * 0.6
const TITLE_HEIGHT = 22
const VALUE_ROW_HEIGHT = 14
const SWATCH_SIZE = 8
const AXIS_HEIGHT = 14
const CLOSE_SIZE = 16
const PADDING = 6

const truncate = (text, width) => {
  const maxChars = Math.floor(width / CHAR_WIDTH)
  if (text.length <= maxChars) {
    return text
  }
  return maxChars > 3 ? `${text.substring(0, maxChars - 1)}…` : ''
}

const getHeaderHeight = (seriesCount) => TITLE_HEIGHT + VALUE_ROW_HEIGHT * Math.max(1, seriesCount) + 4

// Each series past the first adds a row of values to the header; charts add this to the timeline's height
export const getTimelineExtraHeight = (seriesCount) => VALUE_ROW_HEIGHT * Math.max(0, seriesCount - 1)

const getYScale = (values, top, bottom) => {
  const finite = values.filter(Number.isFinite)
  const min = Math.min(0, ...finite)
  const max = Math.max(0, ...finite)
  return scaleLinear()
    .domain([min, max === min ? min + 1 : max])
    .range([bottom, top])
}

// The period being shown plus a sparkline of each series over all periods, with a marker on the current
// one. Click or drag along the sparkline to jump to a period. Chart-agnostic: it only needs the frames,
// a value per frame for each series, and a box to draw in (beside the chart or under it).
// Series can be in different units, so each line has its own vertical scale: the lines show how each
// one rises and falls over time, and the header gives their actual values.
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
  const gradientId = useRef(`time-animation-gradient-${uuid()}`).current
  const isDragging = useRef(false)
  const markerRef = useRef(null)
  const dotRefs = useRef([])
  // Where the marker is drawn right now, mid-tween included
  const drawnPositionRef = useRef(null)

  const sparkTop = getHeaderHeight(series.length)
  const sparkHeight = Math.max(0, height - sparkTop - AXIS_HEIGHT)
  const sparkBottom = sparkTop + sparkHeight
  const sparkWidth = Math.max(0, width - 2 * PADDING)

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(1, frames.length - 1)])
        .range([PADDING, PADDING + sparkWidth]),
    [frames.length, sparkWidth],
  )

  const lines = useMemo(
    () =>
      series.map(({ values }) => {
        const yScale = getYScale(values, sparkTop + 4, sparkBottom)
        const getY = (value) => yScale(Number.isFinite(value) ? value : 0)
        const zeroY = yScale(Math.max(0, yScale.domain()[0]))
        return {
          getY,
          zeroY,
          linePath: d3Line()
            .x((_, i) => xScale(i))
            .y(getY)(values),
          areaPath: d3Area()
            .x((_, i) => xScale(i))
            .y0(zeroY)
            .y1(getY)(values),
        }
      }),
    [series, xScale, sparkTop, sparkBottom],
  )

  const markerX = xScale(frameIndex)
  const markerYs = lines.map((line, i) => line.getY(series[i].values[frameIndex]))
  const markerYsKey = markerYs.join(',')

  // Glide the marker to the new period in step with the chart's own tween. Moving in a straight line
  // at a constant speed during playback keeps the dot on the sparkline between two periods.
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

  if (!frames.length || width <= 0 || height <= 0) {
    return null
  }

  const frame = frames[frameIndex]
  const title = cumulative ? `Through ${frame?.label ?? ''}` : frame?.label ?? ''
  const halfAxisWidth = width / 2 - PADDING

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

  // One series gets a filled area like the other charts; several are lines only so they stay readable
  const isSingleSeries = series.length === 1
  const valueTextWidth =
    (width - 2 * PADDING - (isSingleSeries ? 0 : SWATCH_SIZE + 4)) * (AXIS_FONT_SIZE / VALUE_FONT_SIZE)

  return (
    <g className='time-animation-timeline' transform={`translate(${x}, ${y})`}>
      {isSingleSeries && (
        <defs>
          <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={series[0].color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[0]} />
            <stop offset='50%' stopColor={series[0].color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[1]} />
            <stop offset='100%' stopColor={series[0].color} stopOpacity={BAR_GRADIENT_OPACITY_STOPS[2]} />
          </linearGradient>
        </defs>
      )}

      {/* Colors are set inline so they carry over to the exported PNG */}
      <text
        className='time-animation-timeline-title'
        x={PADDING}
        y={TITLE_FONT_SIZE + 2}
        fontSize={TITLE_FONT_SIZE}
        fontWeight='bold'
        fill={textColor}
      >
        {truncate(title, (width - CLOSE_SIZE - 2 * PADDING) * (AXIS_FONT_SIZE / TITLE_FONT_SIZE))}
      </text>
      {series.map(({ key, label, values, color, formatValue }, i) => {
        const rowY = TITLE_HEIGHT + VALUE_ROW_HEIGHT * i
        const textX = isSingleSeries ? PADDING : PADDING + SWATCH_SIZE + 4
        const text = `${label ? `${label}: ` : ''}${formatValue(values[frameIndex])}`
        return (
          <g key={`value-${key}`} className='time-animation-timeline-value'>
            {!isSingleSeries && (
              <rect
                x={PADDING}
                y={rowY + (VALUE_ROW_HEIGHT - SWATCH_SIZE) / 2 - 1}
                width={SWATCH_SIZE}
                height={SWATCH_SIZE}
                rx={2}
                fill={color}
              />
            )}
            <text x={textX} y={rowY + VALUE_FONT_SIZE - 1} fontSize={VALUE_FONT_SIZE} fill={secondaryTextColor}>
              {truncate(text, valueTextWidth)}
            </text>
          </g>
        )
      })}

      {sparkHeight > 0 && (
        <>
          {/* With one scale per series there's no shared zero, so several series sit on the bottom edge */}
          <line
            x1={PADDING}
            x2={PADDING + sparkWidth}
            y1={isSingleSeries ? lines[0].zeroY : sparkBottom}
            y2={isSingleSeries ? lines[0].zeroY : sparkBottom}
            stroke={borderColor}
          />
          {isSingleSeries && (
            <path className='time-animation-timeline-area' d={lines[0].areaPath} fill={`url(#${gradientId})`} />
          )}
          {series.map(({ key, color }, i) => (
            <path
              key={`line-${key}`}
              className='time-animation-timeline-line'
              d={lines[i].linePath}
              fill='none'
              stroke={color}
              strokeWidth={1.5}
            />
          ))}
          <g ref={markerRef} className='time-animation-timeline-marker' transform={`translate(${markerX}, 0)`}>
            <line
              y1={sparkTop}
              y2={sparkTop + sparkHeight}
              stroke={textColor}
              strokeOpacity={0.5}
              strokeDasharray='2,2'
            />
          </g>
          {series.map(({ key, color }, i) => (
            <circle
              key={`dot-${key}`}
              ref={(element) => {
                dotRefs.current[i] = element
              }}
              className='time-animation-timeline-dot'
              r={3.5}
              fill={color}
              stroke={textColor}
              strokeWidth={1}
              cx={markerX}
              cy={markerYs[i]}
            />
          ))}
          <rect
            className='time-animation-timeline-hit'
            x={PADDING}
            y={sparkTop}
            width={sparkWidth}
            height={sparkHeight}
            fill='transparent'
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={(event) => event.stopPropagation()}
          />
          <text
            x={PADDING}
            y={height - 2}
            fontSize={AXIS_FONT_SIZE}
            fill={secondaryTextColor}
            style={{ pointerEvents: 'none' }}
          >
            {truncate(frames[0].label, halfAxisWidth)}
          </text>
          <text
            x={width - PADDING}
            y={height - 2}
            fontSize={AXIS_FONT_SIZE}
            textAnchor='end'
            fill={secondaryTextColor}
            style={{ pointerEvents: 'none' }}
          >
            {truncate(frames[frames.length - 1].label, halfAxisWidth)}
          </text>
        </>
      )}

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
  // One per line, eg. one per value column: a value for every frame
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
