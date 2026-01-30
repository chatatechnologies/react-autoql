import React from 'react'
import PropTypes from 'prop-types'
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
    this.props.columns.forEach((col, i) => {
      if (!col.is_visible) {
        return
      }

      const isOnNumberAxis = this.props.numberColumnIndices?.includes(col.index)
      const isOnSecondNumberAxis = this.props.hasSecondAxis && this.props.numberColumnIndices2?.includes(col.index)

      // If using pivot data (isAggregated), only include groupable string columns
      if (this.props.isAggregated) {
        if (col.groupable && isColumnStringType(col)) {
          columnIndices.push(i)
        }
      } else {
        // Original logic: include columns not on number axes, or groupable string columns
        if ((!isOnNumberAxis && !isOnSecondNumberAxis) || (col.groupable && (col.type === 'STRING'))) {
          columnIndices.push(i)
        }
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

    if (maxHeight > window.innerHeight) {
      maxHeight = window.innerHeight
    }

    let columnIndices = []
    if (this.props.dateColumnsOnly) {
      columnIndices = this.getDateColumnIndices()
    } else {
      columnIndices = this.getAllStringColumnIndices()
    }

    const origColumn = this.props.scale?.column?.origColumn ?? this.props.scale?.column

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
                      colIndex === origColumn?.index ? 'active' : ''
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

StringAxisSelector.propTypes = {
  columns: PropTypes.array,
  originalColumns: PropTypes.array,
  numberColumnIndices: PropTypes.array,
  numberColumnIndices2: PropTypes.array,
  hasSecondAxis: PropTypes.bool,
  isAggregated: PropTypes.bool,
  dateColumnsOnly: PropTypes.bool,
  chartContainerRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  hidden: PropTypes.bool,
  useLegendHandler: PropTypes.bool,
  changeLegendColumnIndex: PropTypes.func,
  changeStringColumnIndex: PropTypes.func,
  closeSelector: PropTypes.func,
  scale: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  axisSelectorRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  isOpen: PropTypes.bool,
  popoverParentElement: PropTypes.object,
  positions: PropTypes.array,
  align: PropTypes.string,
  children: PropTypes.node,
}

StringAxisSelector.defaultProps = {
  isAggregated: false,
}
