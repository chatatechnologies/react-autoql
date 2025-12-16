import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Checkbox } from '../../Checkbox'

import './LegendPopover.scss'

export default class LegendPopover extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    // Initialize temporary hidden labels from legendLabels.hidden property
    const hiddenLabels = props.legendLabels?.filter((l) => l.hidden).map((l) => l.label) || []

    this.state = {
      tempHiddenLabels: hiddenLabels,
      initialHiddenLabels: hiddenLabels, // Track what state was when popover opened
      searchQuery: '',
      sortOrder: null, // null (unsorted), 'asc', or 'desc'
    }
  }

  static propTypes = {
    isOpen: PropTypes.bool,
    legendLabels: PropTypes.array,
    colorScale: PropTypes.func,
    onClose: PropTypes.func,
    popoverParentElement: PropTypes.object,
    onLegendClick: PropTypes.func,
    hiddenLegendLabels: PropTypes.array,
    shapeSize: PropTypes.number,
    children: PropTypes.node,
    chartHeight: PropTypes.number,
  }

  static defaultProps = {
    isOpen: false,
    legendLabels: [],
    hiddenLegendLabels: [],
    shapeSize: 75,
    onClose: () => {},
    onLegendClick: () => {},
    children: null,
    chartHeight: 400,
  }

  componentDidUpdate(prevProps) {
    // Reset temp state when popover opens or hidden labels change externally
    if (this.props.isOpen && !prevProps.isOpen) {
      // Build hidden labels list from legendLabels.hidden property
      const hiddenLabels = this.props.legendLabels?.filter((l) => l.hidden).map((l) => l.label) || []

      console.log('[LegendPopover] Opening popover, initializing state:', {
        hiddenLegendLabelsProp: this.props.hiddenLegendLabels,
        hiddenLabelsFromObjects: hiddenLabels,
        legendLabels: this.props.legendLabels?.map((l) => ({ label: l.label, hidden: l.hidden })),
      })

      this.setState({
        tempHiddenLabels: hiddenLabels,
        initialHiddenLabels: hiddenLabels, // Store initial state
        searchQuery: '', // Reset search when opening
      })
    }
  }

  handleSearchChange = (e) => {
    this.setState({ searchQuery: e.target.value })
  }

  clearSearch = () => {
    this.setState({ searchQuery: '' })
  }

  toggleSort = () => {
    const { sortOrder } = this.state
    let newSortOrder

    if (sortOrder === null) {
      newSortOrder = 'asc'
    } else if (sortOrder === 'asc') {
      newSortOrder = 'desc'
    } else {
      newSortOrder = null
    }

    this.setState({ sortOrder: newSortOrder })
  }

  getFilteredAndSortedLabels = () => {
    const { legendLabels } = this.props
    const { searchQuery, sortOrder } = this.state

    // Filter by search query
    let filtered = legendLabels.filter((label) => label.label.toLowerCase().includes(searchQuery.toLowerCase()))

    // Sort
    if (sortOrder === 'asc') {
      filtered = [...filtered].sort((a, b) => a.label.localeCompare(b.label))
    } else if (sortOrder === 'desc') {
      filtered = [...filtered].sort((a, b) => b.label.localeCompare(a.label))
    }
    // null keeps original order

    return filtered
  }

  handleCheckboxChange = (labelText) => {
    const { tempHiddenLabels } = this.state

    if (tempHiddenLabels.includes(labelText)) {
      // Show this label
      this.setState({
        tempHiddenLabels: tempHiddenLabels.filter((l) => l !== labelText),
      })
    } else {
      // Hide this label
      this.setState({
        tempHiddenLabels: [...tempHiddenLabels, labelText],
      })
    }
  }

  handleSelectAllToggle = () => {
    const { tempHiddenLabels } = this.state
    const { legendLabels } = this.props

    if (tempHiddenLabels.length === 0) {
      // Currently all selected - deselect all
      const allLabels = legendLabels.map((l) => l.label)
      this.setState({
        tempHiddenLabels: allLabels,
      })
    } else {
      // Some are hidden - select all
      this.setState({
        tempHiddenLabels: [],
      })
    }
  }

  handleApply = () => {
    const { tempHiddenLabels, initialHiddenLabels } = this.state
    const { legendLabels, onLegendClick, onClose } = this.props

    // For each label, call onLegendClick if its visibility has changed from initial state
    legendLabels.forEach((label) => {
      const wasHidden = initialHiddenLabels.includes(label.label) // Compare against state when popover opened
      const isHidden = tempHiddenLabels.includes(label.label)

      if (wasHidden !== isHidden) {
        onLegendClick?.(label)
      }
    })

    onClose()
  }

  handleCancel = () => {
    // Reset temp state to initial state and close
    this.setState({
      tempHiddenLabels: this.state.initialHiddenLabels,
    })
    this.props.onClose()
  }

  renderLegendContent = () => {
    const { legendLabels, colorScale, shapeSize, chartHeight } = this.props
    const { tempHiddenLabels, searchQuery, sortOrder } = this.state

    if (!legendLabels?.length) {
      return null
    }

    // Use full chart outer height (minus some padding for header and footer)
    const maxHeight = isMobile ? Math.min(200, window.innerHeight * 0.4) : chartHeight - 20
    const contentHeight = maxHeight - 150 // Reserve space for header, search, and footer

    const allVisible = tempHiddenLabels.length === 0
    const noneVisible = tempHiddenLabels.length === legendLabels.length

    const filteredLabels = this.getFilteredAndSortedLabels()

    return (
      <div className='legend-popover-wrapper' style={{ maxHeight: `${maxHeight}px` }}>
        <div className='legend-popover-header'>
          <div className='legend-select-all-wrapper' onClick={this.handleSelectAllToggle}>
            <Checkbox checked={allVisible} clickable={false} className='legend-select-all-checkbox' />
            <span className='legend-select-all-label'>Select All</span>
          </div>

          <div className='legend-popover-controls'>
            <div className='legend-search-wrapper'>
              <input
                type='text'
                placeholder='Search...'
                value={searchQuery}
                onChange={this.handleSearchChange}
                className='legend-search-input'
              />
              {searchQuery && (
                <button className='legend-search-clear' onClick={this.clearSearch} title='Clear search'>
                  ×
                </button>
              )}
            </div>
            <button
              className={`legend-sort-button ${sortOrder || ''}`}
              onClick={this.toggleSort}
              title={sortOrder === 'asc' ? 'Sort A-Z' : sortOrder === 'desc' ? 'Sort Z-A' : 'Unsorted'}
            >
              {sortOrder === 'asc' ? '↑' : sortOrder === 'desc' ? '↓' : '↕'}
            </button>
          </div>
        </div>

        <div style={{ height: `${contentHeight}px` }}>
          <CustomScrollbars style={{ height: '100%' }} suppressScrollX>
            <div className='legend-popover-content'>
              {filteredLabels.length === 0 ? (
                <div className='legend-no-results'>No items found</div>
              ) : (
                filteredLabels.map((label, i) => {
                  const isHidden = tempHiddenLabels?.includes(label.label)
                  const color = colorScale?.(label.label) || label.color
                  const isChecked = !isHidden

                  // Log first item and any items in tempHiddenLabels
                  if (i === 0 || tempHiddenLabels?.includes(label.label)) {
                    console.log('[LegendPopover] Rendering item:', {
                      labelText: label.label,
                      labelHidden: label.hidden,
                      labelColor: label.color,
                      colorScaleResult: colorScale?.(label.label),
                      finalColor: color,
                      tempHiddenLabels,
                      isHidden,
                      isChecked,
                    })
                  }

                  return (
                    <div
                      key={`legend-item-${i}`}
                      className={`legend-item ${isHidden ? 'hidden' : ''}`}
                      onClick={() => this.handleCheckboxChange(label.label)}
                    >
                      <Checkbox checked={isChecked} clickable={false} className='legend-item-checkbox' />
                      <span className='legend-item-label'>{label.label}</span>
                    </div>
                  )
                })
              )}
            </div>
          </CustomScrollbars>
        </div>

        <div className='legend-popover-footer'>
          <button className='legend-popover-button secondary' onClick={this.handleCancel}>
            Cancel
          </button>
          <button className='legend-popover-button primary' onClick={this.handleApply} disabled={noneVisible}>
            Apply
          </button>
        </div>
      </div>
    )
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <Popover
        id={`legend-popover-${this.COMPONENT_KEY}`}
        isOpen={this.props.isOpen}
        content={this.renderLegendContent}
        onClickOutside={this.handleCancel}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={['left', 'right']}
        align='center'
        padding={10}
      >
        {this.props.children}
      </Popover>
    )
  }
}
