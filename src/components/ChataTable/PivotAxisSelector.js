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
  const elementCenterX = rect.left + rect.width / 2 - 52
  const elementCenterY = rect.top + rect.height / 2 + 35

  return {
    top: elementCenterY - tableRect.top,
    left: elementCenterX - tableRect.left,
  }
}

export default PivotAxisSelector
