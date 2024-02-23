import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { isMobile } from 'react-device-detect'
import { AGG_TYPES, AggTypes, COLUMN_TYPES, isColumnStringType } from 'autoql-fe-utils'

import { Button } from '../../Button'
import { Select } from '../../Select'
import { Popover } from '../../Popover'
import { Checkbox } from '../../Checkbox'
import { SelectableList } from '../../SelectableList'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Icon } from '../../Icon'

export default class NumberAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.listRefs = {}

    const checkedColumns = this.getCheckedFromNumberColumnIndices(props)

    this.state = {
      aggType: undefined,
      selectedColumns: [],
      checkedColumns,
      columns: props.columns,
    }
  }

  static propTypes = {
    changeNumberColumnIndices: PropTypes.func,
    positions: PropTypes.arrayOf(PropTypes.string),
  }

  static defaultProps = {
    changeNumberColumnIndices: () => {},
    positions: ['right', 'bottom', 'top', 'left'],
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!prevState.isOpen && this.state.isOpen) {
      this.setState({
        selectedColumns: [],
        checkedColumns: this.getCheckedFromNumberColumnIndices(this.props),
        columns: this.props.columns,
      })
    }
  }

  getCheckedFromNumberColumnIndices = (props) => {
    if (props.isSecondAxis) {
      return props.numberColumnIndices2 ?? []
    } else {
      return props.numberColumnIndices ?? []
    }
  }

  onAggTypeSelect = (aggType, column) => {
    const { columns } = this.state
    const newColumns = columns.map((col) => {
      if (col.field === column.field) {
        return {
          ...col,
          aggType,
        }
      }
      return col
    })

    this.setState({ columns: newColumns })
  }

  getColumnsOfType = (type) => {
    const columns = this.state.columns?.filter((col) => {
      return col.type === type && col.is_visible && col.index !== this.props.stringColumnIndex
    })

    return columns
  }

  getSelectableListItems = (type) => {
    const items = []

    const otherAxisColumns = this.getOtherAxisColumns()
    const columnsOfType = this.getColumnsOfType(type)

    columnsOfType.forEach((col) => {
      const checked = this.state.checkedColumns.includes(col.index)
      const disabled = otherAxisColumns.includes(col.index)

      const aggTypeObj = AGG_TYPES[col.aggType]

      const item = {
        key: `selectable-list-item-${this.COMPONENT_KEY}-${type}-${col.index}`,
        content: (
          <div className='agg-selector-column-item' key={`column-agg-type-symbol-${this.COMPONENT_KEY}`}>
            {!this.props.isAggregation && col.aggType && (
              <Select
                className='agg-type-symbol'
                popupClassname='agg-type-symbol-select'
                popoverParentElement={this.popoverContentRef}
                popoverBoundaryElement={this.popoverContentRef}
                tooltipID={this.props.tooltipID}
                tooltip={aggTypeObj.tooltip}
                value={aggTypeObj.type}
                showArrow={false}
                align='start'
                size='small'
                options={Object.keys(AGG_TYPES)
                  .filter((agg) => {
                    if (isColumnStringType(col)) {
                      return agg === AggTypes.COUNT || agg === AggTypes.COUNT_DISTINCT
                    }

                    return true
                  })
                  .map((agg) => {
                    let icon = AGG_TYPES[agg].symbol
                    if (AGG_TYPES[agg].icon) {
                      icon = <Icon type={AGG_TYPES[agg].icon} />
                    }

                    return {
                      value: AGG_TYPES[agg].type,
                      label: icon,
                      listLabel: (
                        <span>
                          <span className='agg-select-list-symbol'>{icon}</span>
                          {AGG_TYPES[agg].displayName}
                        </span>
                      ),
                      tooltip: AGG_TYPES[agg].tooltip,
                    }
                  })}
                onChange={(value) => {
                  this.onAggTypeSelect(value, col)
                }}
              />
            )}
            <div className='agg-select-text'>
              <span>{col.display_name}</span>
            </div>
          </div>
        ),
        disabled,
        checked,
        columnIndex: col.index,
      }

      items.push(item)
    })

    return items
  }

  getOtherAxisColumns = () => {
    if (!this.props.hasSecondAxis) {
      return []
    }

    return this.props.isSecondAxis ? this.props.numberColumnIndices ?? [] : this.props.numberColumnIndices2 ?? []
  }

  areAllDisabled = (type) => {
    const otherAxisColumnsOfType = this.getOtherAxisColumns()?.filter(
      (colIndex) => this.state.columns[colIndex].type === type,
    )
    const allColumnsOfType = this.getColumnsOfType(type)

    return otherAxisColumnsOfType?.length === allColumnsOfType?.length
  }

  getAllChecked = (type) => {
    const otherAxisColumns = this.getOtherAxisColumns()
    const areAllDisabled = this.areAllDisabled(type)
    const columnsOfType = this.getColumnsOfType(type)
    return (
      !areAllDisabled &&
      columnsOfType.every(
        (col) => this.state.checkedColumns.includes(col.index) || otherAxisColumns.includes(col.index),
      )
    )
  }

  onColumnSelection = (selected, selectedColumns) => {
    const selectedColumnIndices = selectedColumns.map((col) => col.index)
    this.setState({ selectedColumns: selectedColumnIndices })
  }

  onColumnCheck = (columns) => {
    const { checkedColumns } = this.state
    const newCheckedColumns = _cloneDeep(checkedColumns)

    columns.forEach((col) => {
      const indexOfCheckedColumns = newCheckedColumns.indexOf(col.columnIndex)
      if (col.checked && indexOfCheckedColumns === -1) {
        newCheckedColumns.push(col.columnIndex)
      } else if (!col.checked && indexOfCheckedColumns > -1) {
        newCheckedColumns.splice(indexOfCheckedColumns, 1)
      }
    })

    this.setState({
      checkedColumns: newCheckedColumns,
    })
  }

  renderSelectorContent = ({ position, nudgedLeft, nudgedTop }) => {
    if (this.props.hidden) {
      return null
    }

    return (
      <div ref={(r) => (this.popoverContentRef = r)} className='number-axis-selector-popover'>
        <div className='number-axis-selector-popover-content'>
          {this.renderSeriesSelectors()}
          {this.renderApplyButton()}
        </div>
      </div>
    )
  }

  renderSeriesSelector = (typeObj) => {
    const type = typeObj?.type
    const columnsOfType = this.getColumnsOfType(type)
    if (!columnsOfType?.length) {
      return null
    }

    const title = typeObj.description
    const listItems = this.getSelectableListItems(type)
    const allChecked = this.getAllChecked(type)
    const allDisabled = this.areAllDisabled(type)

    return (
      <div className='number-selector-field-group' key={`series-selector-group-${type}-${this.COMPONENT_KEY}`}>
        <div className='number-selector-header'>
          <div className='number-selector-header-title'>
            {this.state.columns && this.props.legendColumn !== undefined ? (
              <span>{this.props.legendColumn.display_name}</span>
            ) : (
              <span>{title} Fields</span>
            )}
          </div>
          <div>
            <Checkbox
              checked={allChecked}
              disabled={allDisabled}
              className='number-selector-list-checkbox'
              onChange={() => {
                if (allChecked) {
                  this.listRefs[type]?.unCheckAll()
                } else {
                  this.listRefs[type]?.checkAll()
                }
              }}
            />
          </div>
        </div>
        <div className='react-autoql-custom-scrollbars'>
          <SelectableList
            ref={(r) => (this.listRefs[type] = r)}
            items={listItems}
            onSelect={this.onColumnSelection}
            onChange={this.onColumnCheck}
          />
        </div>
      </div>
    )
  }

  renderSeriesSelectors = () => {
    return (
      <CustomScrollbars autoHeight autoHeightMin={100} maxHeight={isMobile ? undefined : 200}>
        <div className='axis-series-selector'>
          <div className='number-selector-field-group-container'>
            {Object.keys(COLUMN_TYPES)
              // .filter((key) => COLUMN_TYPES[key].isNumber)
              .map((key) => {
                return this.renderSeriesSelector(COLUMN_TYPES[key])
              })}
          </div>
        </div>
      </CustomScrollbars>
    )
  }

  renderApplyButton = () => {
    return (
      <div className='axis-selector-apply-btn-container'>
        <Button
          className='axis-selector-apply-btn'
          type='primary'
          disabled={!this.state.checkedColumns?.length}
          tooltipID={this.props.tooltipID}
          onClick={() => {
            const indices = this.state.checkedColumns

            if (this.props.isSecondAxis) {
              this.props.changeNumberColumnIndices(this.props.numberColumnIndices, indices, this.state.columns)
            } else {
              this.props.changeNumberColumnIndices(indices, this.props.numberColumnIndices2, this.state.columns)
            }

            this.props.closeSelector()
          }}
        >
          Apply
        </Button>
      </div>
    )
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <Popover
        id={`number-axis-selector-${this.COMPONENT_KEY}`}
        isOpen={this.props.isOpen}
        content={this.renderSelectorContent}
        innerRef={this.props.axisSelectorRef}
        onClickOutside={this.props.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
      >
        {this.props.children}
      </Popover>
    )
  }
}
