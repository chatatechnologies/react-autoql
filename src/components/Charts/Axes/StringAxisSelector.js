import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { isColumnDateType, getNumberOfGroupables } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class StringAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  // Build a quick lookup map from `originalColumns` for index resolution
  getOriginalIndexMap = (originalColumns) => {
    const map = new Map()
    if (!originalColumns) return map
    originalColumns.forEach((oc) => {
      if (oc?.index !== undefined) map.set(String(oc.index), oc.index)
      if (oc?.display_name) map.set(oc.display_name, oc.index)
    })
    return map
  }

  getAllStringColumnIndices = () => {
    const columnsForCheck = this.props.originalColumns ?? this.props.columns
    if (!columnsForCheck?.length) return []

    const columnIndices = []
    // Determine grouped state
    const numGroupables = getNumberOfGroupables(columnsForCheck)
    const isGrouped = !!this.props.isAggregated || numGroupables > 0

    // Build a quick lookup for originalColumns by index or display_name
    const originalIndexMap = new Map()
    if (this.props.originalColumns) {
      this.props.originalColumns.forEach((oc) => {
        if (oc?.index !== undefined) originalIndexMap.set(String(oc.index), oc.index)
        if (oc?.display_name) originalIndexMap.set(oc.display_name, oc.index)
      })
    }

    const numberIndices = this.props.numberColumnIndices ?? []
    const numberIndices2 = this.props.numberColumnIndices2 ?? []

    this.props.columns.forEach((col, i) => {
      if (!col.is_visible) return

      // canonical id may be `col.index` or positional `i`
      const colId = col.index ?? i
      // Resolve original index: prefer matching by canonical index, but fall back to display_name when mismatched
      let originalIndexForCol
      if (col.index === undefined) {
        originalIndexForCol = originalIndexMap.get(col.display_name)
      } else {
        originalIndexForCol = originalIndexMap.get(String(col.index))
        if (originalIndexForCol === undefined && col.display_name) {
          originalIndexForCol = originalIndexMap.get(col.display_name)
        }
      }

      const isOnNumberAxis =
        numberIndices.includes(colId) ||
        numberIndices.includes(i) ||
        (originalIndexForCol !== undefined && numberIndices.includes(originalIndexForCol))

      const isOnSecondNumberAxis =
        this.props.hasSecondAxis &&
        (numberIndices2.includes(colId) ||
          numberIndices2.includes(i) ||
          (originalIndexForCol !== undefined && numberIndices2.includes(originalIndexForCol)))

      const isStringType = Boolean(col.isStringType) || String(col.type || '').toUpperCase() === 'STRING'

      // If grouped, only include groupable (dimension) columns
      if (isGrouped) {
        if (col.groupable) columnIndices.push(i)
        return
      }

      if ((!isOnNumberAxis && !isOnSecondNumberAxis) || isStringType) columnIndices.push(i)
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

    const onSelectHandler =
      this.props.useLegendHandler && this.props.changeLegendColumnIndex
        ? this.props.changeLegendColumnIndex
        : this.props.changeStringColumnIndex

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
              {columnIndices.map((colIndex, i) => (
                <li
                  className={`string-select-list-item ${colIndex === this.props.scale?.column?.index ? 'active' : ''}`}
                  key={`string-column-select-${i}`}
                  onClick={() => {
                    this.props.closeSelector()
                    onSelectHandler?.(colIndex)
                  }}
                >
                  {this.props.columns?.[colIndex]?.display_name}
                </li>
              ))}
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
  chartContainerRef: PropTypes.object,
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
