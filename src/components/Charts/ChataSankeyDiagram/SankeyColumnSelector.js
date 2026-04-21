import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../Icon'
import { Popover } from '../../Popover'

const SankeyColumnSelector = ({
  columns,
  selectedIndex,
  onSelect,
  type, // 'source', 'target', or 'value'
  showDropdown,
  setShowDropdown,
  buttonY,
  buttonX,
  buttonSize,
  chartTooltipID,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'source':
        return <Icon type='arrow-right' />
      case 'target':
        return <Icon type='arrow-left' />
      case 'value':
        return 'Σ'
      default:
        return null
    }
  }

  const getLabel = () => {
    switch (type) {
      case 'source':
        return 'Source'
      case 'target':
        return 'Target'
      case 'value':
        return 'Value'
      default:
        return ''
    }
  }

  const selectedColumn = columns[selectedIndex]
  const tooltipHtml = selectedColumn
    ? `<strong>${getLabel()} Column:</strong><br/>${selectedColumn.display_name || selectedColumn.name}`
    : `Select ${getLabel()} Column`

  const filteredColumns =
    type === 'value' ? columns.filter((col) => col.isNumberType) : columns.filter((col) => !col.isNumberType)

  const renderDropdownContent = () => {
    if (!filteredColumns.length) {
      return <div className='sankey-column-dropdown-empty'>No {type} columns available</div>
    }

    return filteredColumns.map((col, index) => {
      const colIndex = columns.indexOf(col)
      const isSelected = colIndex === selectedIndex

      return (
        <div
          key={`${type}-col-${colIndex}`}
          className={`sankey-column-dropdown-item ${isSelected ? 'sankey-column-dropdown-item-selected' : ''}`}
          onClick={() => {
            onSelect(colIndex)
            setShowDropdown(false)
          }}
        >
          {isSelected && <Icon type='check' className='sankey-column-dropdown-item-check' />}
          <span>{col.display_name || col.name}</span>
        </div>
      )
    })
  }

  return (
    <g className={`sankey-${type}-button-group`}>
      <Popover
        isOpen={showDropdown}
        onClickOutside={() => setShowDropdown(false)}
        content={
          <div className='sankey-column-dropdown-popover-content'>
            <div className='sankey-column-dropdown-title'>{getLabel()} Column</div>
            <div className='sankey-column-dropdown-container'>{renderDropdownContent()}</div>
          </div>
        }
        positions={['left', 'bottom', 'top']}
        align='center'
        padding={5}
      >
        <g className={`sankey-${type}-button`} transform={`translate(${buttonX}, ${buttonY})`}>
          <rect
            className={`sankey-${type}-button-rect`}
            width={buttonSize}
            height={buttonSize}
            rx='4'
            strokeWidth='1'
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
            data-tooltip-id={chartTooltipID}
            data-tooltip-html={tooltipHtml}
            style={{ cursor: 'pointer' }}
          />
          {type === 'value' ? (
            <text
              className={`sankey-${type}-button-icon`}
              x={buttonSize / 2}
              y={buttonSize / 2}
              textAnchor='middle'
              dominantBaseline='central'
              fontSize='18'
              fontWeight='bold'
              style={{ pointerEvents: 'none' }}
            >
              Σ
            </text>
          ) : (
            <g transform='translate(8, 8)' className={`sankey-${type}-button-icon`} style={{ pointerEvents: 'none' }}>
              <foreignObject width='19' height='19'>
                {getIcon()}
              </foreignObject>
            </g>
          )}
        </g>
      </Popover>
    </g>
  )
}

SankeyColumnSelector.propTypes = {
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  selectedIndex: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
  type: PropTypes.oneOf(['source', 'target', 'value']).isRequired,
  showDropdown: PropTypes.bool.isRequired,
  setShowDropdown: PropTypes.func.isRequired,
  buttonY: PropTypes.number,
  buttonX: PropTypes.number,
  buttonSize: PropTypes.number,
  chartTooltipID: PropTypes.string,
}

SankeyColumnSelector.defaultProps = {
  buttonY: 10,
  buttonX: 10,
  buttonSize: 35,
  chartTooltipID: undefined,
}

export default SankeyColumnSelector

