import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  deepEqual,
  getVisibleColumns,
  COLUMN_TYPES,
  ColumnTypes,
  formatQueryColumns,
  ColumnObj,
  isColumnNumberType,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Input } from '../Input'
import { Button } from '../Button'
import { Select } from '../Select'
import ChataTable from '../ChataTable/ChataTable'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './CustomColumnModal.scss'

const operators = {
  CONCAT: {
    value: 'CONCAT',
    label: 'Concatenate(...)',
  },
  ADDITION: {
    value: '',
    label: '+',
  },
  SUBTRACTION: {
    value: '',
    label: '-',
  },
  MULTIPLICATION: {
    value: '',
    label: 'x',
  },
  DIVISION: {
    value: '',
    label: '/',
  },
}

const HIGHLIGHTED_CLASS = 'highlighted-column'
const DISABLED_CLASS = 'disabled-column'
const FORMULA_CLASS = 'formula-column'
const DEFAULT_COLUMN_NAME = 'New Column'

export const getSelectableColumns = (columns) => {
  return getVisibleColumns(columns).filter((col) => isColumnNumberType(col))
}

export default class CustomColumnModal extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()

    const firstIndex = props.columns.findIndex((col) => col.is_visible && isColumnNumberType(col))
    const initialColumn = props.columns[firstIndex]

    const initialColumnFn = [
      {
        type: 'column',
        value: initialColumn.field,
        column: initialColumn,
      },
    ]

    this.newColumnRaw = this.getRawColumnParams(initialColumn)

    this.newColumn = new ColumnObj({
      ...this.newColumnRaw,
      fnSummary: `= ${initialColumn?.display_name}`,
      mutator: this.getFnMutator(initialColumnFn),
      field: `${props.columns?.length}`,
      index: props.columns?.length,
      custom: true,
    })

    const formattedColumn = this.getColumnParamsForTabulator(this.newColumn, props)
    formattedColumn.cssClass = HIGHLIGHTED_CLASS

    this.newColumn = formattedColumn

    this.state = {
      columns: [...props.columns, this.newColumn],
      columnName: DEFAULT_COLUMN_NAME,
      columnFn: initialColumnFn,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    onConfirm: PropTypes.func,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    onConfirm: () => {},
    onClose: () => {},
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.columnName && this.state.columnName !== prevState.columnName) {
      const name = this.state.columnName
      this.newColumn.display_name = name
      this.newColumn.title = name

      // Debounce change since column update is expensive
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.tableRef?.updateColumn?.(this.newColumn.field, this.newColumn)
      }, 500)
    }

    // Update column mutator is function changed
    if (!deepEqual(this.state.columnFn, prevState.columnFn)) {
      setTimeout(() => {
        this.updateTabulatorColumnFn()
      }, 0)
    }

    // Update header tooltips if column changed
    if (!deepEqual(this.state.columns, prevState.columns)) {
      this.tableRef?.setHeaderInputEventListeners(this.state.columns)
    }
  }

  getColumnParamsForTabulator = (column, providedProps) => {
    const props = providedProps ?? this.props
    const columns = _cloneDeep(props.columns)

    const index = this.newColumn.index
    columns[index] = column

    return formatQueryColumns({
      columns,
      aggConfig: props.aggConfig,
      queryResponse: props.queryResponse,
      dataFormatting: props.dataFormatting,
    })?.[index]
  }

  getFnMutator = (columnFn) => {
    return (value, data, type, params, component) => {
      //value - original value of the cell
      //data - the data for the row
      //type - the type of mutation occurring  (data|edit)
      //params - the mutatorParams object from the column definition
      //component - when the "type" argument is "edit", this contains the cell component for the edited cell, otherwise it is the column component for the column
      return data[columnFn[0].column?.index] //return the sum of the other two columns.
    }
  }

  getFnSummary = (columnFn) => {
    return `= ${columnFn[0].column?.display_name}`
  }

  getRawColumnParams = (col) => {
    return {
      name: '',
      display_name: this.state?.columnName ?? DEFAULT_COLUMN_NAME,
      type: col.type,
      drill_down: col.drill_down,
      dow_style: col.dow_style,
      alt_name: col.alt_name,
    }
  }

  updateTabulatorColumnFn = () => {
    const columns = _cloneDeep(this.state.columns)

    const { columnFn } = this.state

    const newParams = {
      mutator: this.getFnMutator(columnFn),
      fnSummary: this.getFnSummary(columnFn),
    }

    const columnForFn = columnFn[0]?.column

    const newColumns = columns.map((col) => {
      if (col.field === this.newColumn.field) {
        const newColFormatted = new ColumnObj(
          this.getColumnParamsForTabulator({
            ...this.getRawColumnParams(columnForFn),
            ...newParams,
          }),
        )

        newColFormatted.cssClass = HIGHLIGHTED_CLASS

        this.newColumn = newColFormatted

        return newColFormatted
      }
      return col
    })

    // this.tableRef?.updateColumn?.(this.newColumn.field, newParams)

    this.setState({ columns: newColumns })
  }

  onAddColumnConfirm = () => {
    const newColumns = _cloneDeep(this.props.columns)
    newColumns.push(this.newColumn)

    this.props.onConfirm(newColumns)
  }

  changeChunkValue = (value, type, i) => {
    if (type === 'column') {
      const column = this.props.columns.find((col) => col.field === value)
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].value = value
        columnFn[i].column = column
      }

      this.setState({ columnFn })
    }
  }

  getColumnType = () => {
    const selectedColumnTypes = this.state.columnFn
      .filter((chunk) => chunk.type === 'column')
      .map((chunk) => chunk.column?.type)

    // If all columns are the same, return that type
    if (selectedColumnTypes.every((colType) => colType === selectedColumnTypes[0])) {
      return selectedColumnTypes[0]
    }

    if (selectedColumnTypes.find((colType) => colType === ColumnTypes.STRING)) {
      // If even one column selected is a string type, the output must be string type
      return ColumnTypes.STRING
    } else if (
      selectedColumnTypes.every(
        (colType) =>
          colType === ColumnTypes.DOLLAR_AMT ||
          colType === ColumnTypes.QUANTITY ||
          colType === ColumnTypes.RATIO ||
          colType === ColumnTypes.PERCENT,
      )
    ) {
      // If column is a number type, just display as a "quantity" with no units
      return ColumnTypes.QUANTITY
    }

    return ColumnTypes.STRING
  }

  getNextSupportedOperator = () => {
    const columnType = this.getColumnType()
    return COLUMN_TYPES[columnType].supportedOperators
  }

  renderColumnNameInput = () => {
    return (
      <Input
        ref={(r) => (this.inputRef = r)}
        fullWidth
        focusOnMount
        label='Column Name'
        placeholder='eg. "Difference"'
        value={this.state.columnName}
        onChange={(e) => this.setState({ columnName: e.target.value })}
      />
    )
  }

  renderColumnTypeSelector = () => {
    return (
      <Select
        label='Column Type'
        className='custom-column-builder-type-selector'
        options={Object.keys(COLUMN_TYPES).map((type) => ({
          value: COLUMN_TYPES[type].description,
        }))}
        value={this.state.columnType ?? COLUMN_TYPES[this.getColumnType()].description}
        onChange={(columnType) => this.setState({ columnType })}
      />
    )
  }

  renderNextAvailableOperator = () => {
    const supportedOperators = this.getNextSupportedOperator()

    if (!supportedOperators?.length) {
      return null
    } else if (supportedOperators?.length === 1) {
      return (
        <span className='react-autoql-operator-select-wrapper'>
          <Button className='react-autoql-operator-select-btn' icon='plus'>
            <span>{supportedOperators[0]}</span>
          </Button>
        </span>
      )
    } else {
      return (
        <span className='react-autoql-operator-select-wrapper'>
          <Select
            placeholder='Add Operator...'
            className='react-autoql-operator-select'
            value={this.state.operatorSelectValue}
            onChange={(operatorSelectValue) => this.setState({ operatorSelectValue })}
            options={supportedOperators.map((op) => {
              return {
                value: op,
                label: operators[op].label,
                listLabel: operators[op].label,
              }
            })}
          />
        </span>
      )
    }
  }

  renderColumnFnBuilder = () => {
    const selectableColumns = getSelectableColumns(this.props.columns)

    if (!selectableColumns?.length) {
      return null
    }

    return (
      <>
        <div className='react-autoql-input-label'>Column Formula</div>
        <div className='react-autoql-formula-builder-container'>
          <div className='react-autoql-formula-builder-button-wrapper'>
            <span>= </span>
            {this.state.columnFn.map((chunk, i) => {
              if (chunk.type === 'column') {
                return (
                  <Select
                    key={`custom-column-select-${i}`}
                    placeholder='Select a Column'
                    value={chunk.value}
                    onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
                    options={selectableColumns.map((col) => {
                      return {
                        value: col.field,
                        label: col.title,
                        listLabel: col.title,
                        icon: 'table',
                      }
                    })}
                  />
                )
              } else if (chunk.type === 'operator') {
              } else if (chunk.type === 'number') {
              }
            })}
            {this.renderNextAvailableOperator()}
          </div>
        </div>
      </>
    )
  }

  renderTablePreview = () => {
    return (
      <>
        <div className='react-autoql-input-label'>Preview</div>
        <div className='react-autoql-table-preview-container'>
          <ChataTable
            key={this.TABLE_ID}
            ref={(r) => (this.tableRef = r)}
            authentication={this.props.authentication}
            dataFormatting={this.props.dataFormatting}
            response={this.props.response}
            queryRequestData={this.props.queryRequestData}
            popoverParentElement={this.props.popoverParentElement}
            tooltipID={this.props.tooltipID}
            columns={this.state.columns}
            useInfiniteScroll={false}
            supportsDrilldowns={false}
            keepScrolledRight={true}
            pageSize={10}
            tableOptions={{}}
            allowCustomColumns={false}
          />
        </div>
      </>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          className='custom-column-modal'
          title='Configure Custom Column'
          isVisible={this.props.isOpen}
          width='90vw'
          height='100vh'
          confirmText='Save Column'
          shouldRender={this.props.shouldRender}
          onClose={this.props.onClose}
          onConfirm={this.onAddColumnConfirm}
        >
          <div className='custom-column-modal'>
            <div>
              <div className='custom-column-modal-name-and-type'>
                {this.renderColumnNameInput()}
                {this.renderColumnTypeSelector()}
              </div>
              {this.renderColumnFnBuilder()}
            </div>
            {this.renderTablePreview()}
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
