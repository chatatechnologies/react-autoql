import React, { useState, forwardRef } from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

import { ColumnTypes, getHiddenColumns, getSelectableColumns } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './AddColumnBtn.scss'
import AggMenu from './AggMenu'

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
  } = props

  const COMPONENT_KEY = React.useMemo(() => uuid(), [])

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
    return [
      ColumnTypes.DOLLAR_AMT,
      ColumnTypes.QUANTITY,
      ColumnTypes.RATIO,
      ColumnTypes.PERCENT,
    ].includes(columnType)
  }

  const renderAddColumnMenu = (availableSelectColumns, availableHiddenColumns) => {
    if (!availableSelectColumns && !availableHiddenColumns) {
      return null
    }

    return (
      <CustomScrollbars autoHide={false}>
        <div className='more-options-menu react-autoql-add-column-menu'>
          <ul className='context-menu-list'>
            <div className='react-autoql-input-label'>Add a Column</div>
            {availableSelectColumns?.map((column, i) => {
              const columnIsNumerical = isColumnNumerical(column.column_type)

              return (
                <Popover
                  key={`agg-select-menu-${i}`}
                  isOpen={aggPopoverActiveID === `column-select-menu-item-${i}`}
                  onClickOutside={() => setAggPopoverActiveID(undefined)}
                  content={() => <AggMenu column={column} handleAggMenuItemClick={(aggType) => handleAddColumnClick(column, aggType?.sqlFn)} />}
                  parentElement={popoverParentElement}
                  boundaryElement={popoverParentElement}
                  positions={popoverPositions ?? ['right', 'left']}
                  align='start'
                  padding={0}
                >
                  <li
                    key={`column-select-menu-item-${i}`}
                    onClick={() => (columnIsNumerical ? undefined : handleAddColumnClick(column))}
                    onMouseOver={(e) => {
                      setAggPopoverActiveID(
                        columnIsNumerical ? `column-select-menu-item-${i}` : undefined
                      )
                    }}
                  >
                    <div className='react-autoql-add-column-menu-item'>
                      <Icon type='plus' />
                      <span>{column.display_name}</span>
                    </div>
                    <div className='react-autoql-menu-expand-arrow'>
                      {columnIsNumerical ? <Icon type='caret-right' /> : null}
                    </div>
                  </li>
                </Popover>
              )
            })}
            {availableHiddenColumns?.map((column, i) => {
              const isHiddenColumn = true
              return (
                <li
                  key={`column-select-menu-item-hidden-column-${i}`}
                  onClick={() => handleAddColumnClick(column, undefined, isHiddenColumn)}
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

  const availableSelectColumns = queryResponse?.data?.data?.available_selects?.filter((col) => {
    if (disableGroupColumnsOptions) {
      return isColumnNumerical(col.column_type)
    } else if (disableFilterColumnsOptions) {
      return !isColumnNumerical(col.column_type)
    }
    return true
  })
  const availableHiddenColumns = getHiddenColumns(queryResponse?.data?.data?.columns)

  if (!availableSelectColumns?.length && !availableHiddenColumns?.length && !enableCustomOption()) {
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
          className={!enableInlineStyle ? `react-autoql-table-add-column-btn${isAddColumnMenuOpen ? ' active' : ''}` : `react-autoql-inline-table-add-column-btn${isAddColumnMenuOpen ? ' active' : ''}`}
          style={{
            ...style, // Overwrite other styles if provided
          }}
          data-test='react-autoql-table-add-column-btn'
          data-tooltip-content='Add Column'
          data-tooltip-id={tooltipID}
          size='small'
        >
          <Icon type='plus' />
        </div>
      </Popover>
    </ErrorBoundary>
  )
})

AddColumnBtnWithoutRef.propTypes = {
  queryResponse: PropTypes.shape({
    data: PropTypes.shape({
      data: PropTypes.shape({
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
}

AddColumnBtnWithoutRef.defaultProps = {
  queryResponse: undefined,
  allowCustom: true,
  onAddColumnClick: () => { },
  onCustomClick: () => { },
  tooltipID: undefined,
  disableAddCustomColumnOption: false,
  style: {},
  enableInlineStyle: false,
  disableGroupColumnsOptions: false,
  disableFilterColumnsOptions: false,
}

export default AddColumnBtnWithoutRef