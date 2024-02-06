import React from 'react'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { isColumnDateType, isColumnStringType } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class StringAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  getAllStringColumnIndices = () => {
    const columnIndices = []
    let columns = this.props.isAggregated ? this.props.originalColumns : this.props.columns
    columns.forEach((col, i) => {
      const isOnNumberAxis = this.props.numberColumnIndices?.includes(col.index)
      const isOnSecondNumberAxis = this.props.hasSecondAxis && this.props.numberColumnIndices2?.includes(col.index)

      if ((!isOnNumberAxis && !isOnSecondNumberAxis && col.is_visible) || (col.groupable && col.isStringType)) {
        columnIndices.push(i)
      }
    })
    return columnIndices
  }

  getDateColumnIndices = () => {
    const dateColumnIndices = []
    this.props.columns.forEach((col, i) => {
      if (isColumnDateType(col) && col.is_visible) {
        dateColumnIndices.push(i)
      }
    })
    return dateColumnIndices
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

    if (maxHeight > Window.innerHeight) {
      maxHeight = Window.innerHeight
    }

    let columnIndices = []
    if (this.props.dateColumnsOnly) {
      columnIndices = this.getDateColumnIndices()
    } else {
      columnIndices = this.getAllStringColumnIndices()
    }
    if (this.props.isAggregated) {
      columnIndices = [this.props.legendColumn.index]
    }

    return (
      <div
        className={isMobile ? 'mobile-string-axis-selector-popover-content' : 'string-axis-selector-popover-content'}
      >
        <CustomScrollbars autoHeight autoHeightMin={minHeight} maxHeight={maxHeight}>
          <div
            className='axis-selector-container'
            id='string-column-selector-content'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <ul className='axis-selector-content'>
              {columnIndices.map((colIndex, i) => {
                return (
                  <li
                    className={`string-select-list-item ${
                      colIndex === this.props.stringColumnIndex || this.props.isAggregated ? 'active' : ''
                    }`}
                    key={`string-column-select-${i}`}
                    onClick={() => {
                      this.props.closeSelector()
                      this.props.changeStringColumnIndex(colIndex)
                    }}
                  >
                    {this.props.isAggregated
                      ? this.props.originalColumns?.[colIndex]?.display_name
                      : this.props.columns?.[colIndex]?.display_name}
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
        id={`string-axis-selector-${this.COMPONENT_KEY}`}
        innerRef={this.props.axisSelectorRef}
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
