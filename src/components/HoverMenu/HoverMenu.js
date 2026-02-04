import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'

import { Popover } from '../Popover'
import { CustomScrollbars } from '../CustomScrollbars'

import './HoverMenu.scss'

/**
 * A generalized hover menu component with support for nested submenus.
 * 
 * Features:
 * - Shows submenu on hover over menu item
 * - Hides when hovering outside
 * - Keeps parent menus open when hovering in nested submenus
 * - Supports unlimited nesting levels
 * - Standard hover menu UX
 * 
 * @example
 * <HoverMenu
 *   items={[
 *     { label: 'Item 1', value: '1' },
 *     { 
 *       label: 'Item 2', 
 *       value: '2',
 *       submenu: [
 *         { label: 'Sub 2.1', value: '2.1' },
 *         { 
 *           label: 'Sub 2.2', 
 *           value: '2.2',
 *           submenu: [
 *             { label: 'Sub 2.2.1', value: '2.2.1' }
 *           ]
 *         }
 *       ]
 *     }
 *   ]}
 *   onSelect={(item) => console.log(item)}
 *   anchorElement={buttonRef.current}
 * />
 */
export default class HoverMenu extends React.Component {
  static propTypes = {
    // Array of menu items
    items: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.any.isRequired,
        isActive: PropTypes.bool,
        submenu: PropTypes.array, // Recursive: array of items with same shape
        disabled: PropTypes.bool,
      })
    ).isRequired,
    // Callback when an item is selected (only called for items without submenus)
    onSelect: PropTypes.func.isRequired,
    // Element to anchor the menu to
    anchorElement: PropTypes.instanceOf(Element),
    // Whether the menu is open
    isOpen: PropTypes.bool,
    // Callback when menu should open
    onOpen: PropTypes.func,
    // Callback when menu should close
    onClose: PropTypes.func,
    // Parent element for popover positioning
    parentElement: PropTypes.instanceOf(Element),
    // Boundary element for popover positioning
    boundaryElement: PropTypes.instanceOf(Element),
    // Container ref for calculating max height
    containerRef: PropTypes.object,
    // Popover positions
    positions: PropTypes.arrayOf(PropTypes.string),
    // Popover alignment
    align: PropTypes.string,
    // Padding for popover
    padding: PropTypes.number,
    // Max height for scrollable menu
    maxHeight: PropTypes.number,
    // Min height for scrollable menu
    minHeight: PropTypes.number,
    // Custom class names
    className: PropTypes.string,
    itemClassName: PropTypes.string,
    activeItemClassName: PropTypes.string,
    listClassName: PropTypes.string, // Class name for the <ul> element
    popoverContentClassName: PropTypes.string, // Class name for the popover content wrapper
    mobilePopoverContentClassName: PropTypes.string, // Class name for mobile popover content wrapper
    // Custom render function for items
    renderItem: PropTypes.func,
    // Custom render function for submenu indicator
    renderSubmenuIndicator: PropTypes.func,
  }

  static defaultProps = {
    isOpen: false,
    onOpen: () => {},
    onClose: () => {},
    anchorElement: null,
    parentElement: null,
    boundaryElement: null,
    containerRef: null,
    positions: ['right', 'top', 'bottom', 'left'],
    align: 'top',
    padding: 2,
    maxHeight: 300,
    minHeight: 35,
    className: 'hover-menu-container',
    itemClassName: 'hover-menu-item',
    activeItemClassName: 'active',
    listClassName: 'hover-menu-list',
    popoverContentClassName: 'hover-menu-popover-content',
    mobilePopoverContentClassName: 'mobile-hover-menu-popover-content',
    renderItem: null,
    renderSubmenuIndicator: null,
  }

  constructor(props) {
    super(props)
    this.state = {
      hoveredItemPath: [], // Array of indices representing the path to the currently hovered item
    }
    this.closeTimeout = null
    this.menuRefs = {} // Store refs for menu items by their path
  }

  componentWillUnmount() {
    this.clearCloseTimeout()
  }

  clearCloseTimeout = () => {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout)
      this.closeTimeout = null
    }
  }

  // Get the hovered item path for a specific menu level
  getHoveredPathForLevel = (level) => {
    return this.state.hoveredItemPath.slice(0, level + 1)
  }

  // Check if an item path is currently hovered
  isItemHovered = (itemPath) => {
    if (!itemPath || itemPath.length === 0) {
      return false
    }
    if (this.state.hoveredItemPath.length === 0) {
      return false
    }
    const pathStr = itemPath.join('-')
    const hoveredStr = this.state.hoveredItemPath.join('-')
    // Check if hovered path starts with this path (meaning we're hovering over this item or its children)
    // For example, if itemPath is [0] and hoveredItemPath is [0, 1], then "0-1".startsWith("0") is true
    return hoveredStr.startsWith(pathStr)
  }

  // Handle mouse enter on a menu item
  handleItemMouseEnter = (itemPath, e) => {
    this.clearCloseTimeout()
    this.setState({ hoveredItemPath: itemPath })
    e.stopPropagation()
  }

  // Handle mouse leave on a menu item
  handleItemMouseLeave = (itemPath, e) => {
    const relatedTarget = e.relatedTarget
    
    // Check if mouse is moving to a submenu
    const isMovingToSubmenu = relatedTarget?.closest?.('.hover-menu-container') ||
                              relatedTarget?.closest?.('.hover-menu-item') ||
                              relatedTarget?.closest?.('.react-tiny-popover-container')
    
    if (!isMovingToSubmenu) {
      // Add delay before closing to allow smooth mouse movement
      this.closeTimeout = setTimeout(() => {
        // Only clear if we're still not hovering over any menu
        if (!document.querySelector('.hover-menu-container:hover')) {
          this.setState({ hoveredItemPath: [] })
        }
        this.closeTimeout = null
      }, 200)
    }
  }

  // Handle mouse enter on menu container
  handleContainerMouseEnter = (e) => {
    this.clearCloseTimeout()
    e.stopPropagation()
  }

  // Handle mouse leave on menu container
  handleContainerMouseLeave = (e) => {
    const relatedTarget = e.relatedTarget
    
    // Check if mouse is moving to another menu element
    const isMovingToMenu = relatedTarget?.closest?.('.hover-menu-container') ||
                           relatedTarget?.closest?.('.hover-menu-item') ||
                           relatedTarget?.closest?.('.react-tiny-popover-container')
    
    if (!isMovingToMenu) {
      this.closeTimeout = setTimeout(() => {
        if (!document.querySelector('.hover-menu-container:hover')) {
          this.setState({ hoveredItemPath: [] })
        }
        this.closeTimeout = null
      }, 200)
    }
  }

  // Calculate max height for scrollable menu
  calculateMaxHeight = () => {
    const { maxHeight, minHeight, containerRef } = this.props
    const padding = 50
    
    let calculatedMaxHeight = maxHeight
    
    if (containerRef?.clientHeight) {
      const containerHeight = containerRef.clientHeight
      if (containerHeight > minHeight + padding) {
        calculatedMaxHeight = containerHeight - padding
      } else if (containerHeight < minHeight + padding) {
        calculatedMaxHeight = minHeight
      }
    }
    
    if (calculatedMaxHeight > window.innerHeight) {
      calculatedMaxHeight = window.innerHeight
    }
    
    return calculatedMaxHeight
  }

  // Get content location for popover positioning
  getContentLocation = () => {
    const { anchorElement, padding } = this.props
    
    if (!anchorElement || !anchorElement.getBoundingClientRect) {
      return undefined
    }
    
    try {
      const anchorRect = anchorElement.getBoundingClientRect()
      if (!anchorRect || anchorRect.width === 0 || anchorRect.height === 0) {
        return undefined
      }
      
      return (params) => {
        return {
          top: anchorRect.top,
          left: anchorRect.right + padding,
          childRect: params.childRect,
          popoverRect: params.popoverRect,
          position: 'right',
        }
      }
    } catch (error) {
      return undefined
    }
  }

  // Render a submenu recursively
  renderSubmenu = (items, parentPath, level = 0) => {
    const { 
      onSelect, 
      parentElement, 
      boundaryElement, 
      containerRef,
      positions,
      align,
      padding,
      minHeight,
      className,
      itemClassName,
      activeItemClassName,
      listClassName,
      popoverContentClassName,
      mobilePopoverContentClassName,
      renderItem,
      renderSubmenuIndicator,
    } = this.props

    if (!items || items.length === 0) {
      return null
    }

    // Check if this submenu should be open (if the parent item is hovered)
    // The parentPath represents the path to the parent menu item that has this submenu
    // For example, if parentPath is [0], it means we're checking if item at index 0 is hovered
    const isOpen = this.isItemHovered(parentPath)
    
    if (!isOpen || !items || items.length === 0) {
      return null
    }

    // Get the anchor element (the parent menu item)
    // parentPath is the path to the item that has this submenu, so we use it directly as the anchor key
    const anchorKey = parentPath.join('-')
    const anchorElement = this.menuRefs[anchorKey]

    const maxHeight = this.calculateMaxHeight()
    const contentLocation = this.getContentLocationForSubmenu(anchorElement, padding)

    return (
      <Popover
        key={`submenu-${parentPath.join('-')}`}
        isOpen={isOpen}
        contentLocation={contentLocation}
        content={() => {
          return (
            <div
              className={
                isMobile ? mobilePopoverContentClassName : popoverContentClassName
              }
            >
              <CustomScrollbars
                autoHeight
                autoHeightMin={minHeight}
                maxHeight={maxHeight}
                options={{ suppressScrollX: true }}
              >
                <div
                  className={`${className} hover-menu-submenu`}
                  onMouseEnter={this.handleContainerMouseEnter}
                  onMouseLeave={this.handleContainerMouseLeave}
                >
                  <ul className={listClassName}>
                    {items.map((item, index) => {
                      const itemPath = [...parentPath, index]
                      const itemKey = itemPath.join('-')
                      const hasSubmenu = item.submenu && item.submenu.length > 0
                      const isActive = item.isActive || false
                      const isHovered = this.isItemHovered(itemPath)

                      return (
                        <li
                          key={itemKey}
                          ref={(el) => {
                            if (el) {
                              this.menuRefs[itemKey] = el
                            }
                          }}
                          className={`${itemClassName} ${isActive ? activeItemClassName : ''} ${hasSubmenu ? 'has-submenu' : ''} ${isHovered ? 'hovered' : ''}`}
                          onMouseEnter={(e) => this.handleItemMouseEnter(itemPath, e)}
                          onMouseLeave={(e) => this.handleItemMouseLeave(itemPath, e)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!hasSubmenu && !item.disabled) {
                              onSelect(item)
                            }
                          }}
                        >
                          {renderItem ? renderItem(item, itemPath, level) : item.label}
                          {hasSubmenu && (
                            renderSubmenuIndicator ? 
                              renderSubmenuIndicator(item, itemPath, level) :
                              <span
                                style={{
                                  float: 'right',
                                  fontSize: '12px',
                                  marginLeft: '10px',
                                }}
                                aria-hidden="true"
                              >
                                ▶
                              </span>
                          )}
                          {/* Recursively render nested submenu */}
                          {hasSubmenu && this.renderSubmenu(item.submenu, itemPath, level + 1)}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </CustomScrollbars>
            </div>
          )
        }}
        onClickOutside={() => {
          this.setState({ hoveredItemPath: [] })
        }}
        parentElement={parentElement}
        boundaryElement={boundaryElement}
        positions={positions}
        align={align}
        padding={padding}
      >
        <span style={{ display: 'none' }} />
      </Popover>
    )
  }

  // Get content location for submenu positioning
  getContentLocationForSubmenu = (anchorElement, padding) => {
    if (!anchorElement || !anchorElement.getBoundingClientRect) {
      return undefined
    }
    
    try {
      const anchorRect = anchorElement.getBoundingClientRect()
      if (!anchorRect || anchorRect.width === 0 || anchorRect.height === 0) {
        return undefined
      }
      
      return (params) => {
        return {
          top: anchorRect.top,
          left: anchorRect.right + padding,
          childRect: params.childRect,
          popoverRect: params.popoverRect,
          position: 'right',
        }
      }
    } catch (error) {
      return undefined
    }
  }

  render() {
    const {
      items,
      onSelect,
      isOpen,
      onOpen,
      onClose,
      anchorElement,
      parentElement,
      boundaryElement,
      positions,
      align,
      padding,
      minHeight,
      className,
      itemClassName,
      activeItemClassName,
      renderItem,
      renderSubmenuIndicator,
    } = this.props

    const maxHeight = this.calculateMaxHeight()
    const contentLocation = this.getContentLocation()

    // Always render children, but only show popover menu when isOpen is true
    return (
      <Popover
        isOpen={isOpen && items.length > 0}
        contentLocation={contentLocation}
        content={() => {
          return (
            <div
              className={
                isMobile ? mobilePopoverContentClassName : popoverContentClassName
              }
            >
              <CustomScrollbars
                autoHeight
                autoHeightMin={minHeight}
                maxHeight={maxHeight}
                options={{ suppressScrollX: true }}
              >
                <div
                  className={className}
                  onMouseEnter={this.handleContainerMouseEnter}
                  onMouseLeave={this.handleContainerMouseLeave}
                >
                  <ul className={listClassName}>
                    {items.map((item, index) => {
                      const itemPath = [index]
                      const itemKey = itemPath.join('-')
                      const hasSubmenu = item.submenu && item.submenu.length > 0
                      const isActive = item.isActive || false
                      const isHovered = this.isItemHovered(itemPath)

                      return (
                        <li
                          key={itemKey}
                          ref={(el) => {
                            if (el) {
                              this.menuRefs[itemKey] = el
                            }
                          }}
                          className={`${itemClassName} ${isActive ? activeItemClassName : ''} ${hasSubmenu ? 'has-submenu' : ''} ${isHovered ? 'hovered' : ''}`}
                          onMouseEnter={(e) => this.handleItemMouseEnter(itemPath, e)}
                          onMouseLeave={(e) => this.handleItemMouseLeave(itemPath, e)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!hasSubmenu && !item.disabled) {
                              onSelect(item)
                            }
                          }}
                        >
                          {renderItem ? renderItem(item, itemPath, 0) : item.label}
                          {hasSubmenu && (
                            renderSubmenuIndicator ? 
                              renderSubmenuIndicator(item, itemPath, 0) :
                              <span
                                style={{
                                  float: 'right',
                                  fontSize: '12px',
                                  marginLeft: '10px',
                                }}
                                aria-hidden="true"
                              >
                                ▶
                              </span>
                          )}
                          {/* Recursively render nested submenu */}
                          {hasSubmenu && this.renderSubmenu(item.submenu, itemPath, 1)}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </CustomScrollbars>
            </div>
          )
        }}
        onClickOutside={() => {
          this.setState({ hoveredItemPath: [] })
          onClose()
        }}
        parentElement={parentElement}
        boundaryElement={boundaryElement}
        positions={positions}
        align={align}
        padding={padding}
      >
        {this.props.children || <span style={{ display: 'none' }} />}
      </Popover>
    )
  }
}
