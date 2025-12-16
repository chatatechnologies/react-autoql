import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'

import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

import './LegendPopover.scss'

export default class LegendPopover extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    // Initialize temporary hidden labels from legendLabels.hidden property
    const hiddenLabels = props.legendLabels?.filter((l) => l.hidden).map((l) => l.label) || []

    this.state = {
      tempHiddenLabels: hiddenLabels,
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
      })
    }
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
    const { tempHiddenLabels } = this.state
    const { legendLabels, onLegendClick, onClose } = this.props

    // For each label, call onLegendClick if its visibility has changed
    legendLabels.forEach((label) => {
      const wasHidden = label.hidden // Use the actual current state from the label object
      const isHidden = tempHiddenLabels.includes(label.label)

      if (wasHidden !== isHidden) {
        onLegendClick?.(label)
      }
    })

    onClose()
  }

  handleCancel = () => {
    // Reset temp state and close
    this.setState({
      tempHiddenLabels: [...(this.props.hiddenLegendLabels || [])],
    })
    this.props.onClose()
  }

  renderLegendContent = () => {
    const { legendLabels, colorScale, shapeSize, chartHeight } = this.props
    const { tempHiddenLabels } = this.state

    if (!legendLabels?.length) {
      return null
    }

    // Use full chart outer height (minus some padding for header and footer)
    const maxHeight = isMobile ? Math.min(200, window.innerHeight * 0.4) : chartHeight - 20
    const contentMaxHeight = maxHeight - 100 // Reserve space for header and footer

    const allVisible = tempHiddenLabels.length === 0
    const noneVisible = tempHiddenLabels.length === legendLabels.length

    return (
      <div className='legend-popover-wrapper' style={{ maxHeight: `${maxHeight}px` }}>
        <div className='legend-popover-header'>
          <label className='legend-select-all-label'>
            <input
              type='checkbox'
              checked={allVisible}
              onChange={this.handleSelectAllToggle}
              className='legend-select-all-checkbox'
            />
            <span>Select All</span>
          </label>
        </div>

        <CustomScrollbars autoHeight autoHeightMin={50} autoHeightMax={contentMaxHeight} suppressScrollX>
          <div className='legend-popover-content'>
            {legendLabels.map((label, i) => {
              const isHidden = tempHiddenLabels?.includes(label.label)
              const color = colorScale?.(label.label) || label.color
              const isChecked = !isHidden

              // Log first item and any items in tempHiddenLabels
              if (i === 0 || tempHiddenLabels?.includes(label.label)) {
                console.log('[LegendPopover] Rendering item:', {
                  labelText: label.label,
                  labelHidden: label.hidden,
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
                  <input
                    type='checkbox'
                    checked={isChecked}
                    onChange={() => {}} // Handled by parent div onClick
                    className='legend-item-checkbox'
                  />
                  <svg width={shapeSize / 3} height={shapeSize / 3} className='legend-item-swatch'>
                    <rect
                      width={shapeSize / 3}
                      height={shapeSize / 3}
                      fill={color}
                      stroke={isHidden ? '#999' : color}
                      strokeWidth={isHidden ? 0 : 1}
                    />
                  </svg>
                  <span className='legend-item-label'>{label.label}</span>
                </div>
              )
            })}
          </div>
        </CustomScrollbars>

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
