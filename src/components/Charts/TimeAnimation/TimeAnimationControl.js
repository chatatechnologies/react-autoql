import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'
import { Popover } from '../../Popover'
import { Select } from '../../Select'
import { Switch } from '../../Switch'
import { TIME_ANIMATION_SPEEDS, getGroupingLabel } from './timeAnimationHelpers'

import '../ChataSankeyDiagram/ChataSankeyDiagram.scss'
import './TimeAnimation.scss'

export const TIME_ANIMATION_PLAY_HEIGHT = 30
export const TIME_ANIMATION_SETTINGS_HEIGHT = 22
export const TIME_ANIMATION_CONTROL_HEIGHT = TIME_ANIMATION_PLAY_HEIGHT + TIME_ANIMATION_SETTINGS_HEIGHT

const SETTINGS_ICON_SIZE = 14

const formatSpeed = (speed) => `${speed}×`

// Play/pause with its settings attached underneath, as one control. Sits in a chart's column of
// control buttons; `animation` is the object returned by useTimeAnimation.
const TimeAnimationControl = ({ animation, columns, x, y, size, chartTooltipID }) => {
  const [showSettings, setShowSettings] = useState(false)
  const [popoverElement, setPopoverElement] = useState(null)

  if (!animation.columnOptionIndices.length) {
    return null
  }

  const { isAvailable, isPlaying, settings, columnOptionIndices, groupingOptions, includeAllColumns } = animation
  const disabled = !isAvailable
  const getColumnLabel = (index) => columns[index]?.display_name || columns[index]?.name || ''

  const playTooltip = disabled
    ? settings.columnIndex === undefined
      ? 'Pick a column to step through in the settings below'
      : 'Needs more than one time period to play'
    : isPlaying
    ? 'Pause'
    : `Play over time by ${getColumnLabel(settings.columnIndex)}`

  const handleClickOutside = (e) => {
    // Keep the settings open while a nested Select menu is in use
    if (e?.target?.closest?.('.react-autoql-select-popover-container')) {
      return
    }
    setShowSettings(false)
  }

  const renderSegmented = (options, value, onChange) => (
    <div className='time-animation-segmented'>
      {options.map((option) => (
        <button
          key={`${option.value}`}
          type='button'
          className={`time-animation-segment${option.value === value ? ' time-animation-segment-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  const renderGroupingSetting = () => {
    if (!settings.grouping) {
      return null
    }
    if (groupingOptions.length <= 1) {
      // Grouped data stays at the query's own periods
      return <div className='time-animation-setting-value'>{getGroupingLabel(settings.grouping)}</div>
    }
    return (
      <Select
        size='small'
        outlined
        fullWidth
        value={settings.grouping}
        popoverParentElement={popoverElement}
        popoverBoundaryElement={popoverElement}
        options={groupingOptions.map((grouping) => ({ value: grouping, label: getGroupingLabel(grouping) }))}
        onChange={(grouping) => animation.updateSettings({ grouping })}
      />
    )
  }

  const renderSettings = () => (
    <div className='sankey-column-dropdown-popover-content time-animation-settings' ref={setPopoverElement}>
      <div className='sankey-column-dropdown-title'>Play over time</div>
      <div className='time-animation-settings-body'>
        <div className='time-animation-setting'>
          <div className='time-animation-setting-label'>{includeAllColumns ? 'Step through' : 'Date column'}</div>
          {columnOptionIndices.length > 1 || settings.columnIndex === undefined ? (
            <Select
              size='small'
              outlined
              fullWidth
              placeholder='Pick a column'
              value={settings.columnIndex}
              popoverParentElement={popoverElement}
              popoverBoundaryElement={popoverElement}
              options={columnOptionIndices.map((index) => ({ value: index, label: getColumnLabel(index) }))}
              onChange={(columnIndex) => animation.updateSettings({ columnIndex: Number(columnIndex) })}
            />
          ) : (
            <div className='time-animation-setting-value'>{getColumnLabel(settings.columnIndex)}</div>
          )}
        </div>
        {settings.grouping && (
          <div className='time-animation-setting'>
            <div className='time-animation-setting-label'>Step by</div>
            {renderGroupingSetting()}
          </div>
        )}
        <div className='time-animation-setting'>
          <div className='time-animation-setting-label'>Show</div>
          {renderSegmented(
            [
              { value: false, label: 'Each period' },
              { value: true, label: 'Running total' },
            ],
            settings.cumulative,
            (cumulative) => animation.updateSettings({ cumulative }),
          )}
        </div>
        <div className='time-animation-setting'>
          <div className='time-animation-setting-label'>Speed</div>
          {renderSegmented(
            TIME_ANIMATION_SPEEDS.map((speed) => ({ value: speed, label: formatSpeed(speed) })),
            settings.speed,
            (speed) => animation.updateSettings({ speed }),
          )}
        </div>
        <div className='time-animation-setting time-animation-setting-inline'>
          <div className='time-animation-setting-label'>Loop</div>
          <Switch checked={settings.loop} onChange={(loop) => animation.updateSettings({ loop })} />
        </div>
      </div>
    </div>
  )

  const iconCenter = size / 2

  return (
    <g
      className={`time-animation-control${disabled ? ' sankey-button-disabled' : ''}`}
      transform={`translate(${x}, ${y})`}
    >
      {/* One outline around both halves so they read as a single control */}
      <rect
        className='time-animation-control-outline'
        width={size}
        height={TIME_ANIMATION_CONTROL_HEIGHT}
        rx='4'
        opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
        style={{ pointerEvents: 'none' }}
      />
      <rect
        className='time-animation-control-hit time-animation-play-button-rect'
        width={size}
        height={TIME_ANIMATION_PLAY_HEIGHT}
        rx='4'
        opacity={0}
        data-tooltip-id={chartTooltipID}
        data-tooltip-content={playTooltip}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          setShowSettings(false)
          if (!disabled) {
            animation.togglePlay()
          }
        }}
      />
      <g className='time-animation-control-icon time-animation-play-icon' opacity={0} style={{ pointerEvents: 'none' }}>
        {isPlaying ? (
          <>
            <rect
              x={iconCenter - 5}
              y={TIME_ANIMATION_PLAY_HEIGHT / 2 - 7}
              width={3.5}
              height={14}
              rx={1}
              fill='currentColor'
            />
            <rect
              x={iconCenter + 1.5}
              y={TIME_ANIMATION_PLAY_HEIGHT / 2 - 7}
              width={3.5}
              height={14}
              rx={1}
              fill='currentColor'
            />
          </>
        ) : (
          <path
            d={`M${iconCenter - 4.5},${TIME_ANIMATION_PLAY_HEIGHT / 2 - 7} L${iconCenter + 6.5},${
              TIME_ANIMATION_PLAY_HEIGHT / 2
            } L${iconCenter - 4.5},${TIME_ANIMATION_PLAY_HEIGHT / 2 + 7} Z`}
            fill='currentColor'
            stroke='currentColor'
            strokeWidth={1}
            strokeLinejoin='round'
          />
        )}
      </g>
      <line
        className='time-animation-control-divider'
        x1={4}
        x2={size - 4}
        y1={TIME_ANIMATION_PLAY_HEIGHT}
        y2={TIME_ANIMATION_PLAY_HEIGHT}
        opacity={0}
        style={{ pointerEvents: 'none' }}
      />
      <Popover
        isOpen={showSettings}
        onClickOutside={handleClickOutside}
        content={renderSettings()}
        positions={['left', 'bottom', 'top']}
        align='center'
        padding={5}
      >
        <rect
          className='time-animation-control-hit time-animation-settings-button-rect'
          y={TIME_ANIMATION_PLAY_HEIGHT}
          width={size}
          height={TIME_ANIMATION_SETTINGS_HEIGHT}
          rx='4'
          opacity={0}
          data-tooltip-id={chartTooltipID}
          data-tooltip-content='Time settings'
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            setShowSettings(!showSettings)
          }}
        />
      </Popover>
      <g
        className='time-animation-control-icon'
        transform={`translate(${iconCenter - SETTINGS_ICON_SIZE / 2}, ${
          TIME_ANIMATION_PLAY_HEIGHT + (TIME_ANIMATION_SETTINGS_HEIGHT - SETTINGS_ICON_SIZE) / 2
        })`}
        opacity={0}
        style={{ pointerEvents: 'none' }}
      >
        <foreignObject width={SETTINGS_ICON_SIZE} height={SETTINGS_ICON_SIZE}>
          <div className='time-animation-settings-icon'>
            <Icon type='settings' />
          </div>
        </foreignObject>
      </g>
    </g>
  )
}

TimeAnimationControl.propTypes = {
  // The object returned by useTimeAnimation
  animation: PropTypes.shape({
    isAvailable: PropTypes.bool,
    isPlaying: PropTypes.bool,
    settings: PropTypes.shape({
      columnIndex: PropTypes.number,
      grouping: PropTypes.string,
      speed: PropTypes.number,
      loop: PropTypes.bool,
      cumulative: PropTypes.bool,
    }),
    columnOptionIndices: PropTypes.arrayOf(PropTypes.number),
    includeAllColumns: PropTypes.bool,
    groupingOptions: PropTypes.arrayOf(PropTypes.string),
    togglePlay: PropTypes.func,
    updateSettings: PropTypes.func,
  }).isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, display_name: PropTypes.string })).isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  size: PropTypes.number,
  chartTooltipID: PropTypes.string,
}

TimeAnimationControl.defaultProps = {
  size: 30,
  chartTooltipID: undefined,
}

export default TimeAnimationControl
