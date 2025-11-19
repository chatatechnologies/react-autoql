import React from 'react'
import PropTypes from 'prop-types'
import { MdFilterList } from 'react-icons/md'
import { Popover } from '../../Popover'
import { findNetworkColumns } from 'autoql-fe-utils'

const NodeFilterButton = (props) => {
  const {
    columns,
    selectedSourceColumnIndex,
    selectedTargetColumnIndex,
    showSenders,
    showReceivers,
    showBoth,
    setShowSenders,
    setShowReceivers,
    setShowBoth,
    showFilterDropdown,
    setShowFilterDropdown,
    setShowSourceDropdown,
    setShowTargetDropdown,
    popoverParentElement,
    chartTooltipID,
    chartWidth,
    buttonX,
    buttonY,
    buttonSize,
  } = props

  // Use selected columns or fall back to auto-detected
  const detected = findNetworkColumns(columns)
  const sourceColumnIndex = selectedSourceColumnIndex ?? detected.sourceColumnIndex
  const targetColumnIndex = selectedTargetColumnIndex ?? detected.targetColumnIndex
  const sourceColumn = sourceColumnIndex !== -1 ? columns[sourceColumnIndex] : null
  const targetColumn = targetColumnIndex !== -1 ? columns[targetColumnIndex] : null
  const senderLabel = sourceColumn?.display_name || 'Sender'
  const receiverLabel = targetColumn?.display_name || 'Receiver'

  // Render function for filter dropdown content
  const renderFilterDropdownContent = () => {
    const filterOptions = [
      {
        key: 'senders',
        label: `${senderLabel}s`,
        isSelected: showSenders,
        onClick: () => setShowSenders(!showSenders),
      },
      {
        key: 'receivers',
        label: `${receiverLabel}s`,
        isSelected: showReceivers,
        onClick: () => setShowReceivers(!showReceivers),
      },
      {
        key: 'both',
        label: 'Both',
        isSelected: showBoth,
        onClick: () => setShowBoth(!showBoth),
      },
    ]

    return (
      <div className='filter-dropdown-popover-content'>
        <div
          className='filter-dropdown-container'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {filterOptions.map((option) => (
            <div
              key={option.key}
              className={`filter-dropdown-item ${option.isSelected ? 'filter-dropdown-item-selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                option.onClick()
              }}
            >
              <span className='filter-dropdown-item-check'>{option.isSelected ? '✓' : ' '}</span>
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <g className='node-filter-button'>
      <Popover
        isOpen={showFilterDropdown}
        content={renderFilterDropdownContent}
        onClickOutside={() => {
          setShowFilterDropdown(false)
        }}
        parentElement={popoverParentElement}
        boundaryElement={popoverParentElement}
        positions={['left']}
        align='center'
        padding={5}
      >
        <g className='filter-button' transform={`translate(${buttonX}, ${buttonY})`}>
          <rect
            className='filter-button-rect'
            width={buttonSize}
            height={buttonSize}
            rx='4'
            strokeWidth='1'
            opacity={0}
            onClick={(e) => {
              e.stopPropagation()
              setShowFilterDropdown(!showFilterDropdown)
              setShowSourceDropdown(false) // Close source dropdown when opening filter
              setShowTargetDropdown(false) // Close target dropdown when opening filter
            }}
            data-tooltip-id={chartTooltipID}
            data-tooltip-html='Filter nodes'
          />
          <g transform='translate(5, 5)'>
            <MdFilterList className='filter-button-icon' size={20} style={{ opacity: 0 }} />
          </g>
        </g>
      </Popover>
    </g>
  )
}

NodeFilterButton.propTypes = {
  columns: PropTypes.array.isRequired,
  selectedSourceColumnIndex: PropTypes.number,
  selectedTargetColumnIndex: PropTypes.number,
  showSenders: PropTypes.bool.isRequired,
  showReceivers: PropTypes.bool.isRequired,
  showBoth: PropTypes.bool.isRequired,
  setShowSenders: PropTypes.func.isRequired,
  setShowReceivers: PropTypes.func.isRequired,
  setShowBoth: PropTypes.func.isRequired,
  showFilterDropdown: PropTypes.bool.isRequired,
  setShowFilterDropdown: PropTypes.func.isRequired,
  setShowSourceDropdown: PropTypes.func.isRequired,
  setShowTargetDropdown: PropTypes.func.isRequired,
  popoverParentElement: PropTypes.object,
  chartTooltipID: PropTypes.string.isRequired,
  chartWidth: PropTypes.number.isRequired,
  buttonX: PropTypes.number.isRequired,
  buttonY: PropTypes.number.isRequired,
  buttonSize: PropTypes.number.isRequired,
}

export default NodeFilterButton
