import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { PrecisionTypes } from 'autoql-fe-utils'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export default class DateBucketHoverMenu extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        precision: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
      })
    ).isRequired,
    activePrecision: PropTypes.string,
    activeType: PropTypes.string,
    onSelect: PropTypes.func.isRequired,
    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onClickOutside: PropTypes.func,
    parentElement: PropTypes.instanceOf(Element),
    boundaryElement: PropTypes.instanceOf(Element),
    chartContainerRef: PropTypes.object,
    menuRefs: PropTypes.object,
    colIndex: PropTypes.number,
    selectedColumnIndex: PropTypes.number,
    allDateBucketOptions: PropTypes.array, // Full array to find original index
    anchorElement: PropTypes.instanceOf(Element), // The list item element to anchor to
  }

  static defaultProps = {
    activePrecision: null,
    activeType: null,
    onMouseEnter: () => {},
    onMouseLeave: () => {},
    onClickOutside: () => {},
    parentElement: null,
    boundaryElement: null,
    chartContainerRef: null,
    menuRefs: {},
    colIndex: null,
    selectedColumnIndex: null,
    allDateBucketOptions: [],
    anchorElement: null,
  }

  constructor(props) {
    super(props)
    this.closeTimeout = null
  }

  componentWillUnmount() {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout)
    }
  }

  render = () => {
    const {
      isOpen,
      options,
      activePrecision,
      activeType,
      onSelect,
      onMouseEnter,
      onMouseLeave,
      onClickOutside,
      parentElement,
      boundaryElement,
      chartContainerRef,
      menuRefs,
      colIndex,
      selectedColumnIndex,
      allDateBucketOptions,
      anchorElement,
    } = this.props

    if (!isOpen || !options.length) {
      return null
    }

    // Clear any pending close timeout when opening
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout)
      this.closeTimeout = null
    }

    let maxHeight = 300
    const minHeight = 35
    const padding = 50

    const chartHeight = chartContainerRef?.clientHeight
    if (chartHeight && chartHeight > minHeight + padding) {
      maxHeight = chartHeight - padding
    } else if (chartHeight && chartHeight < minHeight + padding) {
      maxHeight = minHeight
    }

    if (maxHeight > window.innerHeight) {
      maxHeight = window.innerHeight
    }

    const isSelectedColumn = colIndex !== null && selectedColumnIndex !== null && colIndex === selectedColumnIndex

    // Create contentLocation function to position submenu next to anchor element
    // Use requestAnimationFrame to ensure anchor element is laid out
    const getContentLocation = anchorElement
      ? (params) => {
          try {
            if (!anchorElement || !anchorElement.getBoundingClientRect) {
              // Fallback to default positioning if anchor isn't ready
              return params.childRect
            }
            const anchorRect = anchorElement.getBoundingClientRect()
            if (!anchorRect || anchorRect.width === 0 || anchorRect.height === 0) {
              // Anchor element not yet laid out, use default
              // Try again on next frame if we have a valid anchor
              if (anchorElement) {
                requestAnimationFrame(() => {
                  // This will trigger a re-position on next render
                })
              }
              return params.childRect
            }
            return {
              top: anchorRect.top,
              left: anchorRect.right + 2, // 2px gap between menu and submenu
              childRect: params.childRect,
              popoverRect: params.popoverRect,
              position: 'right',
            }
          } catch (error) {
            // Fallback if there's any error getting the anchor position
            return params.childRect
          }
        }
      : undefined

    return (
      <Popover
        isOpen={isOpen}
        contentLocation={getContentLocation}
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
                    // Clear any pending close when entering submenu
                    if (this.closeTimeout) {
                      clearTimeout(this.closeTimeout)
                      this.closeTimeout = null
                    }
                    onMouseEnter(e)
                  }}
                  onMouseLeave={(e) => {
                    // Add delay before closing to allow smooth mouse movement
                    const relatedTarget = e.relatedTarget
                    // Check if mouse is moving to anchor element or another menu item
                    const isMovingToAnchor = anchorElement && (
                      relatedTarget === anchorElement || 
                      (relatedTarget && anchorElement.contains(relatedTarget))
                    )
                    const isMovingToMenu = relatedTarget?.closest?.('.date-bucket-submenu') ||
                                           relatedTarget?.closest?.('.date-bucket-parent')
                    
                    if (!isMovingToAnchor && !isMovingToMenu) {
                      // Only close if truly leaving the menu area
                      this.closeTimeout = setTimeout(() => {
                        onMouseLeave(e)
                      }, 200) // Small delay for smooth transitions
                    }
                  }}
                >
                  <ul className='axis-selector-content'>
                    {options.map((option, index) => {
                      const isActive =
                        isSelectedColumn &&
                        activePrecision === option.precision &&
                        activeType === option.type

                      // Find the original index in allDateBucketOptions for ref
                      const originalIndex = allDateBucketOptions.findIndex(
                        (opt) => opt.precision === option.precision && opt.type === option.type
                      )

                      return (
                        <li
                          ref={(r) => {
                            if (r && menuRefs && colIndex !== null && originalIndex >= 0) {
                              menuRefs[`${colIndex}-${originalIndex}`] = r
                            }
                          }}
                          className={`string-select-list-item ${isActive ? 'active' : ''} ${option.precision === PrecisionTypes.DATE_MINUTE ? 'date-minute-option' : ''}`}
                          key={`${colIndex}-${option.precision}-${index}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(option)
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
        onClickOutside={(e) => {
          // Don't close if clicking on anchor element
          if (anchorElement && (e.target === anchorElement || anchorElement.contains(e.target))) {
            return
          }
          onClickOutside(e)
        }}
        parentElement={parentElement}
        boundaryElement={boundaryElement}
        positions={['right', 'top', 'bottom', 'left']}
        align='top'
        padding={2} // Small padding to prevent gap between menu and submenu
      >
        {this.props.children || <span style={{ display: 'none' }} />}
      </Popover>
    )
  }
}
