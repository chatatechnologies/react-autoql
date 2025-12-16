import React from 'react'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class AxisSortPopover extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  renderSelectorContent = ({ position, childRect, popoverRect }) => {
    if (this.props.hidden) {
      return null
    }

    let maxHeight = 300
    const minHeight = 35
    const padding = 50

    const chartHeight = this.props.chartContainerRef?.clientHeight
    if (chartHeight && chartHeight > minHeight + padding) {
      maxHeight = chartHeight - padding
    } else if (chartHeight && chartHeight < minHeight + padding) {
      maxHeight = minHeight
    }

    if (maxHeight > window.innerHeight) {
      maxHeight = window.innerHeight
    }

    const columnDisplayName = this.props.columnDisplayName || 'column'
    const valueColumnDisplayName = this.props.valueColumnDisplayName || 'values'
    
    // For heatmaps and bubble charts, only show string column sort options
    const sortOptions = this.props.stringColumnOnly
      ? [
          { value: null, label: 'No sort (original)' },
          { value: 'alpha-asc', label: `Sort by ${columnDisplayName} (asc)` },
          { value: 'alpha-desc', label: `Sort by ${columnDisplayName} (desc)` },
        ]
      : [
          { value: null, label: 'No sort (original)' },
          { value: 'alpha-asc', label: `Sort by ${columnDisplayName} (asc)` },
          { value: 'alpha-desc', label: `Sort by ${columnDisplayName} (desc)` },
          { value: 'value-asc', label: `Sort by ${valueColumnDisplayName} (asc)` },
          { value: 'value-desc', label: `Sort by ${valueColumnDisplayName} (desc)` },
        ]

    return (
      <div
        className={isMobile ? 'mobile-string-axis-selector-popover-content' : 'string-axis-selector-popover-content'}
      >
        <CustomScrollbars autoHeight autoHeightMin={minHeight} maxHeight={maxHeight} suppressScrollX>
          <div
            className='axis-selector-container'
            id='axis-sort-selector-content'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <ul className='axis-selector-content'>
              {sortOptions.map((option, i) => {
                return (
                  <li
                    className={`string-select-list-item ${
                      option.value === this.props.currentSort ? 'active' : ''
                    }`}
                    key={`axis-sort-option-${i}`}
                    onClick={() => {
                      this.props.closeSelector()
                      this.props.onSortChange(option.value)
                    }}
                  >
                    {option.label}
                  </li>
                )
              })}
            </ul>
          </div>
        </CustomScrollbars>
      </div>
    )
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <Popover
        id={`axis-sort-popover-${this.COMPONENT_KEY}`}
        innerRef={this.props.axisSortRef}
        isOpen={this.props.isOpen}
        content={this.renderSelectorContent}
        onClickOutside={this.props.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
      >
        {this.props.children}
      </Popover>
    )
  }
}

