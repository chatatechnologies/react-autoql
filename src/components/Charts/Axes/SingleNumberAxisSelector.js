import React from 'react'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { isColumnNumberType } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { SPLIT_SERIES_COUNT } from '../../QueryOutput/splitSeriesUtils'

export default class SingleNumberAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  // A split chart has one value: Count, or one of the original number columns (by position,
  // which is what the split config uses)
  renderSplitSeriesValueItems = (splitBy) => {
    const columns = splitBy.columns ?? []
    const items = [{ index: SPLIT_SERIES_COUNT, label: 'Count' }]
    ;(splitBy.numberColumnIndices ?? []).forEach((index) => {
      const column = columns[index]
      if (column) items.push({ index, label: column.display_name })
    })

    return (
      <ul className='axis-selector-content'>
        {items.map(({ index, label }) => (
          <li
            className={`string-select-list-item ${index === splitBy.valueColumnIndex ? 'active' : ''}`}
            key={`split-series-value-${index}`}
            data-test='split-series-value-option'
            onClick={() => {
              this.props.closeSelector()
              if (index !== splitBy.valueColumnIndex) {
                splitBy.onValueChange(index)
              }
            }}
          >
            {label}
          </li>
        ))}
      </ul>
    )
  }

  renderSelectorContent = ({ position, childRect, popoverRect }) => {
    const { hidden, scale, columns, originalColumns } = this.props

    const cols = originalColumns ?? columns
    if (hidden || !scale || !cols) {
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

    if (maxHeight > Window.innerHeight) {
      maxHeight = Window.innerHeight
    }

    const filteredColumns = cols.filter((col) => col.is_visible)
    const { splitBy } = this.props

    return (
      <div
        className={isMobile ? 'mobile-string-axis-selector-popover-content' : 'string-axis-selector-popover-content'}
      >
        <CustomScrollbars autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight} suppressScrollX={true}>
          <div
            className='axis-selector-container'
            id='string-column-selector-content'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {splitBy?.isActive ? (
              this.renderSplitSeriesValueItems(splitBy)
            ) : (
              <ul className='axis-selector-content'>
                {filteredColumns
                  .filter((col) => isColumnNumberType(col))
                  .map((col) => {
                    const scaleOrigColumn = scale.column?.origColumn ?? scale.column
                    const colIndex = scaleOrigColumn?.index
                    const isActive = col.index === colIndex
                  
                    return (
                      <li
                        className={`string-select-list-item ${isActive ? 'active' : ''}`}
                        key={`string-column-select-${col.id}`}
                        onClick={() => {
                          this.props.closeSelector()
                          scale.changeColumnIndices([col.index])
                        }}
                      >
                        {col.display_name}
                      </li>
                    )
                  })}
              </ul>
            )}
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
        id={`string-axis-selector-${this.COMPONENT_KEY}`}
        ref={this.props.axisSelectorRef}
        isOpen={this.props.isOpen}
        content={this.renderSelectorContent}
        onClickOutside={this.props.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
        reposition={true}
        padding={10}
      >
        {this.props.children}
      </Popover>
    )
  }
}
