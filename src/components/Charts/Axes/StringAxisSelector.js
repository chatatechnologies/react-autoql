import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import {
  ColumnTypes,
  DateStringPrecisionTypes,
  PrecisionTypes,
  isColumnDateType,
  isColumnStringType,
} from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Icon } from '../../Icon'

export default class StringAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.state = {
      hoveredColumn: null,
      hoveredMenuItem: null, // hovered menu item id
      tappedColumn: null, // mobile: which column menu is open
      tappedMenuItem: null, // mobile: which menu item is open
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
      { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.MINUTE, label: 'Minute of Hour' },
      // Disable for now because it's too granular and not useful for most use cases
      // { type: ColumnTypes.DATE_STRING, precision: DateStringPrecisionTypes.SECOND, label: 'Second of Minute' },
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
      } else if ((!isOnNumberAxis && !isOnSecondNumberAxis) || (col.groupable && isColumnStringType(col))) {
        // Original logic: include columns not on number axes, or groupable string columns
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
    // small delay to avoid flicker when moving to submenu
    setTimeout(() => {
      this.setState({ hoveredColumn: null, dateBucketMenuPosition: null })
    }, 100)
  }

  handleMenuItemHover = (menuItemType, colIndex) => {
    this.setState({
      hoveredMenuItem: `${colIndex}-${menuItemType}`,
      hoveredColumn: colIndex,
      hoveredSubmenu: colIndex,
    })
  }

  handleMenuItemLeave = () => {
    // small delay to avoid submenu flicker
    setTimeout(() => this.setState({ hoveredMenuItem: null }), 100)
  }

  handleMenuItemTapLeave = () => {
    // close tapped mobile menus
    if (isMobile) {
      this.setState({ tappedColumn: null, tappedMenuItem: null })
    }
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

  handleDateBucketSelect = (colIndex, bucketOption, e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }

    // Apply change and clear menu state; mobile applies immediately
    if (isMobile) {
      this.changeDateColumnBucket(colIndex, bucketOption)
      this.setState(
        {
          hoveredColumn: null,
          hoveredMenuItem: null,
          tappedColumn: null,
          tappedMenuItem: null,
          dateBucketMenuPosition: null,
        },
        () => this.props.closeSelector(),
      )
    } else {
      this.setState(
        {
          hoveredColumn: null,
          hoveredMenuItem: null,
          tappedColumn: null,
          tappedMenuItem: null,
          dateBucketMenuPosition: null,
        },
        () => {
          this.props.closeSelector()
          this.changeDateColumnBucket(colIndex, bucketOption)
        },
      )
    }
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
      (option) => option.precision === currentPrecision && option.type === currentType,
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
                scrollContainer.scrollTop = itemTop - containerHeight / 2 + itemHeight / 2
              }
            }
          }
        }, 0)
      }
    }
  }

  renderMenuItemSubmenu = (element, colIndex, menuItemType, selectedColumnIndex) => {
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

    // Filter options based on menu item type
    const filteredOptions = this.dateBucketOptions.filter((option) => {
      if (menuItemType === 'chronological') {
        return option.type === ColumnTypes.DATE
      } else if (menuItemType === 'cyclical') {
        return option.type === ColumnTypes.DATE_STRING
      }
      return false
    })

    // Only show active state if this is the currently selected column
    const isSelectedColumn = colIndex === selectedColumnIndex

    return (
      <Popover
        id={`string-axis-selector-menu-item-${this.COMPONENT_KEY}`}
        isOpen={
          isMobile
            ? this.state.tappedMenuItem === `${colIndex}-${menuItemType}`
            : this.state.hoveredMenuItem === `${colIndex}-${menuItemType}`
        }
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
                suppressScrollY
                suppressScrollX
              >
                <div
                  className='axis-selector-container date-bucket-submenu'
                  onClick={(e) => {
                    // Stop propagation to prevent clicks from going through overlapping menus
                    e.stopPropagation()
                  }}
                  onMouseEnter={(e) => {
                    this.setState({
                      hoveredMenuItem: `${colIndex}-${menuItemType}`,
                      hoveredColumn: colIndex,
                      hoveredSubmenu: colIndex,
                    })
                    e.stopPropagation()
                  }}
                  onMouseLeave={(e) => {
                    // Only close if we're really leaving the submenu
                    const relatedTarget = e.relatedTarget
                    const isMovingToSubmenu =
                      relatedTarget &&
                      typeof relatedTarget.closest === 'function' &&
                      relatedTarget.closest('.date-bucket-submenu')
                    if (!isMovingToSubmenu) {
                      this.setState({
                        hoveredMenuItem: null,
                      })
                    }
                  }}
                >
                  <ul className='axis-selector-content'>
                    {filteredOptions.map((option, optionIndex) => {
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
                        currentPrecision !== null &&
                        currentType !== null &&
                        currentPrecision === option.precision &&
                        currentType === option.type

                      // Find the original index in dateBucketOptions for ref
                      const originalIndex = this.dateBucketOptions.findIndex(
                        (opt) => opt.precision === option.precision && opt.type === option.type,
                      )

                      return (
                        <li
                          ref={(r) => {
                            if (r) {
                              this.dateBucketMenuRefs[`${colIndex}-${originalIndex}`] = r
                            }
                          }}
                          className={`string-select-list-item ${isActive ? 'active' : ''} ${
                            option.precision === PrecisionTypes.DATE_MINUTE ? 'date-minute-option' : ''
                          }`}
                          key={`${colIndex}-${menuItemType}-${option.precision}`}
                          style={{
                            cursor: 'pointer',
                            userSelect: 'none',
                            pointerEvents: 'auto',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          onTouchStart={(e) => {
                            // Don't prevent default on touchstart to allow normal touch behavior
                          }}
                          onTouchEnd={(e) => {
                            if (isMobile) {
                              e.stopPropagation()
                              e.preventDefault()
                              this.handleDateBucketSelect(colIndex, option, e)
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (!isMobile) {
                              // On desktop, handle click normally
                              this.handleDateBucketSelect(colIndex, option, e)
                            }
                            // On mobile, touchend will handle it
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
        onClickOutside={isMobile ? this.handleMenuItemTapLeave : this.handleMenuItemLeave}
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
        isOpen={isMobile ? this.state.tappedColumn === colIndex : this.state.hoveredColumn === colIndex}
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
                suppressScrollY
                suppressScrollX
              >
                <div
                  className='axis-selector-container date-bucket-submenu'
                  onClick={(e) => {
                    // Stop propagation to prevent clicks from going through overlapping menus
                    e.stopPropagation()
                  }}
                  onMouseEnter={(e) => {
                    this.setState({ hoveredColumn: colIndex, hoveredSubmenu: colIndex })
                    e.stopPropagation()
                  }}
                  onMouseMove={(e) => {
                    // Only handle mouse move on desktop
                    if (!isMobile) {
                      // Check if mouse is over a menu item (Chronological/Cyclical) and open submenu
                      const target = e.target
                      if (target && target.closest) {
                        const listItem = target.closest('li[data-menu-item]')
                        if (listItem) {
                          const menuItemType = listItem.getAttribute('data-menu-item')
                          if (
                            menuItemType === 'chronological' &&
                            this.state.hoveredMenuItem !== `${colIndex}-chronological`
                          ) {
                            this.handleMenuItemHover('chronological', colIndex)
                          } else if (
                            menuItemType === 'cyclical' &&
                            this.state.hoveredMenuItem !== `${colIndex}-cyclical`
                          ) {
                            this.handleMenuItemHover('cyclical', colIndex)
                          }
                        }
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    // Only close if we're really leaving the submenu
                    const relatedTarget = e.relatedTarget
                    // Check if moving to any child of this container (including list items)
                    const container = e.currentTarget
                    const isMovingToChild = relatedTarget && container.contains(relatedTarget)
                    // Check if moving to a menu item submenu
                    const isMovingToSubmenu =
                      relatedTarget &&
                      typeof relatedTarget.closest === 'function' &&
                      relatedTarget.closest('.date-bucket-submenu')
                    // Also check if a menu item submenu is open for this column
                    const hasOpenMenuItemSubmenu =
                      this.state.hoveredMenuItem &&
                      (this.state.hoveredMenuItem.startsWith(`${colIndex}-chronological`) ||
                        this.state.hoveredMenuItem.startsWith(`${colIndex}-cyclical`))
                    if (!isMovingToChild && !isMovingToSubmenu && !hasOpenMenuItemSubmenu) {
                      this.setState({
                        hoveredSubmenu: null,
                      })
                    }
                  }}
                >
                  <ul
                    className='axis-selector-content'
                    onMouseEnter={(e) => {
                      // Keep parent menu open when hovering over list items (desktop only)
                      if (!isMobile) {
                        this.setState({
                          hoveredColumn: colIndex,
                          hoveredSubmenu: colIndex,
                        })
                      }
                    }}
                  >
                    {[
                      (() => {
                        const chronologicalLi = (
                          <li
                            className='string-select-list-item date-column'
                            key={`${colIndex}-chronological`}
                            data-menu-item='chronological'
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isMobile) {
                                // On mobile: toggle the third menu open/closed
                                if (this.state.tappedMenuItem === `${colIndex}-chronological`) {
                                  // If already open, close it
                                  this.setState({
                                    tappedMenuItem: null,
                                  })
                                } else {
                                  // Open the third menu
                                  this.setState({
                                    tappedMenuItem: `${colIndex}-chronological`,
                                  })
                                }
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!isMobile) {
                                e.stopPropagation()
                                this.handleMenuItemHover('chronological', colIndex)
                              }
                            }}
                            onMouseLeave={(e) => {
                              // Only close if we're really leaving (not moving to submenu)
                              const relatedTarget = e.relatedTarget
                              const isMovingToSubmenu =
                                relatedTarget &&
                                typeof relatedTarget.closest === 'function' &&
                                relatedTarget.closest('.date-bucket-submenu')
                              if (!isMovingToSubmenu) {
                                // Clear the hover state when leaving
                                setTimeout(() => {
                                  // Only close if submenu is not open (if it's still set, submenu is open)
                                  if (this.state.hoveredMenuItem !== `${colIndex}-chronological`) {
                                    this.setState({
                                      hoveredMenuItem: null,
                                    })
                                  }
                                }, 150) // Small delay to allow moving to submenu
                              }
                            }}
                          >
                            Chronological
                            <span
                              style={{
                                float: 'right',
                                fontSize: '12px',
                                marginLeft: '10px',
                              }}
                            >
                              <Icon type='caret-right' />
                            </span>
                          </li>
                        )
                        return this.renderMenuItemSubmenu(
                          chronologicalLi,
                          colIndex,
                          'chronological',
                          selectedColumnIndex,
                        )
                      })(),
                      (() => {
                        const cyclicalLi = (
                          <li
                            className='string-select-list-item date-column'
                            key={`${colIndex}-cyclical`}
                            data-menu-item='cyclical'
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isMobile) {
                                // On mobile: toggle the third menu open/closed
                                if (this.state.tappedMenuItem === `${colIndex}-cyclical`) {
                                  // If already open, close it
                                  this.setState({
                                    tappedMenuItem: null,
                                  })
                                } else {
                                  // Open the third menu
                                  this.setState({
                                    tappedMenuItem: `${colIndex}-cyclical`,
                                  })
                                }
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!isMobile) {
                                e.stopPropagation()
                                this.handleMenuItemHover('cyclical', colIndex)
                              }
                            }}
                            onMouseLeave={(e) => {
                              // Only close if we're really leaving (not moving to submenu)
                              const relatedTarget = e.relatedTarget
                              const isMovingToSubmenu =
                                relatedTarget &&
                                typeof relatedTarget.closest === 'function' &&
                                relatedTarget.closest('.date-bucket-submenu')
                              if (!isMovingToSubmenu) {
                                // Clear the hover state when leaving
                                setTimeout(() => {
                                  // Only close if submenu is not open (if it's still set, submenu is open)
                                  if (this.state.hoveredMenuItem !== `${colIndex}-cyclical`) {
                                    this.setState({
                                      hoveredMenuItem: null,
                                    })
                                  }
                                }, 150) // Small delay to allow moving to submenu
                              }
                            }}
                          >
                            Cyclical
                            <span
                              style={{
                                float: 'right',
                                fontSize: '12px',
                                marginLeft: '10px',
                              }}
                            >
                              <Icon type='caret-right' />
                            </span>
                          </li>
                        )
                        return this.renderMenuItemSubmenu(cyclicalLi, colIndex, 'cyclical', selectedColumnIndex)
                      })(),
                    ].map((item, index) => (
                      <React.Fragment key={`${colIndex}-menu-item-${index === 0 ? 'chronological' : 'cyclical'}`}>
                        {item}
                      </React.Fragment>
                    ))}
                  </ul>
                </div>
              </CustomScrollbars>
            </div>
          )
        }}
        onClickOutside={isMobile ? this.handleMenuItemTapLeave : this.handleColumnLeave}
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

    // Don't exclude the legend column - it will be shown in the list
    // When clicked, onChangeStringColumnIndex will swap it with the current string column

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
                  (oc) => oc.index === colIndex || oc.name === column.name || oc.display_name === column.display_name,
                )
                const originalColumnType = originalColumn?.type

                // Show hover menu if:
                // 1. enableCyclicalDates is enabled, AND
                // 2. NOT using pivot data (isAggregated), AND
                // 3. Column is a DATE type (not DATE_STRING) - check original column type or current column type
                const enableCyclicalDates = this.props.enableCyclicalDates !== false // Default to true if not specified
                // Check if column is DATE type (not DATE_STRING)
                const isDateType =
                  originalColumnType === ColumnTypes.DATE ||
                  (column?.type === ColumnTypes.DATE && column?.type !== ColumnTypes.DATE_STRING)
                const isDateColumn = enableCyclicalDates && !this.props.isAggregated && isDateType

                const li = (
                  <li
                    className={`string-select-list-item ${colIndex === origColumn?.index ? 'active' : ''} ${
                      isDateColumn ? 'date-column' : ''
                    }`}
                    key={`string-column-select-${colIndex}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isMobile && isDateColumn) {
                        // On mobile: toggle the menu open/closed
                        if (this.state.tappedColumn === colIndex) {
                          // If already open, close it
                          this.setState({
                            tappedColumn: null,
                            tappedMenuItem: null,
                          })
                        } else {
                          // Open the menu
                          this.setState({
                            tappedColumn: colIndex,
                            tappedMenuItem: null,
                          })
                        }
                      } else {
                        // Desktop: clicking always selects immediately
                        // For date columns, hover menu provides additional options but clicking still works
                        this.props.closeSelector()
                        this.props.changeStringColumnIndex(colIndex)
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isMobile && isDateColumn) {
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
                    {this.props.columns?.[colIndex]?.display_name}
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
