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
      positions={['bottom', 'top']}
      align='start'
      content={
        <div className='pivot-axis-selector-popover'>
          <CustomScrollbars maxHeight={220}>
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

export const buildPivotAxisTitleElement = (col, onOpen) => {
  const container = document.createElement('div')
  container.className = 'pivot-axis-title-container'
  container.setAttribute('role', 'button')
  container.setAttribute('aria-haspopup', 'listbox')
  container.tabIndex = 0

  const titleSpan = document.createElement('span')
  titleSpan.className = 'pivot-axis-title-text'
  titleSpan.textContent = col.title || col.display_name || ''

  const arrowSpan = document.createElement('span')
  arrowSpan.className = 'pivot-axis-title-arrow'
  arrowSpan.textContent = '▼'

  container.appendChild(titleSpan)
  container.appendChild(arrowSpan)

  const openSelector = (e) => {
    e.stopPropagation()
    onOpen(container)
  }

  container.addEventListener('click', openSelector)
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openSelector(e)
    }
  })

  return container
}

export const computePivotAxisSelectorLocation = (element, tableContainer) => {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const tableRect = tableContainer?.getBoundingClientRect() || { top: 0, left: 0 }
  return { top: rect.bottom - tableRect.top, left: rect.left - tableRect.left }
}

export default PivotAxisSelector
