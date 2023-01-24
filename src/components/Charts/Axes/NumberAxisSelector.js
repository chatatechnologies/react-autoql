import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'
import { Popover } from 'react-tiny-popover'
import { SelectableList } from '../../SelectableList'
import { Button } from '../../Button'
// import { axesDefaultProps, axesPropTypes, dataStructureChanged } from '../helpers'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Checkbox } from '../../Checkbox'
import { AGG_TYPES, COLUMN_TYPES } from '../../../js/Constants'
// import { dataConfigType } from '../../../props/types'
// import { dataConfigDefault } from '../../../props/defaults'
// import { deepEqual, difference } from '../../../js/Util'

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
      isOpen: false,
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

  shouldComponentUpdate = (nextProps, nextState) => {
    return true
    // return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

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
    const checkedColumns1 = props.numberColumnIndices ?? []
    const checkedColumns2 = props.numberColumnIndices2 ?? []
    return [...checkedColumns1, ...checkedColumns2]
  }

  openSelector = () => {
    this.setState({ isOpen: true })
  }

  closeSelector = () => {
    if (this.state.isOpen) {
      this.setState({ isOpen: false, selectedColumns: [] })
    }
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

  getCheckedIndices = (type) => {
    const checkedColumns = this.state.checkedColumns?.filter((index) => this.state.columns[index].type === type)
    return checkedColumns?.length ? checkedColumns : undefined
  }

  isColumnChecked = (col) => {
    return !!col && this.state.checkedColumns?.includes(Number(col.field))
  }

  getCurrencyColumns = () => {
    let currencyColumns = this.state.columns?.filter((col) => col.type === COLUMN_TYPES.CURRENCY)
    return currencyColumns
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

    columns.forEach((col, i) => {
      if (col.type !== type || !col.is_visible || col.pivot) {
        return
      }

      const checked = this.state.checkedColumns.includes(i)

      const aggTooltip = AGG_TYPES.find((agg) => agg.value === col.aggType)?.tooltip

      const item = {
        content: (
          <div>
            <div
              className='agg-type-symbol'
              data-tip={aggTooltip}
              data-for={this.props.tooltipID}
              data-delay-show={800}
              data-place='top'
            >
              {aggHTMLCodes[col.aggType]}
            </div>
            {col.title}
          </div>
        ),
        checked,
        columnIndex: i,
      }

      items.push(item)
    })

    return items
  }

  getAllChecked = (type) => {
    return this.state.columns.every((col, i) => type !== col.type || this.state.checkedColumns.includes(i))
  }

  onColumnSelection = (selected, selectedColumns) => {
    const selectedColumnIndices = selectedColumns.map((col) => col.columnIndex)
    this.setState({ selectedColumns: selectedColumnIndices })
  }

  onColumnCheck = (columns) => {
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

    let maxHeight = 300
    const minHeight = 75
    const padding = 100

    const chartHeight = this.props.chartContainerRef?.clientHeight
    if (chartHeight && chartHeight > minHeight + padding) {
      maxHeight = chartHeight - padding
    } else if (chartHeight && chartHeight < minHeight + padding) {
      maxHeight = minHeight
    }

    if (maxHeight > Window.innerHeight) {
      maxHeight = Window.innerHeight
    }

    return (
      <div
        id='chata-chart-popover'
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className='axis-selector-container'>
          {this.renderSeriesSelector(minHeight, maxHeight)}
          {this.renderAggSelector(minHeight, maxHeight)}
        </div>

        <div className='axis-selector-apply-btn'>
          <Button
            style={{ width: 'calc(100% - 10px)' }}
            type='primary'
            disabled={!this.state.checkedColumns?.length}
            onClick={() => {
              let checkedCurrencyIndices = this.getCheckedIndices(COLUMN_TYPES.CURRENCY)
              let checkedQuantityIndices = this.getCheckedIndices(COLUMN_TYPES.QUANTITY)
              let checkedRatioIndices = this.getCheckedIndices(COLUMN_TYPES.RATIO)

              const numberColumnIndices = checkedCurrencyIndices ?? checkedQuantityIndices ?? checkedRatioIndices ?? []
              let numberColumnIndices2 = checkedQuantityIndices ?? checkedRatioIndices ?? []
              if (_isEqual(numberColumnIndices, checkedQuantityIndices)) {
                numberColumnIndices2 = checkedRatioIndices ?? []
              }

              this.props.changeNumberColumnIndices(numberColumnIndices, numberColumnIndices2, this.state.columns)
              this.closeSelector()
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    )
  }

  renderSeriesSelector = (minHeight, maxHeight) => {
    const currencyColumns = this.getCurrencyColumns()
    const currencyListItems = this.getSelectableListItems(COLUMN_TYPES.CURRENCY)
    const allCurrencyChecked = this.getAllChecked(COLUMN_TYPES.CURRENCY)

    const quantityColumns = this.getQuantityColumns()
    const quantityListItems = this.getSelectableListItems(COLUMN_TYPES.QUANTITY)
    const allQuantityChecked = this.getAllChecked(COLUMN_TYPES.QUANTITY)

    const ratioColumns = this.getRatioColumns()
    const ratioListItems = this.getSelectableListItems(COLUMN_TYPES.RATIO)
    const allRatioChecked = this.getAllChecked(COLUMN_TYPES.RATIO)

    return (
      <div className='axis-series-selector'>
        <h4>Fields</h4>
        <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
          {!!currencyColumns.length && (
            <Fragment>
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
              <SelectableList
                ref={(r) => (this.currencySelectRef = r)}
                items={currencyListItems}
                onSelect={this.onColumnSelection}
                onChange={this.onColumnCheck}
              />
            </Fragment>
          )}

          {!!quantityColumns.length && (
            <Fragment>
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
              <SelectableList
                ref={(r) => (this.quantitySelectRef = r)}
                items={quantityListItems}
                onSelect={this.onColumnSelection}
                onChange={this.onColumnCheck}
              />
            </Fragment>
          )}

          {!!ratioColumns.length && (
            <Fragment>
              <div className='number-selector-header'>
                <div className='number-selector-header-title'>
                  {this.state.columns && this.props.legendColumn !== undefined ? (
                    <span>{this.props.legendColumn.display_name}</span>
                  ) : (
                    <span>Ratio Fields</span>
                  )}
                </div>
                <div>
                  <Checkbox
                    checked={allRatioChecked}
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
              <SelectableList
                ref={(r) => (this.ratioSelectRef = r)}
                items={ratioListItems}
                onSelect={this.onColumnSelection}
                onChange={this.onColumnCheck}
              />
            </Fragment>
          )}
        </CustomScrollbars>
      </div>
    )
  }

  renderAggSelector = (minHeight, maxHeight) => {
    const { selectedColumns, columns } = this.state

    return (
      <div className='axis-agg-type-selector'>
        <h4>Aggregate Type</h4>
        <div className='agg-type-selector-fields'>
          {selectedColumns.length === 1 ? (
            <span>{columns[selectedColumns[0]]?.display_name}</span>
          ) : (
            <span>
              {selectedColumns.map((colIndex, i) => {
                return (
                  <span key={`selected-field-${i}`}>{`${columns[colIndex].display_name}${
                    i !== selectedColumns.length - 1 ? ', ' : ''
                  }`}</span>
                )
              })}
            </span>
          )}
        </div>
        <CustomScrollbars autoHide={false} autoHeight autoHeightMin={minHeight} autoHeightMax={maxHeight}>
          {this.renderAggRadioGroup()}
        </CustomScrollbars>
      </div>
    )
  }

  render = () => {
    return (
      <Popover
        isOpen={this.state.isOpen}
        ref={(r) => (this.popoverRef = r)}
        content={this.renderSelectorContent}
        onClickOutside={this.closeSelector}
        parentElement={this.props.popoverParentElement}
        boundaryElement={this.props.popoverParentElement}
        positions={this.props.positions}
        align={this.props.align}
        reposition={true}
        padding={10}
      >
        <rect
          // {...this.props.childProps}
          className={`axis-label-border ${this.props.hidden ? 'hidden' : ''}`}
          data-test='axis-label-border'
          onClick={this.openSelector}
          fill='transparent'
          stroke='transparent'
          strokeWidth='1px'
          rx='4'
        />
      </Popover>
    )
  }
}
