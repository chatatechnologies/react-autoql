import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../Icon'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Select } from '../../Select'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

const SankeyColumnSelector = ({
  columns,
  selectedIndex,
  onSelect,
  type, // 'path' or 'value'
  pathColumnIndices,
  pathColumnOptionIndices, // optional: restrict path options to these column indices
  onPathChange,
  minPathColumns,
  maxPathColumns,
  pathTitle,
  pathSubtitle,
  pathLabel,
  pathIconType,
  disabledPathColumnIndices,
  disabledPathColumnTooltip,
  allowCount,
  disabled,
  disabledTooltip,
  showDropdown,
  setShowDropdown,
  buttonY,
  buttonX,
  buttonSize,
  chartTooltipID,
}) => {
  const [draggedPathIndex, setDraggedPathIndex] = useState(null)
  const [pathPopoverElement, setPathPopoverElement] = useState(null)
  const buttonIconSize = 20
  const buttonIconOffset = (buttonSize - buttonIconSize) / 2

  const handleClickOutside = (e) => {
    const target = e?.target
    // Keep Sankey popover open while interacting with nested Select popovers.
    if (target?.closest?.('.react-autoql-select-popover-container')) {
      return
    }
    setShowDropdown(false)
  }

  const getIcon = () => {
    switch (type) {
      case 'path':
        return <Icon type={pathIconType} />
      case 'value':
        return 'Σ'
      default:
        return null
    }
  }

  const getLabel = () => {
    switch (type) {
      case 'path':
        return pathLabel
      case 'value':
        return 'Value'
      default:
        return ''
    }
  }

  // Count is offered as a path option only when the caller includes the sentinel in pathColumnOptionIndices
  const countPathOption = { col: { display_name: 'Count' }, index: SANKEY_VALUE_COUNT_SENTINEL }
  const getPathColumn = (index) => (index === SANKEY_VALUE_COUNT_SENTINEL ? countPathOption.col : columns?.[index])

  const selectedPathNames = (pathColumnIndices || [])
    .map((index) => getPathColumn(index)?.display_name || getPathColumn(index)?.name)
    .filter(Boolean)

  const isCountSelected = type === 'value' && selectedIndex === SANKEY_VALUE_COUNT_SENTINEL
  const selectedColumn = columns[selectedIndex]
  const tooltipHtml =
    type === 'path'
      ? selectedPathNames.length
        ? `<strong>${pathTitle}:</strong><br/>${selectedPathNames.join(' → ')}`
        : `Select ${pathTitle.toLowerCase()}`
      : isCountSelected
      ? `<strong>${getLabel()} Column:</strong><br/><em>(Count)</em>`
      : selectedColumn
      ? `<strong>${getLabel()} Column:</strong><br/>${selectedColumn.display_name || selectedColumn.name}`
      : `Select ${getLabel()} Column`

  const numericColumns = columns.filter((col) => col.isNumberType)
  const categoricalColumns = columns
    .map((col, index) => ({ col, index }))
    .filter(({ col, index }) =>
      Array.isArray(pathColumnOptionIndices) ? pathColumnOptionIndices.includes(index) : !col.isNumberType,
    )
  if (pathColumnOptionIndices?.includes(SANKEY_VALUE_COUNT_SENTINEL)) {
    categoricalColumns.unshift(countPathOption)
  }

  const filteredColumns = type === 'value' ? numericColumns : categoricalColumns.map(({ col }) => col)

  const movePathColumn = (fromIndex, toIndex) => {
    if (!Array.isArray(pathColumnIndices)) return
    if (toIndex < 0 || toIndex >= pathColumnIndices.length) return
    const next = [...pathColumnIndices]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    onPathChange(next)
  }

  const removePathColumn = (columnIndex) => {
    if (!Array.isArray(pathColumnIndices)) return
    const next = pathColumnIndices.filter((index) => index !== columnIndex)
    onPathChange(next)
  }

  const addPathColumn = (columnIndex) => {
    if (!Array.isArray(pathColumnIndices)) return
    if (pathColumnIndices.includes(columnIndex)) return
    if (pathColumnIndices.length >= maxPathColumns) return
    onPathChange([...pathColumnIndices, columnIndex])
  }

  const replacePathColumn = (listIndex, nextColumnIndex) => {
    if (!Array.isArray(pathColumnIndices)) return
    if (listIndex < 0 || listIndex >= pathColumnIndices.length) return
    const nextPath = [...pathColumnIndices]
    // Keep path unique: remove the candidate if it exists elsewhere.
    const existingIndex = nextPath.findIndex((idx, i) => idx === nextColumnIndex && i !== listIndex)
    if (existingIndex >= 0) {
      nextPath.splice(existingIndex, 1)
      if (existingIndex < listIndex) {
        listIndex -= 1
      }
    }
    nextPath[listIndex] = nextColumnIndex
    onPathChange(nextPath)
  }

  const renderPathDropdownContent = () => {
    const availableColumns = categoricalColumns.filter(({ index }) => !pathColumnIndices.includes(index))
    const hasMinPath = pathColumnIndices.length >= minPathColumns

    return (
      <div className='sankey-path-dropdown-popover-content' ref={setPathPopoverElement}>
        <div className='sankey-column-dropdown-title'>{pathTitle}</div>
        <div className='sankey-path-dropdown-subtitle'>{pathSubtitle}</div>
        <CustomScrollbars className='sankey-path-selected-list' suppressScrollX maxHeight={240}>
          <div className='sankey-path-selected-list-inner'>
          {pathColumnIndices.map((columnIndex, listIndex) => {
            const column = getPathColumn(columnIndex)
            if (!column) return null
            const selectOptions = categoricalColumns.filter(({ index }) => {
              const isCurrent = index === columnIndex
              const usedElsewhere = pathColumnIndices.includes(index) && !isCurrent
              if (usedElsewhere) return false
              return true
            })
            return (
              <div
                key={`path-selected-${columnIndex}-${listIndex}`}
                className='sankey-path-selected-item'
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedPathIndex === null) return
                  movePathColumn(draggedPathIndex, listIndex)
                  setDraggedPathIndex(null)
                }}
                onDragEnd={() => setDraggedPathIndex(null)}
              >
                <span className='sankey-path-selected-index'>{listIndex + 1}.</span>
                <span
                  className='sankey-path-drag-handle'
                  title='Drag to reorder'
                  draggable
                  onDragStart={() => setDraggedPathIndex(listIndex)}
                  onDragEnd={() => setDraggedPathIndex(null)}
                >
                  ⋮⋮
                </span>
                <Select
                  className='sankey-path-selected-select'
                  size='small'
                  outlined={true}
                  fullWidth
                  value={columnIndex}
                  popoverParentElement={pathPopoverElement}
                  popoverBoundaryElement={pathPopoverElement}
                  options={selectOptions.map(({ col, index }) => ({
                    value: index,
                    label: col.display_name || col.name,
                  }))}
                  onChange={(value) => replacePathColumn(listIndex, Number(value))}
                />
                <div className='sankey-path-selected-controls'>
                  <button
                    type='button'
                    className='sankey-path-control-btn danger'
                    onClick={() => removePathColumn(columnIndex)}
                    disabled={pathColumnIndices.length <= minPathColumns}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
          </div>
        </CustomScrollbars>
        {!hasMinPath && (
          <div className='sankey-path-warning'>
            Select at least {minPathColumns} column{minPathColumns === 1 ? '' : 's'} to render this chart.
          </div>
        )}
        <div className='sankey-path-add-title'>Add column</div>
        <CustomScrollbars className='sankey-column-dropdown-container' suppressScrollX>
          {availableColumns.length === 0 ? (
            <div className='sankey-column-dropdown-empty'>
              {pathColumnIndices.length >= maxPathColumns
                ? `Maximum of ${maxPathColumns} columns reached`
                : 'No additional categorical columns available'}
            </div>
          ) : (
            availableColumns.map(({ col, index }) => (
              <div
                key={`path-available-${index}`}
                className='sankey-column-dropdown-item'
                onClick={() => addPathColumn(index)}
              >
                <Icon type='plus' className='sankey-column-dropdown-item-check' />
                <span>{col.display_name || col.name}</span>
              </div>
            ))
          )}
        </CustomScrollbars>
      </div>
    )
  }

  // A single-column pick is a plain list (like the value picker), not an ordered path to add to
  const renderSingleColumnDropdownContent = () => (
    <div className='sankey-column-dropdown-popover-content'>
      <div className='sankey-column-dropdown-title'>{pathTitle}</div>
      <CustomScrollbars className='sankey-column-dropdown-container' suppressScrollX>
        {categoricalColumns.map(({ col, index }) => {
          const isSelected = pathColumnIndices[0] === index
          const isDisabled = !isSelected && !!disabledPathColumnIndices?.includes(index)
          return (
            <div
              key={`path-single-${index}`}
              className={`sankey-column-dropdown-item${isSelected ? ' sankey-column-dropdown-item-selected' : ''}${
                isDisabled ? ' sankey-column-dropdown-item-disabled' : ''
              }`}
              data-tooltip-id={isDisabled ? chartTooltipID : undefined}
              data-tooltip-content={isDisabled ? disabledPathColumnTooltip : undefined}
              onClick={() => {
                if (isDisabled) return
                if (!isSelected) onPathChange([index])
                setShowDropdown(false)
              }}
            >
              {isSelected && <Icon type='check' className='sankey-column-dropdown-item-check' />}
              <span>{col.display_name || col.name}</span>
            </div>
          )
        })}
      </CustomScrollbars>
    </div>
  )

  const renderValueDropdownContent = () => {
    if (type !== 'value') {
      if (!filteredColumns.length) {
        return <div className='sankey-column-dropdown-empty'>No {type} columns available</div>
      }
      return filteredColumns.map((col) => renderColumnDropdownItem(col))
    }

    if (!allowCount) {
      return filteredColumns.map((col) => renderColumnDropdownItem(col))
    }

    return (
      <>
        <div
          key='value-col-count'
          className={`sankey-column-dropdown-item ${isCountSelected ? 'sankey-column-dropdown-item-selected' : ''}`}
          onClick={() => {
            onSelect(SANKEY_VALUE_COUNT_SENTINEL)
            setShowDropdown(false)
          }}
        >
          {isCountSelected && <Icon type='check' className='sankey-column-dropdown-item-check' />}
          <span>Count</span>
        </div>
        {filteredColumns.map((col) => renderColumnDropdownItem(col))}
      </>
    )
  }

  const renderColumnDropdownItem = (col) => {
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
  }

  return (
    <g className={`sankey-${type}-button-group`}>
      <Popover
        isOpen={showDropdown}
        onClickOutside={handleClickOutside}
        content={
          type === 'path' && maxPathColumns === 1 ? (
            renderSingleColumnDropdownContent()
          ) : type === 'path' ? (
            renderPathDropdownContent()
          ) : (
            <div className='sankey-column-dropdown-popover-content'>
              <div className='sankey-column-dropdown-title'>{getLabel()} Column</div>
              <div className='sankey-column-dropdown-container'>{renderValueDropdownContent()}</div>
            </div>
          )
        }
        positions={['left', 'bottom', 'top']}
        align='center'
        padding={5}
      >
        <g
          className={`sankey-${type}-button${disabled ? ' sankey-button-disabled' : ''}`}
          transform={`translate(${buttonX}, ${buttonY})`}
        >
          <rect
            className={`sankey-${type}-button-rect`}
            width={buttonSize}
            height={buttonSize}
            rx='4'
            strokeWidth='1'
            opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) {
                setShowDropdown(!showDropdown)
              }
            }}
            data-tooltip-id={chartTooltipID}
            data-tooltip-html={disabled && disabledTooltip ? disabledTooltip : tooltipHtml}
            style={{ cursor: disabled ? 'default' : 'pointer' }}
          />
          {type === 'value' ? (
            <text
              className={`sankey-${type}-button-icon`}
              x={buttonSize / 2}
              y={buttonSize / 2}
              textAnchor='middle'
              dominantBaseline='middle'
              fontSize='1rem'
              fontWeight='bold'
              opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
              style={{ pointerEvents: 'none' }}
            >
              Σ
            </text>
          ) : (
            <g
              transform={`translate(${buttonIconOffset}, ${buttonIconOffset})`}
              className={`sankey-${type}-button-icon`}
              opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
              style={{ pointerEvents: 'none' }}
            >
              <foreignObject width={buttonIconSize} height={buttonIconSize}>
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getIcon()}
                </div>
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
  selectedIndex: PropTypes.number,
  onSelect: PropTypes.func,
  type: PropTypes.oneOf(['path', 'value']).isRequired,
  pathColumnIndices: PropTypes.arrayOf(PropTypes.number),
  pathColumnOptionIndices: PropTypes.arrayOf(PropTypes.number),
  onPathChange: PropTypes.func,
  minPathColumns: PropTypes.number,
  maxPathColumns: PropTypes.number,
  pathTitle: PropTypes.string,
  pathSubtitle: PropTypes.string,
  pathLabel: PropTypes.string,
  pathIconType: PropTypes.string,
  disabledPathColumnIndices: PropTypes.arrayOf(PropTypes.number),
  disabledPathColumnTooltip: PropTypes.string,
  allowCount: PropTypes.bool,
  disabled: PropTypes.bool,
  disabledTooltip: PropTypes.string,
  showDropdown: PropTypes.bool.isRequired,
  setShowDropdown: PropTypes.func.isRequired,
  buttonY: PropTypes.number,
  buttonX: PropTypes.number,
  buttonSize: PropTypes.number,
  chartTooltipID: PropTypes.string,
}

SankeyColumnSelector.defaultProps = {
  selectedIndex: undefined,
  onSelect: () => {},
  pathColumnIndices: [],
  pathColumnOptionIndices: undefined,
  onPathChange: () => {},
  minPathColumns: 2,
  maxPathColumns: 6,
  pathTitle: 'Path Columns',
  pathSubtitle: 'Order defines flow direction',
  pathLabel: 'Path',
  pathIconType: 'sankey',
  disabledPathColumnIndices: undefined,
  disabledPathColumnTooltip: undefined,
  allowCount: true,
  disabled: false,
  disabledTooltip: undefined,
  buttonY: 10,
  buttonX: 10,
  buttonSize: 35,
  chartTooltipID: undefined,
}

export default SankeyColumnSelector

