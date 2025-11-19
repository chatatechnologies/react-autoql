import React from 'react'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { isColumnDateType, isColumnStringType, isSelectableStringColumn } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class StringAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  getAllStringColumnIndices = () => {
    return this.props.columns.reduce((acc, col, i) => {
      if (!col.is_visible || !isSelectableStringColumn(col)) return acc
      const isOnNumberAxis = this.props.numberColumnIndices?.includes(col.index)
      const isOnSecondNumberAxis = this.props.hasSecondAxis && this.props.numberColumnIndices2?.includes(col.index)
      const isOnAnyNumberAxis = isOnNumberAxis || isOnSecondNumberAxis
      // Include if: not on any number axis, OR (groupable and explicitly a string column)
      const shouldInclude = !isOnAnyNumberAxis || (col.groupable && isColumnStringType(col))
      if (shouldInclude) acc.push(i)
      return acc
    }, [])
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

    if (maxHeight > window.innerHeight) {
      maxHeight = window.innerHeight
    }

    let columnIndices = []
    if (this.props.dateColumnsOnly) {
      columnIndices = this.getDateColumnIndices()
    } else {
      columnIndices = this.getAllStringColumnIndices()
    }

    return (
      <div
        className={isMobile ? 'mobile-string-axis-selector-popover-content' : 'string-axis-selector-popover-content'}
      >
        <CustomScrollbars autoHeight autoHeightMin={minHeight} maxHeight={maxHeight} suppressScrollX>
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
                      colIndex === this.props.scale?.column?.index ? 'active' : ''
                    }`}
                    key={`string-column-select-${i}`}
                    onClick={() => {
                      this.props.closeSelector()
                      this.props.changeStringColumnIndex(colIndex)
                    }}
                  >
                    {this.props.columns?.[colIndex]?.display_name}
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
