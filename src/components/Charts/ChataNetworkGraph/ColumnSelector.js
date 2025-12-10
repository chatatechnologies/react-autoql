import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { sourceColumnIcon, targetColumnIcon } from '../../../svgIcons'

const ColumnSelector = (props) => {
  const {
    columns,
    selectedSourceColumnIndex,
    selectedTargetColumnIndex,
    setSelectedSourceColumnIndex,
    setSelectedTargetColumnIndex,
    showSourceDropdown,
    showTargetDropdown,
    setShowSourceDropdown,
    setShowTargetDropdown,
    setShowFilterDropdown,
    popoverParentElement,
    chartTooltipID,
    buttonX,
    sourceButtonY,
    targetButtonY,
    buttonSize,
  } = props

  const dropdownWidth = 180
  const dropdownItemHeight = 28
  const maxDropdownHeight = 200

  const stringColumns = (columns || [])
    .map((col, idx) => ({ ...col, columnIndex: idx }))
    .filter((col) => col.type === 'STRING' || col.type === 'TEXT')

  // On mobile, use a large maxHeight to fill the container, otherwise use calculated height
  const sourceDropdownHeight = isMobile
    ? window.innerHeight - 200
    : Math.min(dropdownItemHeight * stringColumns.length + 8, maxDropdownHeight)
  const targetDropdownHeight = isMobile
    ? window.innerHeight - 200
    : Math.min(dropdownItemHeight * stringColumns.length + 8, maxDropdownHeight)

  // Get selected column names for tooltips
  const selectedSourceColumn =
    stringColumns.find((col) => col.columnIndex === selectedSourceColumnIndex) ||
    (stringColumns.length > 0 && selectedSourceColumnIndex === null ? stringColumns[0] : null)
  const selectedTargetColumn =
    stringColumns.find((col) => col.columnIndex === selectedTargetColumnIndex) ||
    (stringColumns.length > 1 && selectedTargetColumnIndex === null ? stringColumns[1] : null)

  const sourceTooltipHtml = selectedSourceColumn
    ? `Source column<br/><em>(${selectedSourceColumn.display_name || selectedSourceColumn.name})</em>`
    : 'Source column'
  const targetTooltipHtml = selectedTargetColumn
    ? `Target column<br/><em>(${selectedTargetColumn.display_name || selectedTargetColumn.name})</em>`
    : 'Target column'

  const renderSourceDropdownContent = () => {
    return (
      <div className='source-dropdown-popover-content'>
        <div className='source-dropdown-title'>Source column</div>
        <CustomScrollbars
          autoHeight={!isMobile}
          autoHeightMin={35}
          maxHeight={isMobile ? undefined : sourceDropdownHeight}
          suppressScrollX
          style={isMobile ? { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' } : undefined}
        >
          <div
            className='source-dropdown-container'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {stringColumns.map((col, index) => {
              const isSelected =
                selectedSourceColumnIndex === col.columnIndex || (selectedSourceColumnIndex === null && index === 0)
              return (
                <div
                  key={`source-${col.columnIndex}`}
                  className={`source-dropdown-item ${isSelected ? 'source-dropdown-item-selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedSourceColumnIndex(col.columnIndex)
                    setShowSourceDropdown(false)
                  }}
                >
                  <span className='source-dropdown-item-check'>{isSelected ? '✓' : ' '}</span>
                  <span>{col.display_name || col.name}</span>
                </div>
              )
            })}
          </div>
        </CustomScrollbars>
      </div>
    )
  }

  const renderTargetDropdownContent = () => {
    return (
      <div className='target-dropdown-popover-content'>
        <div className='target-dropdown-title'>Target column</div>
        <CustomScrollbars
          autoHeight={!isMobile}
          autoHeightMin={35}
          maxHeight={isMobile ? undefined : targetDropdownHeight}
          suppressScrollX
          style={isMobile ? { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' } : undefined}
        >
          <div
            className='target-dropdown-container'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {stringColumns.map((col, index) => {
              const isSelected =
                selectedTargetColumnIndex === col.columnIndex || (selectedTargetColumnIndex === null && index === 1)
              return (
                <div
                  key={`target-${col.columnIndex}`}
                  className={`target-dropdown-item ${isSelected ? 'target-dropdown-item-selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedTargetColumnIndex(col.columnIndex)
                    setShowTargetDropdown(false)
                  }}
                >
                  <span className='target-dropdown-item-check'>{isSelected ? '✓' : ' '}</span>
                  <span>{col.display_name || col.name}</span>
                </div>
              )
            })}
          </div>
        </CustomScrollbars>
      </div>
    )
  }

  return (
    <>
      {/* Source column button */}
      <g className='source-button-group'>
        <Popover
          isOpen={showSourceDropdown}
          content={renderSourceDropdownContent}
          onClickOutside={() => {
            setShowSourceDropdown(false)
          }}
          parentElement={popoverParentElement}
          boundaryElement={popoverParentElement}
          positions={['left']}
          align='center'
          padding={5}
        >
          <g className='source-button' transform={`translate(${buttonX}, ${sourceButtonY})`}>
            <rect
              className='source-button-rect'
              width={buttonSize}
              height={buttonSize}
              rx='4'
              strokeWidth='1'
              opacity={0}
              onClick={(e) => {
                e.stopPropagation()
                setShowSourceDropdown(!showSourceDropdown)
                setShowTargetDropdown(false) // Close target dropdown when opening source
                setShowFilterDropdown(false) // Close filter dropdown when opening source
              }}
              data-tooltip-id={chartTooltipID}
              data-tooltip-html={sourceTooltipHtml}
            />
            <g transform='translate(5, 5)' className='source-button-icon' opacity={0}>
              {sourceColumnIcon}
            </g>
          </g>
        </Popover>
      </g>

      {/* Target column button */}
      <g className='target-button-group'>
        <Popover
          isOpen={showTargetDropdown}
          content={renderTargetDropdownContent}
          onClickOutside={() => {
            setShowTargetDropdown(false)
          }}
          parentElement={popoverParentElement}
          boundaryElement={popoverParentElement}
          positions={['left']}
          align='center'
          padding={5}
        >
          <g className='target-button' transform={`translate(${buttonX}, ${targetButtonY})`}>
            <rect
              className='target-button-rect'
              width={buttonSize}
              height={buttonSize}
              rx='4'
              strokeWidth='1'
              opacity={0}
              onClick={(e) => {
                e.stopPropagation()
                setShowTargetDropdown(!showTargetDropdown)
                setShowSourceDropdown(false) // Close source dropdown when opening target
                setShowFilterDropdown(false) // Close filter dropdown when opening target
              }}
              data-tooltip-id={chartTooltipID}
              data-tooltip-html={targetTooltipHtml}
            />
            <g transform='translate(5, 5)' className='target-button-icon' opacity={0}>
              {targetColumnIcon}
            </g>
          </g>
        </Popover>
      </g>
    </>
  )
}

ColumnSelector.propTypes = {
  columns: PropTypes.array.isRequired,
  selectedSourceColumnIndex: PropTypes.number,
  selectedTargetColumnIndex: PropTypes.number,
  setSelectedSourceColumnIndex: PropTypes.func.isRequired,
  setSelectedTargetColumnIndex: PropTypes.func.isRequired,
  showSourceDropdown: PropTypes.bool.isRequired,
  showTargetDropdown: PropTypes.bool.isRequired,
  setShowSourceDropdown: PropTypes.func.isRequired,
  setShowTargetDropdown: PropTypes.func.isRequired,
  setShowFilterDropdown: PropTypes.func.isRequired,
  popoverParentElement: PropTypes.object,
  chartTooltipID: PropTypes.string.isRequired,
  buttonX: PropTypes.number.isRequired,
  sourceButtonY: PropTypes.number.isRequired,
  targetButtonY: PropTypes.number.isRequired,
  buttonSize: PropTypes.number.isRequired,
}

export default ColumnSelector
