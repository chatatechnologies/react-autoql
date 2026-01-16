import React, { useState, forwardRef, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { ColumnTypes, getHiddenColumns, getSelectableColumns, normalizeColumnIdentifier } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './AddColumnBtn.scss'
import AggMenu from './AggMenu'
import { Spinner } from '../Spinner'

const AddColumnBtnWithoutRef = forwardRef((props, ref) => {
  const {
    queryResponse,
    popoverParentElement,
    popoverPositions,
    tooltipID,
    allowCustom,
    onAddColumnClick,
    onCustomClick,
    disableAddCustomColumnOption,
    style,
    enableInlineStyle,
    disableGroupColumnsOptions,
    disableFilterColumnsOptions,
    className,
    isAddingColumn,
    disableAggregationMenu,
  } = props

  const COMPONENT_KEY = useMemo(() => uuid(), [])

  const [isAddColumnMenuOpen, setIsAddColumnMenuOpen] = useState(false)
  const [aggPopoverActiveID, setAggPopoverActiveID] = useState(undefined)

  const handleAddColumnClick = (column, aggType, isHiddenColumn) => {
    onAddColumnClick(column, aggType, isHiddenColumn)
    setIsAddColumnMenuOpen(false)
    setAggPopoverActiveID(undefined)
  }

  const handleCustomClick = () => {
    setIsAddColumnMenuOpen(false)
    setAggPopoverActiveID(undefined)
    onCustomClick()
  }

  const enableCustomOption = () => {
    if (disableAddCustomColumnOption) {
      return false
    }

    let selectableColumnsForCustom
    try {
      selectableColumnsForCustom = getSelectableColumns(queryResponse?.data?.data?.columns)
    } catch {
      selectableColumnsForCustom = []
    }

    return allowCustom && !!selectableColumnsForCustom?.length
  }

  const isColumnNumerical = (columnType) => {
    return [ColumnTypes.DOLLAR_AMT, ColumnTypes.QUANTITY, ColumnTypes.RATIO, ColumnTypes.PERCENT].includes(columnType)
  }

  const renderAddColumnMenu = (availableSelectColumns, availableHiddenColumns) => {
    if (!availableSelectColumns && !availableHiddenColumns) {
      return null
    }

    return (
      <CustomScrollbars autoHide={false} suppressScrollX>
        <div className='more-options-menu react-autoql-add-column-menu'>
          <ul className='context-menu-list'>
            <div className='react-autoql-input-label'>Add a Column</div>
            {availableSelectColumns?.map((column, idx) => {
              const colId = normalizeColumnIdentifier(column) || column?.id || column?.name || `col-${idx}`
              const columnIsNumerical = isColumnNumerical(column.column_type)
              const shouldShowAggMenu = !disableAggregationMenu && columnIsNumerical

              if (shouldShowAggMenu) {
                return (
                  <Popover
                    key={`agg-select-menu-${colId}`}
                    isOpen={aggPopoverActiveID === `column-select-menu-item-${colId}`}
                    onClickOutside={() => setAggPopoverActiveID(undefined)}
                    content={() => (
                      <AggMenu
                        column={column}
                        handleAggMenuItemClick={(aggType) => handleAddColumnClick(column, aggType?.sqlFn)}
                      />
                    )}
                    parentElement={popoverParentElement}
                    boundaryElement={popoverParentElement}
                    positions={popoverPositions ?? ['right', 'left']}
                    align='start'
                    padding={0}
                  >
                    <li
                      key={`column-select-menu-item-${colId}`}
                      onMouseOver={() => setAggPopoverActiveID(`column-select-menu-item-${colId}`)}
                    >
                      <div className='react-autoql-add-column-menu-item'>
                        <Icon type='plus' />
                        <span>{column.display_name}</span>
                      </div>
                      <div className='react-autoql-menu-expand-arrow'>
                        <Icon type='caret-right' />
                      </div>
                    </li>
                  </Popover>
                )
              }

              return (
                <li key={`column-select-menu-item-${colId}`} onClick={() => handleAddColumnClick(column)}>
                  <div className='react-autoql-add-column-menu-item'>
                    <Icon type='plus' />
                    <span>{column.display_name}</span>
                  </div>
                </li>
              )
            })}
            {availableHiddenColumns?.map((column, idx) => {
              const hiddenId = normalizeColumnIdentifier(column) || column?.id || column?.name || `hidden-${idx}`
              return (
                <li
                  key={`column-select-menu-item-hidden-${hiddenId}`}
                  onClick={() => handleAddColumnClick(column, undefined, true)}
                >
                  <div className='react-autoql-add-column-menu-item'>
                    <Icon type='plus' />
                    <span>{column.display_name}</span>
                  </div>
                </li>
              )
            })}
            {enableCustomOption() && (
              <>
                <hr />
                <li onClick={handleCustomClick}>Custom...</li>
              </>
            )}
          </ul>
        </div>
      </CustomScrollbars>
    )
  }

  const existingColumnNames = useMemo(
    () => (queryResponse?.data?.data?.columns || []).map((c) => normalizeColumnIdentifier(c) || c?.id || ''),
    [queryResponse?.data?.data?.columns],
  )

  const existingColumnIds = useMemo(
    () => (queryResponse?.data?.data?.columns || []).map((c) => c?.id).filter(Boolean),
    [queryResponse?.data?.data?.columns],
  )

  const availableSelectColumns = useMemo(() => {
    const selects = queryResponse?.data?.data?.available_selects || []
    return selects.filter((col) => {
      const thisId = normalizeColumnIdentifier(col) || col?.id || ''
      if ((thisId && existingColumnNames.includes(thisId)) || (col?.id && existingColumnIds.includes(col.id))) {
        return false
      }

      if (disableGroupColumnsOptions) return isColumnNumerical(col.column_type)
      if (disableFilterColumnsOptions) return !isColumnNumerical(col.column_type)
      return true
    })
  }, [existingColumnNames, existingColumnIds, disableGroupColumnsOptions, disableFilterColumnsOptions])

  const availableHiddenColumns = useMemo(
    () => getHiddenColumns(queryResponse?.data?.data?.columns),
    [queryResponse?.data?.data?.columns],
  )

  // Force render when allowCustom is true and custom option is enabled (for drilldowns with no available selects)
  const shouldRender =
    availableSelectColumns?.length ||
    availableHiddenColumns?.length ||
    enableCustomOption() ||
    (allowCustom && !disableAddCustomColumnOption)

  if (!shouldRender) {
    return null
  }

  return (
    <ErrorBoundary>
      <Popover
        key={`add-column-button-${COMPONENT_KEY}`}
        isOpen={isAddColumnMenuOpen}
        onClickOutside={(e) => {
          if (!aggPopoverActiveID) {
            setIsAddColumnMenuOpen(false)
          }
        }}
        content={() => renderAddColumnMenu(availableSelectColumns, availableHiddenColumns)}
        parentElement={popoverParentElement}
        boundaryElement={popoverParentElement}
        positions={popoverPositions ?? ['bottom', 'left', 'right', 'top']}
        stopClickPropagation={false}
        align='end'
      >
        <div
          onClick={() => setIsAddColumnMenuOpen(true)}
          className={`${
            !enableInlineStyle
              ? `react-autoql-table-add-column-btn${isAddColumnMenuOpen ? ' active' : ''}`
              : `react-autoql-inline-table-add-column-btn${isAddColumnMenuOpen ? ' active' : ''}`
          }
             ${className} ${isAddingColumn ? 'add-column-btn-is-loading' : 'add-column-btn-not-loading'}`}
          style={{
            ...style, // Overwrite other styles if provided
          }}
          data-test='react-autoql-table-add-column-btn'
          data-tooltip-content='Add Column'
          data-tooltip-id={tooltipID}
          size='small'
        >
          {isAddingColumn ? <Spinner /> : <Icon type='plus' />}
        </div>
      </Popover>
    </ErrorBoundary>
  )
})

AddColumnBtnWithoutRef.propTypes = {
  queryResponse: PropTypes.shape({
    data: PropTypes.shape({
      data: PropTypes.shape({
        columns: PropTypes.arrayOf(PropTypes.object),
        available_selects: PropTypes.array,
        fe_req: PropTypes.shape({
          additional_selects: PropTypes.array,
        }),
      }),
    }),
  }),
  popoverParentElement: PropTypes.object,
  popoverPositions: PropTypes.arrayOf(PropTypes.string),
  tooltipID: PropTypes.string,
  allowCustom: PropTypes.bool,
  onAddColumnClick: PropTypes.func,
  onCustomClick: PropTypes.func,
  disableAddCustomColumnOption: PropTypes.bool,
  style: PropTypes.object,
  enableInlineStyle: PropTypes.bool,
  disableGroupColumnsOptions: PropTypes.bool,
  disableFilterColumnsOptions: PropTypes.bool,
  disableAggregationMenu: PropTypes.bool,
}

AddColumnBtnWithoutRef.defaultProps = {
  queryResponse: undefined,
  allowCustom: true,
  onAddColumnClick: () => {},
  onCustomClick: () => {},
  tooltipID: undefined,
  disableAddCustomColumnOption: false,
  style: {},
  enableInlineStyle: false,
  disableGroupColumnsOptions: false,
  disableFilterColumnsOptions: false,
  disableAggregationMenu: false,
}

export default AddColumnBtnWithoutRef
