import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'
import { Popover } from '../../Popover'
import { ROSE_SCALES, ROSE_SCALE_LABELS } from './measureScales'

import '../ChataSankeyDiagram/ChataSankeyDiagram.scss'
import '../TimeAnimation/TimeAnimation.scss'

export const ROSE_MODES = ['values', 'measures']
const MODE_LABELS = { values: 'Values of a column', measures: 'Measures' }

const SCALE_DESCRIPTIONS = {
  normalized:
    "How unusual this period is for each measure: its distance from the measure's average across all periods, compared with how much it usually varies. 1σ is a typical swing; beyond 2σ is rare. Blue is above average, red is below.",
  minmax:
    'Where this period falls between the measure\'s lowest and highest period: 0% is its lowest, 100% its highest. Good for "is this a high or low period for this measure?"',
  linear:
    'The values themselves, on one scale shared by every measure. Best when the measures are in the same units; a large measure will dwarf small ones.',
  log: 'The values themselves on a log scale: each ring is 10× the one inside it, so small measures stay visible next to large ones. Lengths show order of magnitude, not exact proportions.',
}

const ICON_SIZE = 20

// What the wedges are (the values of one column, or one per number column) and, for measures, how
// they're scaled. Sits in the rose's column of control buttons, styled like the column selectors.
const RoseSettingsControl = ({
  mode,
  scale,
  onModeChange,
  onScaleChange,
  measuresDisabledReason,
  x,
  y,
  size,
  chartTooltipID,
}) => {
  const [showSettings, setShowSettings] = useState(false)

  const renderSegmented = (options, value, onChange) => (
    <div className='time-animation-segmented'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          disabled={!!option.disabledReason}
          className={`time-animation-segment${option.value === value ? ' time-animation-segment-active' : ''}`}
          data-tooltip-id={option.disabledReason ? chartTooltipID : undefined}
          data-tooltip-content={option.disabledReason}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  const renderSettings = () => (
    // Clicks inside stay inside: the chart closes its popovers when clicked
    <div
      className='sankey-column-dropdown-popover-content time-animation-settings rose-settings'
      onClick={(e) => e.stopPropagation()}
    >
      <div className='sankey-column-dropdown-title'>Rose chart</div>
      <div className='time-animation-settings-body'>
        <div className='time-animation-setting'>
          <div className='time-animation-setting-label'>Wedges are</div>
          {renderSegmented(
            ROSE_MODES.map((value) => ({
              value,
              label: MODE_LABELS[value],
              disabledReason: value === 'measures' ? measuresDisabledReason : undefined,
            })),
            mode,
            onModeChange,
          )}
        </div>
        {mode === 'measures' && (
          <div className='time-animation-setting'>
            <div className='time-animation-setting-label'>Scale</div>
            {/* A list rather than segments: the names are too long to sit side by side */}
            <div className='rose-settings-options'>
              {ROSE_SCALES.map((value) => (
                <div
                  key={value}
                  className={`sankey-column-dropdown-item${
                    value === scale ? ' sankey-column-dropdown-item-selected' : ''
                  }`}
                  onClick={() => value !== scale && onScaleChange(value)}
                >
                  {value === scale && <Icon type='check' className='sankey-column-dropdown-item-check' />}
                  <span>{ROSE_SCALE_LABELS[value]}</span>
                </div>
              ))}
            </div>
            <div className='rose-settings-description'>{SCALE_DESCRIPTIONS[scale]}</div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <g className='sankey-path-button-group rose-settings-control'>
      <Popover
        isOpen={showSettings}
        onClickOutside={() => setShowSettings(false)}
        content={renderSettings()}
        positions={['left', 'bottom', 'top']}
        align='center'
        padding={5}
      >
        <g className='sankey-path-button' transform={`translate(${x}, ${y})`}>
          <rect
            className='sankey-path-button-rect'
            width={size}
            height={size}
            rx='4'
            strokeWidth='1'
            opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
            onClick={(e) => {
              e.stopPropagation()
              setShowSettings(!showSettings)
            }}
            data-tooltip-id={chartTooltipID}
            data-tooltip-html={`<strong>Wedges are:</strong><br/>${MODE_LABELS[mode]}${
              mode === 'measures' ? `, ${ROSE_SCALE_LABELS[scale]}` : ''
            }`}
            style={{ cursor: 'pointer' }}
          />
          <g
            transform={`translate(${(size - ICON_SIZE) / 2}, ${(size - ICON_SIZE) / 2})`}
            className='sankey-path-button-icon'
            opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
            style={{ pointerEvents: 'none' }}
          >
            <foreignObject width={ICON_SIZE} height={ICON_SIZE}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon type='list-settings' />
              </div>
            </foreignObject>
          </g>
        </g>
      </Popover>
    </g>
  )
}

RoseSettingsControl.propTypes = {
  mode: PropTypes.oneOf(ROSE_MODES).isRequired,
  scale: PropTypes.oneOf(ROSE_SCALES).isRequired,
  onModeChange: PropTypes.func.isRequired,
  onScaleChange: PropTypes.func.isRequired,
  // Set when the data can't be shown as measures; the option is disabled with this as its tooltip
  measuresDisabledReason: PropTypes.string,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  size: PropTypes.number,
  chartTooltipID: PropTypes.string,
}

RoseSettingsControl.defaultProps = {
  measuresDisabledReason: undefined,
  size: 30,
  chartTooltipID: undefined,
}

export default RoseSettingsControl
