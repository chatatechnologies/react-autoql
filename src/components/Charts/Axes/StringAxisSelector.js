import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { ColumnTypes, DateStringPrecisionTypes, PrecisionTypes, isColumnDateType, isColumnStringType } from 'autoql-fe-utils'

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
    this.dateBucketMenuRefs = {} // Store refs for date bucket menu items
    this.dateBucketScrollbarRef = null // Ref for the scrollbar container
    this.scrolledToActiveColumn = null // Track which column we've scrolled to

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
        if ((!isOnNumberAxis && !isOnSecondNumberAxis) || (col.groupable && isColumnStringType(col))) {
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

  componentDidUpdate = (prevProps, prevState) => {
    // Scroll to active item when menu opens for a column
    if (this.state.hoveredColumn !== null && this.state.hoveredColumn !== this.scrolledToActiveColumn) {
      setTimeout(() => {
        this.scrollToActiveItem(this.state.hoveredColumn)
        this.scrolledToActiveColumn = this.state.hoveredColumn
      }, 50) // Small delay to ensure DOM is rendered
    } else if (this.state.hoveredColumn === null) {
      // Reset scroll tracking when menu closes
      this.scrolledToActiveColumn = null
    }
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

  scrollToActiveItem = (colIndex) => {
    // Find the active item and scroll to it
    const column = this.props.columns[colIndex]
    const columnOverrides = this.props.columnOverrides || {}
    const override = columnOverrides[colIndex]
    
    const currentPrecision = override?.precision || column?.precision
    const currentType = override?.type || column?.type
    
    // Find the index of the active option
    const activeOptionIndex = this.dateBucketOptions.findIndex(
      (option) => option.precision === currentPrecision && option.type === currentType
    )
    
    if (activeOptionIndex >= 0) {
      const activeItemRef = this.dateBucketMenuRefs[`${colIndex}-${activeOptionIndex}`]
      if (activeItemRef && this.dateBucketScrollbarRef) {
        // Use setTimeout to ensure the DOM is rendered
        setTimeout(() => {
          if (activeItemRef && this.dateBucketScrollbarRef?.ref?._container) {
            const scrollContainer = this.dateBucketScrollbarRef.ref._container
            if (scrollContainer && activeItemRef) {
              const itemTop = activeItemRef.offsetTop
              const itemHeight = activeItemRef.offsetHeight
              const containerHeight = scrollContainer.clientHeight
              const scrollTop = scrollContainer.scrollTop
              
              // Check if item is not visible
              if (itemTop < scrollTop || itemTop + itemHeight > scrollTop + containerHeight) {
                // Scroll to center the item
                scrollContainer.scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2)
              }
            }
          }
        }, 0)
      }
    }
  }

  renderDateBucketMenu = (element, colIndex, selectedColumnIndex) => {
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

    // Only show active state if this is the currently selected column
    const isSelectedColumn = colIndex === selectedColumnIndex

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
                ref={(r) => {
                  this.dateBucketScrollbarRef = r
                }}
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
                    {/* Absolute date options (DATE type) */}
                    <li key={`${colIndex}-absolute-header`} className='axis-selector-header'>Absolute</li>
                    {this.dateBucketOptions
                      .filter((option) => option.type === ColumnTypes.DATE)
                      .map((option, optionIndex) => {
                        // Check if this option is the active one
                        const column = this.props.columns[colIndex]
                        const columnOverrides = this.props.columnOverrides || {}
                        const override = columnOverrides[colIndex]
                        
                        // Determine current precision: use override if exists, otherwise use column's precision
                        const currentPrecision = override?.precision || column?.precision
                        const currentType = override?.type || column?.type
                        
                        // Only show as active if this is the selected column AND the precision/type matches
                        const isActive = 
                          isSelectedColumn &&
                          currentPrecision === option.precision && 
                          currentType === option.type
                        
                        // Find the original index in dateBucketOptions for ref
                        const originalIndex = this.dateBucketOptions.findIndex(
                          (opt) => opt.precision === option.precision && opt.type === option.type
                        )
                        
                        return (
                          <li
                            ref={(r) => {
                              if (r) {
                                this.dateBucketMenuRefs[`${colIndex}-${originalIndex}`] = r
                              }
                            }}
                            className={`string-select-list-item ${isActive ? 'active' : ''} ${option.precision === PrecisionTypes.DATE_MINUTE ? 'date-minute-option' : ''}`}
                            key={`${colIndex}-absolute-${option.precision}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              this.handleDateBucketSelect(this.state.hoveredColumn, option)
                            }}
                          >
                            {option.label}
                          </li>
                        )
                      })}
                    
                    {/* Cyclical date options (DATE_STRING type) */}
                    <li key={`${colIndex}-cyclical-header`} className='axis-selector-header'>Cyclical</li>
                    {this.dateBucketOptions
                      .filter((option) => option.type === ColumnTypes.DATE_STRING)
                      .map((option, optionIndex) => {
                      // Check if this option is the active one
                      const column = this.props.columns[colIndex]
                      const columnOverrides = this.props.columnOverrides || {}
                      const override = columnOverrides[colIndex]
                      
                      // Determine current precision: use override if exists, otherwise use column's precision
                      const currentPrecision = override?.precision || column?.precision
                      const currentType = override?.type || column?.type
                      
                        // Only show as active if this is the selected column AND the precision/type matches
                      const isActive = 
                          isSelectedColumn &&
                        currentPrecision === option.precision && 
                        currentType === option.type
                      
                        // Find the original index in dateBucketOptions for ref
                        const originalIndex = this.dateBucketOptions.findIndex(
                          (opt) => opt.precision === option.precision && opt.type === option.type
                        )
                        
                      return (
                        <li
                          ref={(r) => {
                            if (r) {
                                this.dateBucketMenuRefs[`${colIndex}-${originalIndex}`] = r
                            }
                          }}
                          className={`string-select-list-item ${isActive ? 'active' : ''}`}
                            key={`${colIndex}-cyclical-${option.precision}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            this.handleDateBucketSelect(this.state.hoveredColumn, option)
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
                const column = this.props.columns[colIndex]
                
                // Check if there's a column override for this column (meaning it was changed on FE)
                const columnOverrides = this.props.columnOverrides || {}
                const hasColumnOverride = columnOverrides[colIndex] !== undefined
                
                // Find the original column to check its type
                const originalColumn = this.props.originalColumns?.find(
                  (oc) => oc.index === colIndex || oc.name === column.name || oc.display_name === column.display_name
                )
                const originalColumnType = originalColumn?.type
                
                // Show menu if:
                // 1. enableCyclicalDates is enabled, AND
                // 2. (There's a column override (was changed on FE), OR the original column type is DATE (not DATE_STRING))
                const enableCyclicalDates = this.props.enableCyclicalDates !== false // Default to true if not specified
                const isDateColumn = 
                  enableCyclicalDates && 
                  (hasColumnOverride || originalColumnType === ColumnTypes.DATE)

                const li = (
                  <li
                    className={`string-select-list-item ${
                      colIndex === origColumn?.index ? 'active' : ''
                    } ${isDateColumn ? 'date-column' : ''}`}
                    key={`string-column-select-${i}`}
                    onClick={() => {
                      // If it's not a date column, or if cyclical dates are disabled, select immediately
                      if (!isDateColumn || !enableCyclicalDates) {
                        this.props.closeSelector()
                        this.props.changeStringColumnIndex(colIndex)
                      }
                      // If it's a date column with cyclical dates enabled, the hover menu will show (no action needed here)
                    }}
                    onMouseEnter={(e) => {
                      if (isDateColumn) {
                        this.handleColumnHover(colIndex, e)
                      }
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
                  return this.renderDateBucketMenu(li, colIndex, origColumn?.index)
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
  columnOverrides: PropTypes.object,
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
