import React from 'react'
import PropTypes from 'prop-types'

import { Popover } from '../Popover'
import { CustomScrollbars } from '../CustomScrollbars'

const PivotAxisSelector = ({ isOpen, options, activeIndex, location, onClose, onChange }) => {
  if (!options?.length) return null

  return (
    <Popover
      isOpen={isOpen}
      onClickOutside={onClose}
      // Prefer showing below the anchor, fall back to top. Use center alignment
      // so the popover is centered under the clicked header.
      positions={['bottom', 'top']}
      align='center'
      padding={0}
      content={
        <div className='pivot-axis-selector-container'>
          <CustomScrollbars maxHeight={220} suppressScrollX={true}>
            <ul className='pivot-axis-selector-list'>
              {options.map((opt) => (
                <li
                  key={`pivot-axis-option-${opt.value}`}
                  className={`pivot-axis-selector-item ${opt.value === activeIndex ? 'active' : ''}`}
                  onClick={() => {
                    onClose()
                    onChange(opt.value)
                  }}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          </CustomScrollbars>
        </div>
      }
    >
      {/*
        Anchor for Popover: positioned at the header's center point.
        Use transform translateX(-50%) so the Popover can center itself.
      */}
      <div
        style={{
          position: 'absolute',
          top: location?.top,
          left: location?.left,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
        }}
      />
    </Popover>
  )
}

PivotAxisSelector.propTypes = {
  isOpen: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number, label: PropTypes.string })),
  activeIndex: PropTypes.number,
  location: PropTypes.shape({ top: PropTypes.number, left: PropTypes.number }),
  onClose: PropTypes.func,
  onChange: PropTypes.func,
}

PivotAxisSelector.defaultProps = {
  isOpen: false,
  options: [],
  activeIndex: undefined,
  location: null,
  onClose: () => {},
  onChange: () => {},
}

export const computePivotAxisSelectorLocation = (element, tableContainer) => {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const tableRect = tableContainer?.getBoundingClientRect?.() || { top: 0, left: 0 }

  // Some test mocks may not provide `bottom` — compute a fallback.
  const rectBottom = typeof rect.bottom === 'number' ? rect.bottom : rect.top + (rect.height || 0)

  // Position the popover just below the header element, centered horizontally
  // relative to the header. Avoid fixed magic numbers; use a small gap so the
  // popover doesn't overlap the header.
  const GAP = 4
  const top = rectBottom - tableRect.top + GAP
  // Anchor at the header's horizontal center so Popover can center itself.
  const left = rect.left - tableRect.left + (rect.width || 0) / 2

  return { top, left }
}

export default PivotAxisSelector
