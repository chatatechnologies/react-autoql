import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { ColumnTypes, DateStringPrecisionTypes, isColumnDateType, PrecisionTypes, getNumberOfGroupables } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Icon } from '../../Icon'

export default class StringAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.state = {
      hoveredColumn: null,
    }

    // Define the cyclical bucket options for date columns
    this.dateBucketOptions = [
      { type: ColumnTypes.DATE, precision: PrecisionTypes.YEAR, label: 'Year' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.QUARTER, label: 'Quarter' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.MONTH, label: 'Month' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.WEEK, label: 'Week' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.DAY, label: 'Day' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.DATE_HOUR, label: 'Hour' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.DATE_MINUTE, label: 'Minute' },
      { type: ColumnTypes.DATE, precision: PrecisionTypes.DATE_SECOND, label: 'Second' },
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.QUARTERONLY, label: 'Quarter of Year' },
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.MONTHONLY, label: 'Month of Year' },
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.WEEKONLY, label: 'Week of Year' },
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.DOM, label: 'Day of Month' },
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.DOW, label: 'Day of Week' },
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.HOUR, label: 'Hour of Day' },
    ]
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
    const originalIndexMap = this.getOriginalIndexMap(this.props.originalColumns)

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

  handleColumnHover = (colIndex) => {
    this.setState({
      hoveredColumn: colIndex,
      hoveredSubmenu: null,
    })
  }

  handleColumnLeave = () => {
    // Add a small delay to prevent menu from disappearing when moving to submenu
    setTimeout(() => {
      this.setState({
        hoveredColumn: null,
        dateBucketMenuPosition: null,
      })
    }, 100)
  }

  changeDateColumnBucket = (colIndex, bucketOption) => {
    const { columns } = this.props
    const newColumns = columns.map((col) => {
      if (col.index === colIndex) {
        return {
          ...col,
          type: bucketOption.type,
          precision: bucketOption.precision,
        }
      }
      return col
    })

    this.props.changeStringColumnIndex(colIndex, newColumns)
  }

  handleDateBucketSelect = (colIndex, bucketOption) => {
    this.setState({
      hoveredColumn: null,
      dateBucketMenuPosition: null,
    })

    this.props.closeSelector()

    this.changeDateColumnBucket(colIndex, bucketOption)
  }

  renderDateBucketMenu = (element, colIndex) => {
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

    return (
      <Popover
        id={`string-axis-selector-${this.COMPONENT_KEY}`}
        isOpen={this.state.hoveredColumn === colIndex}
        content={() => {
          return (
            <div
              className={
                isMobile ? 'mobile-string-axis-selector-popover-content' : 'string-axis-selector-popover-content'
              }
            >
              <CustomScrollbars
                autoHeight
                autoHeightMin={minHeight}
                maxHeight={maxHeight}
                options={{ suppressScrollX: true }}
              >
                <div
                  className='axis-selector-container date-bucket-submenu'
                  onMouseEnter={(e) => {
                    this.setState({ hoveredColumn: colIndex, hoveredSubmenu: colIndex })
                    e.stopPropagation()
                  }}
                  onMouseLeave={(e) => {
                    // Only close if we're really leaving the submenu
                    const relatedTarget = e.relatedTarget
                    if (!relatedTarget || !relatedTarget.closest('.date-bucket-submenu')) {
                      this.setState({
                        hoveredSubmenu: null,
                      })
                    }
                  }}
                >
                  <ul className='axis-selector-content'>
                    {this.dateBucketOptions.map((option) => (
                      <li
                        className='string-select-list-item'
                        key={option.precision}
                        onClick={(e) => {
                          e.stopPropagation()
                          this.handleDateBucketSelect(this.state.hoveredColumn, option)
                        }}
                      >
                        {option.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </CustomScrollbars>
            </div>
          )
        }}
        onClickOutside={this.handleColumnLeave}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={['right', 'top', 'bottom', 'left']}
        align='top'
        padding={0}
      >
        {element}
      </Popover>
    )
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
              {columnIndices.map((colIndex, i) => {
                const column = this.props.columns[colIndex]
                const isDateColumn = isColumnDateType(column)

                const li = (
                  <li
                    className={`string-select-list-item ${
                      colIndex === this.props.scale?.column?.index ? 'active' : ''
                    } ${isDateColumn ? 'date-column' : ''}`}
                    key={`string-column-select-${i}`}
                    onClick={() => {
                      if (!isDateColumn) {
                        this.props.closeSelector()
                        this.props.changeStringColumnIndex(colIndex)
                      }
                    }}
                    onMouseEnter={(e) => {
                      this.handleColumnHover(colIndex, e)
                    }}
                    onMouseLeave={() => {
                      // Clear the hover state when leaving
                      if (this.state.hoveredColumn === colIndex) {
                        setTimeout(() => {
                          if (this.state.hoveredSubmenu !== colIndex && this.state.hoveredColumn === colIndex) {
                            this.setState({
                              hoveredColumn: null,
                            })
                          }
                        }, 150) // Small delay to allow moving to submenu
                      }
                    }}
                  >
                    <span>{this.props.columns?.[colIndex]?.display_name}</span>
                    {isDateColumn && (
                      <span
                        style={{
                          float: 'right',
                          fontSize: '12px',
                          marginLeft: '10px',
                        }}
                      >
                        <Icon type='caret-right' />
                      </span>
                    )}
                  </li>
                )

                if (isDateColumn) {
                  return this.renderDateBucketMenu(li, colIndex)
                }

                return li
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
        onClickOutside={() =>
          setTimeout(() => {
            this.props.closeSelector()
          }, 0)
        }
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
