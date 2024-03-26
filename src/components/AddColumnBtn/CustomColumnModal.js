import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'

import {
  ColumnObj,
  deepEqual,
  ColumnTypes,
  COLUMN_TYPES,
  getVisibleColumns,
  formatQueryColumns,
  isColumnNumberType,
  autoQLConfigDefault,
  authenticationDefault,
  dataFormattingDefault,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Input } from '../Input'
import { Button } from '../Button'
import { Select } from '../Select'
import ChataTable from '../ChataTable/ChataTable'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import { operators, createMutatorFn } from './customColumnHelpers'

import './CustomColumnModal.scss'

const globalOperators = ['LEFT_BRACKET', 'RIGHT_BRACKET']

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
    this.numberInputRefs = {}

    const firstIndex = props.columns.findIndex((col) => col.is_visible && isColumnNumberType(col))
    const initialColumn = props.columns[firstIndex]

    const initialColumnFn = []

    this.newColumnRaw = this.getRawColumnParams(initialColumn)

    const initialMutator = createMutatorFn(initialColumnFn)
    this.previousMutator = initialMutator

    this.newColumn = new ColumnObj({
      ...this.newColumnRaw,
      fnSummary: `= ${initialColumn?.display_name}`,
      mutator: initialMutator,
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
      columnType: 'auto',
      isFnValid: false,
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
    if (!deepEqual(this.state.columnFn, prevState.columnFn) || this.state.columnType !== prevState.columnType) {
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

  isValueEmpty = (value) => {
    return value === null || value === undefined || value === ''
  }

  getFnSummary = (columnFn) => {
    return `= ${columnFn[0]?.column?.display_name ?? ''}`
  }

  getRawColumnParams = (col) => {
    return {
      name: '',
      display_name: this.state?.columnName ?? DEFAULT_COLUMN_NAME,
      type: col?.type,
      drill_down: col?.drill_down,
      dow_style: col?.dow_style,
      alt_name: col?.alt_name,
      is_visible: true,
    }
  }

  updateTabulatorColumnFn = () => {
    const columns = _cloneDeep(this.state.columns)

    const { columnFn, columnType } = this.state

    // ----- If function threw an error, use the most recent working function ------
    let newMutator = createMutatorFn(columnFn)
    let newFnSummary = this.getFnSummary(columnFn)

    if (!newMutator || newMutator?.error?.message) {
      const fnError = newMutator?.error?.message
      newMutator = this.previousMutator
      newFnSummary = this.previousFnSummary
      this.setState({ isFnValid: false, fnError })
      return
    } else {
      this.previousMutator = newMutator
      this.previousFnSummary = newFnSummary
      this.setState({ isFnValid: true, fnError: undefined })
    }

    const newParams = {
      mutator: newMutator,
      fnSummary: newFnSummary,
    }
    // -----------------------------------------------------------------------------

    if (columnType === 'auto') {
      newParams.type = this.getColumnType()
    } else if (columnType) {
      newParams.type = columnType
    }

    const columnForFn = columnFn[0]?.column

    const newColumns = columns.map((col) => {
      if (col.field === this.newColumn?.field) {
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

    this.setState({ columns: newColumns })
  }

  onAddColumnConfirm = () => {
    const newColumns = _cloneDeep(this.props.columns)
    newColumns.push(this.newColumn)

    this.props.onConfirm(newColumns, this.newColumn, this.state.columnFn)
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

  getFnColumns = () => {
    return this.state.columnFn.filter((chunk) => chunk.column).map((chunk) => chunk.column)
  }

  getSupportedColumnTypes = () => {
    const selectedColumns = this.getFnColumns()

    if (selectedColumns.every((col) => isColumnNumberType(col))) {
      return Object.keys(COLUMN_TYPES).filter((type) => COLUMN_TYPES[type].isNumber)
    }

    return [ColumnTypes.STRING]
  }

  getColumnType = () => {
    const selectedColumnTypes = this.getFnColumns()?.map((col) => col.type)

    if (!selectedColumnTypes?.length && this.state.columnFn.find((chunk) => chunk.type === 'number')) {
      return ColumnTypes.QUANTITY
    }

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
      // If any of the number columns are a currency, return currency
      if (selectedColumnTypes.find((colType) => colType === ColumnTypes.DOLLAR_AMT)) {
        return ColumnTypes.DOLLAR_AMT
      }

      // If column is a number type but there is no currency, just display as a "quantity" with no units
      return ColumnTypes.QUANTITY
    }

    return ColumnTypes.STRING
  }

  shouldDisableOperator = (op) => {
    const { columnFn } = this.state
    const lastTerm = columnFn[columnFn.length - 1]

    if (globalOperators.includes(op)) {
      if (op === 'LEFT_BRACKET') {
        if (!lastTerm) {
          return false
        }

        if (lastTerm?.value === 'RIGHT_BRACKET' || lastTerm?.type !== 'operator') {
          // Do not allow an opening bracket right after an closing bracket
          // Do not allow an opening bracket right after a column or number
          return true
        }
      }

      if (op === 'RIGHT_BRACKET') {
        if (lastTerm?.value === 'LEFT_BRACKET' || lastTerm?.type === 'operator') {
          // Do not allow a closing bracket right after an opening bracket
          // Do not allow a closing bracket right after an operator
          return true
        }

        const numRightBrackets = columnFn.filter((chunk) => chunk.value === 'RIGHT_BRACKET')?.length
        const numLeftBrackets = columnFn.filter((chunk) => chunk.value === 'LEFT_BRACKET')?.length
        if (numRightBrackets >= numLeftBrackets) {
          // Do not allow more closing brackets than opening brackets
          return true
        }
      }
    } else if (lastTerm?.type === 'operator' && lastTerm?.value !== 'RIGHT_BRACKET') {
      return true
    }

    return false
  }

  getNextSupportedOperators = () => {
    const columnType = this.getColumnType()
    const supportedOperators = COLUMN_TYPES[columnType]?.supportedOperators ?? []

    return [...supportedOperators, ...globalOperators]
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
    const supportedColumnTypes = this.getSupportedColumnTypes()
    const currentColumnType = COLUMN_TYPES[this.getColumnType()]?.description

    return (
      <Select
        label='Formatting'
        className='custom-column-builder-type-selector'
        options={[
          {
            value: 'auto',
            label: (
              <span>
                Auto
                {!!currentColumnType && (
                  <em style={{ color: 'var(--react-autoql-text-color-placeholder)' }}> ({currentColumnType})</em>
                )}
              </span>
            ),
          },
          ...supportedColumnTypes.map((type) => ({
            value: type,
            label: COLUMN_TYPES[type]?.description,
          })),
          // Todo: Add custom option to use excel type shapes
          // {
          //   value: 'custom',
          //   label: 'Custom...'
          // }
        ]}
        value={this.state.columnType ?? this.getColumnType()}
        onChange={(columnType) => this.setState({ columnType })}
      />
    )
  }

  renderOperatorDeleteBtn = (chunkIndex) => {
    return (
      <Button
        className='react-autoql-operator-delete-btn'
        onClick={() => {
          const columnFn = this.state.columnFn.filter((chunk, i) => i !== chunkIndex)
          this.setState({ columnFn })
        }}
      >
        <Icon type='close' />
      </Button>
    )
  }

  renderCustomNumberInput = (chunk, i) => {
    return (
      <Input
        type='number'
        showSpinWheel={false}
        placeholder='Type a number'
        ref={(r) => (this.numberInputRefs[chunk.id] = r)}
        onChange={(e) => {
          clearTimeout(this.inputDebounceTimer)
          this.inputDebounceTimer = setTimeout(() => {
            let value = e.target.value

            const columnFn = _cloneDeep(this.state.columnFn)
            columnFn[i].value = value ? parseFloat(value) : value
            this.setState({ columnFn })
          }, 500)
        }}
      />
    )
  }

  renderAvailableColumnSelector = (chunk, i) => {
    const selectableColumns = getSelectableColumns(this.props.columns)
    return (
      <Select
        key={`custom-column-select-${i}`}
        placeholder='Select a Column'
        value={chunk.value}
        className={`react-autoql-available-column-selector ${chunk.operator ? 'has-operator' : 'first-chunk'}`}
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
  }

  renderOperator = (chunk, i) => {
    const supportedOperators = this.getNextSupportedOperators().filter((op) => !globalOperators.includes(op))

    if (globalOperators.includes(chunk.value) || !supportedOperators.includes(chunk.value)) {
      return <span style={{ color: 'var(--react-autoql-accent-color)' }}>{operators[chunk.value].label}</span>
    }

    return (
      <Select
        value={chunk.value}
        onChange={(operator) => {
          const columnFn = _cloneDeep(this.state.columnFn)
          columnFn[i].value = operator
          this.setState({ columnFn })
        }}
        options={supportedOperators.map((op) => {
          return {
            value: op,
            label: operators[op].label,
            listLabel: operators[op].label,
          }
        })}
      />
    )
  }

  renderColumnFnChunk = (chunk, i) => {
    let chunkElement

    if (chunk.type === 'number') {
      chunkElement = this.renderCustomNumberInput(chunk, i)
    } else if (chunk.type === 'column') {
      chunkElement = this.renderAvailableColumnSelector(chunk, i)
    } else if (chunk.type === 'operator') {
      chunkElement = this.renderOperator(chunk, i)
    }

    return (
      <span key={`column-fn-chunk-${i}`} className='react-autoql-operator-select-wrapper'>
        {chunkElement}
        {this.renderOperatorDeleteBtn(i)}
      </span>
    )
  }

  renderColumnFnBuilder = () => {
    const supportedOperators = this.getNextSupportedOperators()
    const columnFn = _cloneDeep(this.state.columnFn)
    const lastTerm = columnFn[columnFn.length - 1]

    return (
      <div className='react-autoql-formula-builder-wrapper'>
        <div className='react-autoql-formula-builder-section'>
          <div className='react-autoql-formula-builder-label-container'>
            <div className='react-autoql-input-label'>Column Formula</div>
            <div
              className='react-autoql-input-label react-autoql-input-label-clickable'
              onClick={() => this.setState({ columnFn: [] })}
            >
              Clear All
            </div>
          </div>
          <div className='react-autoql-formula-builder-container'>
            <div className='react-autoql-formula-builder-button-wrapper'>
              <span className='react-autoql-operator-select-wrapper'>=</span>
              {this.state.columnFn.map((chunk, i) => {
                return this.renderColumnFnChunk(chunk, i)
              })}
            </div>
          </div>
          {!!this.state.columnFn?.length && (
            <div className='react-autoql-formula-builder-validation-message'>
              {!!this.state.fnError ? (
                <span className='react-autoql-formula-builder-validation-message-warning'>
                  <Icon type='warning-triangle' warning /> {this.state.fnError}
                </span>
              ) : (
                <span className='react-autoql-formula-builder-validation-message-success'>
                  <Icon type='check' success /> Valid
                </span>
              )}
            </div>
          )}
        </div>
        <div className='react-autoql-formula-builder-column-selection-container'>
          <div className='react-autoql-input-label'>Variables</div>
          <div className='react-autoql-formula-builder-calculator-buttons-container'>
            {getSelectableColumns(this.props.columns)?.map((col, i) => {
              return (
                <Button
                  key={`react-autoql-column-select-button-${i}`}
                  className='react-autoql-formula-calculator-button'
                  icon='table'
                  disabled={
                    lastTerm?.type === 'column' || lastTerm?.type === 'number' || lastTerm?.value === 'RIGHT_BRACKET'
                  }
                  onClick={() => {
                    const newChunk = {
                      type: 'column',
                      value: col.field,
                      column: col,
                    }

                    if (lastTerm && lastTerm.type !== 'operator') {
                      // Replace current variable
                      columnFn[columnFn.length - 1] = newChunk
                    } else {
                      // Add new variable
                      columnFn.push(newChunk)
                    }

                    this.setState({ columnFn })
                  }}
                >
                  {col.display_name}
                </Button>
              )
            })}
            <Button
              key={`react-autoql-column-select-button-custom-number`}
              className='react-autoql-formula-calculator-button'
              disabled={
                lastTerm?.type === 'column' || lastTerm?.type === 'number' || lastTerm?.value === 'RIGHT_BRACKET'
              }
              icon='number'
              onClick={() => {
                const newChunk = {
                  type: 'number',
                  value: undefined,
                  id: uuid(),
                }

                if (lastTerm && lastTerm.type !== 'operator') {
                  // Replace current variable
                  columnFn[columnFn.length - 1] = newChunk
                } else {
                  // Add new variable
                  columnFn.push(newChunk)
                }

                this.setState({ columnFn }, () => {
                  // Focus number input after adding it
                  this.numberInputRefs[newChunk.id]?.focus()
                })
              }}
            >
              Custom Number...
            </Button>
          </div>
        </div>
        <div className='react-autoql-formula-builder-calculator-container'>
          <div className='react-autoql-input-label'>Operators</div>
          <div className='react-autoql-formula-builder-calculator-buttons-container'>
            {supportedOperators?.map((op) => {
              return (
                <Button
                  key={`react-autoql-formula-calculator-button-${op}`}
                  className='react-autoql-formula-calculator-button'
                  disabled={this.shouldDisableOperator(op)}
                  onClick={() => {
                    const newChunk = {
                      type: 'operator',
                      value: op,
                    }

                    if (
                      lastTerm &&
                      lastTerm?.type === 'operator' &&
                      lastTerm?.value !== 'RIGHT_BRACKET' &&
                      op !== 'LEFT_BRACKET'
                    ) {
                      // Replace current operator
                      columnFn[columnFn.length - 1] = newChunk
                    } else {
                      // Add new operator
                      columnFn.push(newChunk)
                    }

                    this.setState({ columnFn })
                  }}
                >
                  {operators[op].label}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  renderTablePreview = () => {
    return (
      <div className='react-autoql-table-preview-wrapper'>
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
      </div>
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
          confirmDisabled={!this.state.isFnValid}
        >
          <div className='custom-column-modal'>
            <div className='custom-column-modal-form-wrapper'>
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
