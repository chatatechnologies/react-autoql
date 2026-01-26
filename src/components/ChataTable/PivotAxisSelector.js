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
      // Prefer bottom placement; center-align the popover under the header.
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

  // Anchor popover centered below header with a small gap
  const GAP = 4
  const top = rectBottom - tableRect.top + GAP
  const left = rect.left - tableRect.left + (rect.width || 0) / 2

  return { top, left }
}

export default PivotAxisSelector
