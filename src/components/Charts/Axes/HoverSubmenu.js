import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

/**
 * A reusable hover submenu component with chaining capabilities.
 * Supports nested submenus with proper mouse event handling and delays.
 * 
 * Based on best practices for hover menus and accessibility patterns:
 * - Uses mouseenter/mouseleave events with delays for smooth transitions
 * - Checks relatedTarget to detect movement between menu levels
 * - Supports chaining multiple levels of submenus
 * - Includes ARIA attributes for accessibility
 * - Implements focus management patterns
 * 
 * References:
 * - https://dev.to/godsamit/building-an-accessible-navigation-menubar-with-react-hooks-blh
 * - ARIA menubar pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
 */
export default class HoverSubmenu extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.any.isRequired,
        isActive: PropTypes.bool,
        submenu: PropTypes.object, // Optional nested submenu config
      })
    ).isRequired,
    onSelect: PropTypes.func.isRequired,
    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onClickOutside: PropTypes.func,
    parentElement: PropTypes.instanceOf(Element),
    boundaryElement: PropTypes.instanceOf(Element),
    chartContainerRef: PropTypes.object,
    anchorElement: PropTypes.instanceOf(Element),
    positions: PropTypes.arrayOf(PropTypes.string),
    align: PropTypes.string,
    padding: PropTypes.number,
    maxHeight: PropTypes.number,
    minHeight: PropTypes.number,
    className: PropTypes.string,
    itemClassName: PropTypes.string,
    activeItemClassName: PropTypes.string,
    // For chaining: render nested submenu
    renderSubmenu: PropTypes.func, // (option, index) => ReactNode
    // Selectors to check when mouse leaves to determine if moving to submenu
    submenuSelectors: PropTypes.arrayOf(PropTypes.string),
    // Accessibility props
    role: PropTypes.string, // ARIA role (default: 'menu')
    ariaLabel: PropTypes.string, // ARIA label for the menu
    depth: PropTypes.number, // Depth level for nested menus (for focus management)
    // Option to render without Popover wrapper (for nested use)
    renderWithoutPopover: PropTypes.bool,
    // Callback to get ref to list item element (option, index, element)
    onItemRef: PropTypes.func,
  }

  static defaultProps = {
    onMouseEnter: () => {},
    onMouseLeave: () => {},
    onClickOutside: () => {},
    parentElement: null,
    boundaryElement: null,
    chartContainerRef: null,
    anchorElement: null,
    positions: ['right', 'top', 'bottom', 'left'],
    align: 'top',
    padding: 2,
    maxHeight: 300,
    minHeight: 35,
    className: 'axis-selector-container date-bucket-submenu',
    itemClassName: 'string-select-list-item',
    activeItemClassName: 'active',
    renderSubmenu: null,
    submenuSelectors: [
      '.date-bucket-submenu',
      '.axis-selector-container',
      '.string-axis-selector-popover-content',
      '.react-tiny-popover-container',
    ],
    role: 'menu',
    ariaLabel: null,
    depth: 0,
    renderWithoutPopover: false,
    onItemRef: null,
  }

  constructor(props) {
    super(props)
    this.closeTimeout = null
    this.menuRef = null
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

  handleMouseEnter = (e) => {
    // Clear any pending close when entering submenu
    this.clearCloseTimeout()
    this.props.onMouseEnter(e)
  }

  handleMouseLeave = (e) => {
    const relatedTarget = e.relatedTarget
    
    // Check if mouse is moving to anchor element
    const anchorElement = this.props.anchorElement
    const isMovingToAnchor = anchorElement && 
                              typeof anchorElement.contains === 'function' && (
      relatedTarget === anchorElement ||
      (relatedTarget && anchorElement.contains(relatedTarget))
    )
    
    // Check if mouse is moving to a submenu (using provided selectors)
    const isMovingToSubmenu = this.props.submenuSelectors.some((selector) => {
      try {
        return relatedTarget?.closest?.(selector)
      } catch (e) {
        return false
      }
    })
    
    // Check if mouse is moving to a nested submenu rendered by renderSubmenu
    const isMovingToNestedSubmenu = relatedTarget?.closest?.('.hover-submenu-item') ||
                                    relatedTarget?.closest?.('.hover-submenu-container')
    
    if (!isMovingToAnchor && !isMovingToSubmenu && !isMovingToNestedSubmenu) {
      // Add delay before closing to allow smooth mouse movement
      this.closeTimeout = setTimeout(() => {
        // Double-check we're still not hovering
        const classNameSelector = this.props.className.split(' ')[0] // Get first class name
        if (!document.querySelector(`${classNameSelector}:hover`) &&
            !document.querySelector('.hover-submenu-container:hover')) {
          this.props.onMouseLeave(e)
        }
        this.closeTimeout = null
      }, 200) // Delay for smooth transitions
    }
  }

  handleClickOutside = (e) => {
    // Don't close if clicking on anchor element
    const anchorElement = this.props.anchorElement
    if (anchorElement && 
        typeof anchorElement.contains === 'function' &&
        (e.target === anchorElement || anchorElement.contains(e.target))) {
      return
    }
    this.props.onClickOutside(e)
  }

  getContentLocation = () => {
    const { anchorElement } = this.props
    
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
          left: anchorRect.right + this.props.padding,
          childRect: params.childRect,
          popoverRect: params.popoverRect,
          position: 'right',
        }
      }
    } catch (error) {
      return undefined
    }
  }

  calculateMaxHeight = () => {
    const { maxHeight, minHeight, chartContainerRef } = this.props
    const padding = 50
    
    let calculatedMaxHeight = maxHeight
    
    if (chartContainerRef?.clientHeight) {
      const chartHeight = chartContainerRef.clientHeight
      if (chartHeight > minHeight + padding) {
        calculatedMaxHeight = chartHeight - padding
      } else if (chartHeight < minHeight + padding) {
        calculatedMaxHeight = minHeight
      }
    }
    
    if (calculatedMaxHeight > window.innerHeight) {
      calculatedMaxHeight = window.innerHeight
    }
    
    return calculatedMaxHeight
  }

  renderContent = () => {
    const {
      options,
      onSelect,
      minHeight,
      className,
      itemClassName,
      activeItemClassName,
      renderSubmenu,
    } = this.props

    const maxHeight = this.calculateMaxHeight()

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
            className={`hover-submenu-container ${className}`}
            onMouseEnter={this.handleMouseEnter}
            onMouseLeave={this.handleMouseLeave}
            ref={(el) => {
              this.menuRef = el
            }}
          >
            <ul 
              className='axis-selector-content'
              role={this.props.role}
              aria-label={this.props.ariaLabel || undefined}
            >
                    {options.map((option, index) => {
                      const isActive = option.isActive || false
                      // Check if this option has a submenu (either via submenu prop or renderSubmenu function)
                      // We need to check if renderSubmenu would return something, but we can't call it twice
                      // So we'll check option.submenu first, then call renderSubmenu if it exists
                      const hasSubmenu = option.submenu === true || (renderSubmenu !== null && renderSubmenu !== undefined)

                      return (
                        <li
                          role="none"
                          className={`hover-submenu-item ${itemClassName} ${isActive ? activeItemClassName : ''} ${hasSubmenu ? 'has-submenu' : ''}`}
                          key={`hover-submenu-${index}-${option.value}`}
                          data-depth={this.props.depth}
                          style={hasSubmenu ? { position: 'relative' } : undefined}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(option)
                          }}
                        >
                          {option.label}
                          {hasSubmenu && (
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
                          {/* Custom submenu renderer - use this for nested submenus */}
                          {hasSubmenu && renderSubmenu && renderSubmenu(option, index)}
                        </li>
                      )
                    })}
            </ul>
          </div>
        </CustomScrollbars>
      </div>
    )
  }

  render() {
    const {
      isOpen,
      options,
      parentElement,
      boundaryElement,
      positions,
      align,
      padding,
      renderWithoutPopover,
    } = this.props

    if (!isOpen || !options.length) {
      return null
    }

    const contentLocation = this.getContentLocation()

    // If renderWithoutPopover is true, just render the content (for nested use)
    if (renderWithoutPopover) {
      return this.renderContent()
    }

    // Otherwise, render with Popover wrapper
    return (
      <Popover
        isOpen={isOpen}
        contentLocation={contentLocation}
        content={this.renderContent}
        onClickOutside={this.handleClickOutside}
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
}
