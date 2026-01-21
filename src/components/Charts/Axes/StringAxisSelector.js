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

  resolveOriginalColumnIndex = (col, positionalIndex, originalIndexMap) => {
    if (!originalIndexMap?.size) return undefined
    if (col.index === undefined) {
      return originalIndexMap.get(col.display_name)
    }

    let resolved = originalIndexMap.get(String(col.index))
    if (resolved === undefined && col.display_name) {
      resolved = originalIndexMap.get(col.display_name)
    }
    return resolved
  }

  isColumnOnAnyNumberAxis = (colId, positionalIndex, originalIndex, numberIndices, numberIndices2, hasSecondAxis) => {
    const checkIndices = (indices) =>
      indices.includes(colId) ||
      indices.includes(positionalIndex) ||
      (originalIndex !== undefined && indices.includes(originalIndex))

    const onPrimary = checkIndices(numberIndices)
    const onSecondary = hasSecondAxis && checkIndices(numberIndices2)

    return { onPrimary, onSecondary, onAny: onPrimary || onSecondary }
  }

  getAllStringColumnIndices = () => {
    const columnsForCheck = this.props.originalColumns ?? this.props.columns
    if (!columnsForCheck?.length) return []

    const columnIndices = []
    const numGroupables = getNumberOfGroupables(columnsForCheck)
    const isGrouped = !!this.props.isAggregated || numGroupables > 0

    const originalIndexMap = this.getOriginalIndexMap(this.props.originalColumns)
    const numberIndices = this.props.numberColumnIndices ?? []
    const numberIndices2 = this.props.numberColumnIndices2 ?? []

    this.props.columns.forEach((col, i) => {
      if (!col.is_visible) return

      if (isGrouped) {
        if (col.groupable) columnIndices.push(i)
        return
      }

      const colId = col.index ?? i
      const originalIndexForCol = this.resolveOriginalColumnIndex(col, i, originalIndexMap)
      const { onAny } = this.isColumnOnAnyNumberAxis(
        colId,
        i,
        originalIndexForCol,
        numberIndices,
        numberIndices2,
        this.props.hasSecondAxis,
      )

      const isStringType = Boolean(col.isStringType) || String(col.type || '').toUpperCase() === 'STRING'

      if (!onAny || isStringType) {
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
