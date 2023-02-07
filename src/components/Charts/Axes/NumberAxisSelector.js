import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import { Popover } from 'react-tiny-popover'
import { SelectableList } from '../../SelectableList'
import { Button } from '../../Button'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Checkbox } from '../../Checkbox'
import { AGG_TYPES, COLUMN_TYPES } from '../../../js/Constants'
import { Select } from '../../Select'

const aggHTMLCodes = {
  sum: <>&Sigma;</>,
  avg: <>&mu;</>,
  count: <>#</>,
}

export default class NumberAxisSelector extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    const checkedColumns = this.getCheckedFromNumberColumnIndices(props)

    this.state = {
      aggType: undefined,
      selectedColumns: [],
      checkedColumns,
      columns: props.columns,
    }
  }

  static propTypes = {
    rebuildTooltips: PropTypes.func,
    changeNumberColumnIndices: PropTypes.func,
  }

  static defaultProps = {
    rebuildTooltips: () => {},
    changeNumberColumnIndices: () => {},
  }

  componentDidMount = () => {
    this.props.rebuildTooltips()
  }

  // shouldComponentUpdate = (nextProps, nextState) => {
  //   return true
  //   // return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  // }

  componentDidUpdate = (prevProps, prevState) => {
    this.props.rebuildTooltips()

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

  onAggTypeCheck = (aggType) => {
    // update columns with agg type
    const { columns, selectedColumns } = this.state
    const newColumns = columns.map((col) => {
      const selected = selectedColumns.find((colIndex) => columns[colIndex].field === col.field)
      if (selected) {
        return {
          ...col,
          aggType,
        }
      }
      return col
    })

    this.setState({ columns: newColumns })
  }

  renderAggRadioGroup = () => {
    let aggType
    const { selectedColumns, columns } = this.state
    const oneSelected = selectedColumns.length === 1
    const multipleSelectedButAllSameType =
      selectedColumns.length > 1 &&
      selectedColumns.every((colIndex) => columns[colIndex].aggType === columns[selectedColumns[0]].aggType)

    if (oneSelected || multipleSelectedButAllSameType) {
      const column = this.state.columns[selectedColumns[0]]
      aggType = column?.aggType
    }

    return (
      <div className={`react-autoql-radio-btn-container react-autoql-radio-btn-container-list`}>
        {AGG_TYPES.map((agg, i) => {
          return (
            <div
              key={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
              data-tip={agg.tooltip}
              data-for={this.props.tooltipID}
              data-delay-show={1000}
              data-place='top'
            >
              <p>
                <input
                  key={`react-autoql-radio-input-${this.COMPONENT_KEY}-${uuid()}`}
                  id={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                  name={`react-autoql-radio-${this.COMPONENT_KEY}`}
                  type='radio'
                  defaultChecked={aggType === agg.value}
                />
                <label
                  htmlFor={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                  onClick={() => this.onAggTypeCheck(agg.value)}
                >
                  {agg.displayName} <em style={{ letterSpacing: '1px' }}>({aggHTMLCodes[agg.value]})</em>
                </label>
              </p>
            </div>
          )
        })}
      </div>
    )
  }

  getCheckedIndices = (type, columns = this.state.checkedColumns) => {
    const checkedColumns = columns?.filter((index) => this.state.columns[index].type === type)
    return checkedColumns?.length ? checkedColumns : undefined
  }

  isColumnChecked = (col) => {
    return !!col && this.state.checkedColumns?.includes(Number(col.field))
  }

  getColumnsOfType = (type) => {
    const columns = this.state.columns?.filter((col) => col.type === type)
    return columns
  }

  getQuantityColumns = (selected) => {
    let quantityColumns = this.state.columns?.filter((col) => col.type === COLUMN_TYPES.QUANTITY)
    if (selected) {
      return quantityColumns?.filter((col) => this.isColumnChecked(col))
    }

    return quantityColumns
  }

  getRatioColumns = (selected) => {
    let ratioColumns = this.state.columns?.filter((col) => col.type === COLUMN_TYPES.RATIO)
    if (selected) {
      return ratioColumns?.filter((col) => this.isColumnChecked(col))
    }

    return ratioColumns
  }

  getSelectableListItems = (type) => {
    const { columns } = this.state
    const items = []

    const otherAxisColumns = this.getOtherAxisColumns()

    columns.forEach((col, i) => {
      if (col.type !== type || !col.is_visible || col.pivot) {
        return
      }

      const checked = this.state.checkedColumns.includes(i)
      const disabled = otherAxisColumns.includes(i)

      const item = {
        key: `selectable-list-item-${this.COMPONENT_KEY}-${type}-${i}`,
        content: (
          <div key={`column-agg-type-symbol-${this.COMPONENT_KEY}`}>
            {!this.props.isAggregation && col.aggType && (
              <Select
                className='agg-type-symbol'
                popupClassname='agg-type-symbol-select'
                popoverParentElement={this.popoverContentRef}
                popoverBoundaryElement={this.props.popoverParentElement}
                rebuildTooltips={this.props.rebuildTooltips}
                tooltipID={this.props.tooltipID}
                value={col.aggType}
                align='start'
                size='small'
                options={AGG_TYPES.map((agg) => {
                  return {
                    value: agg.value,
                    label: aggHTMLCodes[agg.value],
                    listLabel: (
                      <span>
                        <span className='agg-select-list-symbol'>{aggHTMLCodes[agg.value]}</span>
                        {agg.displayName}
                      </span>
                    ),
                    tooltip: agg.tooltip,
                  }
                })}
                onChange={(value) => {
                  this.onAggTypeSelect(value, col)
                }}
              />
            )}
            {col.title}
          </div>
        ),
        disabled,
        checked,
        columnIndex: i,
      }

      items.push(item)
    })

    return items
  }

  getOtherAxisColumns = () => {
    return this.props.isSecondAxis ? this.props.numberColumnIndices : this.props.numberColumnIndices2
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
    return (
      !areAllDisabled &&
      this.state.columns.every(
        (col, i) => type !== col.type || this.state.checkedColumns.includes(i) || otherAxisColumns.includes(i),
      )
    )
  }

  onColumnSelection = (selected, selectedColumns) => {
    const selectedColumnIndices = selectedColumns.map((col) => col.columnIndex)
    this.setState({ selectedColumns: selectedColumnIndices })
  }

  onColumnCheck = (columns, changedColumns, checked, columnType) => {
    const { checkedColumns } = this.state

    const newCheckedColumns = [...checkedColumns]
    columns.forEach((col) => {
      const indexOfCheckedColumns = newCheckedColumns.indexOf(col.columnIndex)
      if (col.checked && indexOfCheckedColumns === -1) {
        newCheckedColumns.push(col.columnIndex)
      } else if (!col.checked && indexOfCheckedColumns > -1) {
        newCheckedColumns.splice(indexOfCheckedColumns, 1)
      }
    })

    this.setState({
      activeNumberType: COLUMN_TYPES.CURRENCY,
      checkedColumns: newCheckedColumns,
    })
  }

  renderSelectorContent = () => {
    if (this.props.hidden) {
      return null
    }

    const maxHeight = 300
    const minHeight = 100

    return (
      <div
        ref={(r) => (this.popoverContentRef = r)}
        className='chata-chart-popover number-axis-selector-popover'
        // onClick={(e) => e.stopPropagation()}
      >
        <div className='number-axis-selector-popover-content'>
          {this.renderSeriesSelector(minHeight, maxHeight)}
          {this.renderApplyButton()}
        </div>
      </div>
    )
  }

  renderSeriesSelector = (minHeight, maxHeight) => {
    const currencyColumns = this.getColumnsOfType(COLUMN_TYPES.CURRENCY)
    const currencyListItems = this.getSelectableListItems(COLUMN_TYPES.CURRENCY)
    const allCurrencyChecked = this.getAllChecked(COLUMN_TYPES.CURRENCY)
    const allCurrencyDisabled = this.areAllDisabled(COLUMN_TYPES.CURRENCY)

    const quantityColumns = this.getColumnsOfType(COLUMN_TYPES.QUANTITY)
    const quantityListItems = this.getSelectableListItems(COLUMN_TYPES.QUANTITY)
    const allQuantityChecked = this.getAllChecked(COLUMN_TYPES.QUANTITY)
    const allQuantityDisabled = this.areAllDisabled(COLUMN_TYPES.QUANTITY)

    const ratioColumns = this.getColumnsOfType(COLUMN_TYPES.RATIO)
    const ratioListItems = this.getSelectableListItems(COLUMN_TYPES.RATIO)
    const allRatioChecked = this.getAllChecked(COLUMN_TYPES.RATIO)
    const allRatioDisabled = this.areAllDisabled(COLUMN_TYPES.RATIO)

    return (
      <div className='axis-series-selector'>
        <div className='number-selector-field-group-container'>
          {!!currencyColumns.length && (
            <div className='number-selector-field-group'>
              <div className='number-selector-header'>
                <div className='number-selector-header-title'>
                  {this.state.columns && this.props.legendColumn !== undefined ? (
                    <span>{this.props.legendColumn.display_name}</span>
                  ) : (
                    <span>Currency Fields</span>
                  )}
                </div>
                <div>
                  <Checkbox
                    checked={allCurrencyChecked}
                    disabled={allCurrencyDisabled}
                    style={{ marginLeft: '10px' }}
                    onChange={() => {
                      if (allCurrencyChecked) {
                        this.currencySelectRef?.unCheckAll()
                      } else {
                        this.currencySelectRef?.checkAll()
                      }
                    }}
                  />
                </div>
              </div>
              <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
                <SelectableList
                  ref={(r) => (this.currencySelectRef = r)}
                  items={currencyListItems}
                  onSelect={this.onColumnSelection}
                  onChange={(allColumns, changedColumns, checked) =>
                    this.onColumnCheck(allColumns, changedColumns, checked, COLUMN_TYPES.CURRENCY)
                  }
                />
              </CustomScrollbars>
            </div>
          )}

          {!!quantityColumns.length && (
            <div className='number-selector-field-group'>
              <div className='number-selector-header'>
                <div className='number-selector-header-title'>
                  {this.state.columns && this.props.legendColumn !== undefined ? (
                    <span>{this.props.legendColumn.display_name}</span>
                  ) : (
                    <span>Quantity Fields</span>
                  )}
                </div>
                <div>
                  <Checkbox
                    checked={allQuantityChecked}
                    style={{ marginLeft: '10px' }}
                    disabled={allQuantityDisabled}
                    onChange={() => {
                      if (allQuantityChecked) {
                        this.quantitySelectRef?.unCheckAll()
                      } else {
                        this.quantitySelectRef?.checkAll()
                      }
                    }}
                  />
                </div>
              </div>
              <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
                <SelectableList
                  ref={(r) => (this.quantitySelectRef = r)}
                  items={quantityListItems}
                  onSelect={this.onColumnSelection}
                  onChange={(allColumns, changedColumns, checked) =>
                    this.onColumnCheck(allColumns, changedColumns, checked, COLUMN_TYPES.QUANTITY)
                  }
                />
              </CustomScrollbars>
            </div>
          )}

          {!!ratioColumns.length && (
            <div className='number-selector-field-group'>
              <div className='number-selector-header'>
                <div className='number-selector-header-title'>
                  {this.state.columns && this.props.legendColumn !== undefined ? (
                    <span>{this.props.legendColumn.display_name}</span>
                  ) : (
                    <span>Ratio Fields</span>
                  )}
                </div>
                <div>
                  Select All{' '}
                  <Checkbox
                    checked={allRatioChecked}
                    disabled={allRatioDisabled}
                    style={{ marginLeft: '10px' }}
                    onChange={() => {
                      if (allRatioChecked) {
                        this.ratioSelectRef?.unCheckAll()
                      } else {
                        this.ratioSelectRef?.checkAll()
                      }
                    }}
                  />
                </div>
              </div>
              <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
                <SelectableList
                  ref={(r) => (this.ratioSelectRef = r)}
                  items={ratioListItems}
                  onSelect={this.onColumnSelection}
                  onChange={(allColumns, changedColumns, checked) =>
                    this.onColumnCheck(allColumns, changedColumns, checked, COLUMN_TYPES.RATIO)
                  }
                />
              </CustomScrollbars>
            </div>
          )}
        </div>
      </div>
    )
  }

  renderApplyButton = () => {
    return (
      <div className='axis-selector-apply-btn-container'>
        <Button
          className='axis-selector-apply-btn'
          type='primary'
          disabled={!this.state.checkedColumns?.length}
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
    return (
      <Popover
        id={`number-axis-selector-${this.COMPONENT_KEY}`}
        isOpen={this.props.isOpen}
        content={this.renderSelectorContent()}
        ref={this.props.axisSelectorRef}
        onClickOutside={(e) => {
          e.stopPropagation()
          e.preventDefault()
          this.props.closeSelector()
        }}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
        reposition={true}
        padding={10}
      >
        {this.props.children}
      </Popover>
    )
  }
}
