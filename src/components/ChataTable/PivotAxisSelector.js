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
      positions={['top', 'bottom']}
      align='start'
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
      <div style={{ position: 'absolute', top: location?.top, left: location?.left }} />
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
  const tableRect = tableContainer?.getBoundingClientRect() || { top: 0, left: 0 }

  // Center the header element and apply offsets for popover placement.
  const OFFSET_RIGHT = 30
  const OFFSET_DOWN = 40

  const centerX = rect.left + rect.width / 2 - tableRect.left
  const centerY = rect.top + rect.height / 2 - tableRect.top

  return {
    top: Math.max(0, Math.round(centerY + OFFSET_DOWN)),
    left: Math.max(0, Math.round(centerX + OFFSET_RIGHT)),
  }
}

export default PivotAxisSelector
