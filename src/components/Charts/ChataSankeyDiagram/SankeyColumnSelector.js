import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../Icon'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Select } from '../../Select'

const SankeyColumnSelector = ({
  columns,
  selectedIndex,
  onSelect,
  type, // 'path' or 'value'
  pathColumnIndices,
  onPathChange,
  maxPathColumns,
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
        return <Icon type='sankey' />
      case 'value':
        return 'Σ'
      default:
        return null
    }
  }

  const getLabel = () => {
    switch (type) {
      case 'path':
        return 'Path'
      case 'value':
        return 'Value'
      default:
        return ''
    }
  }

  const selectedPathNames = (pathColumnIndices || [])
    .map((index) => columns?.[index]?.display_name || columns?.[index]?.name)
    .filter(Boolean)

  const selectedColumn = columns[selectedIndex]
  const tooltipHtml =
    type === 'path'
      ? selectedPathNames.length
        ? `<strong>Path Columns:</strong><br/>${selectedPathNames.join(' → ')}`
        : 'Select path columns'
      : selectedColumn
      ? `<strong>${getLabel()} Column:</strong><br/>${selectedColumn.display_name || selectedColumn.name}`
      : `Select ${getLabel()} Column`

  const numericColumns = columns.filter((col) => col.isNumberType)
  const categoricalColumns = columns
    .map((col, index) => ({ col, index }))
    .filter(({ col }) => !col.isNumberType)

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
    const hasMinPath = pathColumnIndices.length >= 2

    return (
      <div className='sankey-path-dropdown-popover-content' ref={setPathPopoverElement}>
        <div className='sankey-column-dropdown-title'>Path Columns</div>
        <div className='sankey-path-dropdown-subtitle'>Order defines flow direction</div>
        <CustomScrollbars className='sankey-path-selected-list' suppressScrollX>
          {pathColumnIndices.map((columnIndex, listIndex) => {
            const column = columns[columnIndex]
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
                    disabled={pathColumnIndices.length <= 2}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </CustomScrollbars>
        {!hasMinPath && <div className='sankey-path-warning'>Select at least 2 columns to render a Sankey path.</div>}
        <div className='sankey-path-add-title'>Add column</div>
        <CustomScrollbars className='sankey-column-dropdown-container' suppressScrollX>
          {availableColumns.length === 0 ? (
            <div className='sankey-column-dropdown-empty'>
              {pathColumnIndices.length >= maxPathColumns
                ? `Maximum of ${maxPathColumns} path columns reached`
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

  const renderValueDropdownContent = () => {
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
        onClickOutside={handleClickOutside}
        content={
          type === 'path' ? (
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
        <g className={`sankey-${type}-button`} transform={`translate(${buttonX}, ${buttonY})`}>
          <rect
            className={`sankey-${type}-button-rect`}
            width={buttonSize}
            height={buttonSize}
            rx='4'
            strokeWidth='1'
            opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
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
  onPathChange: PropTypes.func,
  maxPathColumns: PropTypes.number,
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
  onPathChange: () => {},
  maxPathColumns: 6,
  buttonY: 10,
  buttonX: 10,
  buttonSize: 35,
  chartTooltipID: undefined,
}

export default SankeyColumnSelector

