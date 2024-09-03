import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'

import {
  ColumnObj,
  deepEqual,
  ColumnTypes,
  COLUMN_TYPES,
  formatQueryColumns,
  isColumnNumberType,
  autoQLConfigDefault,
  authenticationDefault,
  dataFormattingDefault,
  getColumnTypeAmounts,
  createMutatorFn,
  getFnSummary,
  WINDOW_FUNCTIONS,
  ORDERABLE_WINDOW_FN_TYPES,
  getOperators,
  GLOBAL_OPERATORS,
  FUNCTION_OPERATOR,
  HIGHLIGHTED_CLASS,
  DEFAULT_COLUMN_NAME,
  getSelectableColumns,
  getNumericalColumns,
  getStringColumns,
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

export default class CustomColumnModal extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.OPERATORS = getOperators(props.enableWindowFunctions)

    this.numberInputRefs = {}

    const firstIndex = props.columns.findIndex((col) => col?.is_visible && isColumnNumberType(col))

    let initialColumn = props.initialColumn
    if (!initialColumn && firstIndex >= 0) {
      initialColumn = props.columns[firstIndex]
    }

    const initialColumnFn = props.initialColumn?.columnFnArray ?? []

    this.newColumnRaw = this.getRawColumnParams(initialColumn, props.initialColumn?.display_name)

    const initialMutator = createMutatorFn(initialColumnFn)
    this.previousMutator = initialMutator

    if (props.initialColumn) {
      this.newColumn = _cloneDeep(props.initialColumn)
    } else {
      this.newColumn = new ColumnObj({
        ...this.newColumnRaw,
        id: uuid(),
        fnSummary: '',
        mutator: initialMutator,
        columnFnArray: initialColumnFn,
        field: `${props.columns?.length}`,
        index: props.columns?.length,
        custom: true,
        headerFilter: false,
        headerSort: false,
      })
    }

    const formattedColumn = this.getColumnParamsForTabulator(this.newColumn, props)
    formattedColumn.cssClass = HIGHLIGHTED_CLASS

    this.newColumn = formattedColumn

    let columns = _cloneDeep(props.columns)
    if (props.initialColumn) {
      const colIndex = columns.findIndex((col) => props.initialColumn.id === col.id)
      if (colIndex >= 0) {
        columns[colIndex] = this.newColumn
      }
    } else {
      columns.push(this.newColumn)
    }

    const numericalColumns = getNumericalColumns(props.columns)

    this.state = {
      columns,
      columnName: props.initialColumn?.display_name ?? DEFAULT_COLUMN_NAME,
      columnFn: initialColumnFn,
      columnType: props.initialColumn?.type ?? 'auto',
      isFnValid: !!props.initialColumn,

      isFunctionConfigModalVisible: false,
      selectedFnType: Object.keys(WINDOW_FUNCTIONS)[0],
      selectedFnColumn: numericalColumns?.[0]?.field,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    enableWindowFunctions: PropTypes.bool,

    onAddColumn: PropTypes.func,
    onUpdateColumn: PropTypes.func,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableWindowFunctions: false,

    onAddColumn: () => { },
    onUpdateColumn: () => { },
    onClose: () => { },
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

  getRawColumnParams = (col, columnName) => {
    return {
      name: '',
      display_name: columnName ?? this.state?.columnName ?? DEFAULT_COLUMN_NAME,
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
    let newFnSummary = getFnSummary(columnFn)

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
      columnFnArray: this.state.columnFn,
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
            id: this.props.initialColumn?.id,
            custom: true,
            headerSort: false,
            headerFilter: false,
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

  buildProtoTableColumn = (customColumn) => {
    if (customColumn?.columnFnArray) {
      let protoTableColumn = ''
      for (const columnFn of customColumn?.columnFnArray) {
        if (columnFn?.type === 'column') {
          protoTableColumn += columnFn?.column?.name
        } else if (columnFn?.type === 'operator') {
          protoTableColumn += this.OPERATORS[columnFn?.value]?.js
        } else if (columnFn?.type === 'number') {
          protoTableColumn += columnFn?.value || 0
        } else if (columnFn?.type === 'function') {
          protoTableColumn += columnFn?.value || ''
        } else {
          console.error('Unknown columnFn type')
        }
        protoTableColumn += ' '
      }

      return protoTableColumn
    }
    return ''
  }

  onUpdateColumnConfirm = () => {
    const newColumn = _cloneDeep(this.newColumn)
    newColumn.id = this.props.initialColumn?.id
    const protoTableColumn = this.buildProtoTableColumn(newColumn)
    this.props.onUpdateColumn({ ...newColumn, table_column: protoTableColumn })
  }

  onAddColumnConfirm = () => {
    const newColumn = _cloneDeep(this.newColumn)
    const protoTableColumn = this.buildProtoTableColumn(newColumn)
    this.props.onAddColumn({ ...newColumn, table_column: protoTableColumn })
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
    return this.state.columnFn?.filter((chunk) => chunk.column)?.map((chunk) => chunk.column)
  }

  getSupportedColumnTypes = () => {
    const selectedColumns = this.getFnColumns()

    if (selectedColumns.every((col) => isColumnNumberType(col))) {
      return Object.keys(COLUMN_TYPES).filter((type) => COLUMN_TYPES[type].isNumber)
    }

    return [ColumnTypes.STRING]
  }

  getLabelForOperator = (operator) => {
    return operator?.icon ? <Icon type={operator?.icon} /> : operator?.label
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

    // The window function option is only available to use if it is on its own, since the calculation is done on the server side
    if (lastTerm?.value === FUNCTION_OPERATOR) {
      return true
    }

    if (GLOBAL_OPERATORS.includes(op)) {
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
    } else if (op === FUNCTION_OPERATOR) {
      if (!lastTerm) {
        return false
      }

      // This option is only available to use if it is on its own, since the calculation is done on the server side
      // return true

      if (lastTerm?.value === 'RIGHT_BRACKET' || lastTerm?.type !== 'operator') {
        // Do not allow a function right after an closing bracket
        // Do not allow a function right after a column or number
        return true
      }
    } else if (
      lastTerm?.type === 'operator' &&
      lastTerm?.value !== 'RIGHT_BRACKET' &&
      lastTerm?.value !== FUNCTION_OPERATOR
    ) {
      return true
    }

    return false
  }

  getNextSupportedOperators = () => {
    const columnType = this.getColumnType()
    const supportedOperators = COLUMN_TYPES[columnType]?.supportedOperators ?? []
    const operatorsArray = [...supportedOperators, ...GLOBAL_OPERATORS]

    if (
      this.props.enableWindowFunctions &&
      getColumnTypeAmounts(this.props.queryResponse?.data?.data?.columns)?.amountOfNumberColumns
    ) {
      operatorsArray.push(FUNCTION_OPERATOR)
    }

    return operatorsArray
  }

  closeAddFunctionModal = () => {
    this.setState({
      isFunctionConfigModalVisible: false,
    })
  }

  onAddFunction = () => {
    const columnFn = _cloneDeep(this.state.columnFn)

    columnFn.push({
      type: 'function',
      fn: this.state.selectedFnType,
      column: this.props.columns.find((col) => col.field === this.state.selectedFnColumn),
      groupby: this.state.selectedFnGroupby,
      orderby: this.state.selectedFnOrderBy,
    })

    this.setState({
      isFunctionConfigModalVisible: false,
      columnFn,
    })
  }

  isFunctionConfigComplete = () => {
    return !!this.state.selectedFnType && !!this.state.selectedFnColumn
  }

  renderColumnNameInput = () => {
    return (
      <Input
        ref={(r) => (this.inputRef = r)}
        fullWidth
        focusOnMount
        label='Column Name'
        placeholder='eg. "Difference"'
        value={this.newColumn?.fnSummary || this.state.columnName}
        disabled={true}
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
        fullWidth={true}
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
    const columnFn = _cloneDeep(this.state.columnFn)

    return (
      <Input
        type='number'
        showSpinWheel={false}
        placeholder='eg. "10"'
        ref={(r) => (this.numberInputRefs[chunk.id] = r)}
        defaultValue={columnFn?.[i]?.value}
        style={{ width: '75px' }}
        onChange={(e) => {
          clearTimeout(this.inputDebounceTimer)
          this.inputDebounceTimer = setTimeout(() => {
            let value = e.target.value
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
        outlined={false}
        showArrow={false}
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

  renderWindowFnChunk = (chunk, i) => {
    return (
      <span>
        <span>{this.getLabelForOperator(WINDOW_FUNCTIONS[chunk.fn])}( </span>
        <Select
          key={`custom-column-select-${i}`}
          placeholder='Select a Column'
          value={chunk.column?.field}
          outlined={false}
          showArrow={false}
          className='react-autoql-available-column-selector'
          onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
          options={getNumericalColumns(this.props.columns).map((col) => {
            return {
              value: col.field,
              label: col.title,
              icon: 'table',
            }
          })}
        />
        {chunk.groupby ? (
          <>
            <span>, Grouped by </span>
            <Select
              key={`custom-column-select-${i}`}
              placeholder='Select a Column'
              value={chunk.groupby}
              outlined={false}
              showArrow={false}
              className='react-autoql-available-column-selector'
              onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
              options={getStringColumns(this.props.columns).map((col) => {
                return {
                  value: col.field,
                  label: col.title,
                  icon: 'table',
                }
              })}
            />
          </>
        ) : null}
        {chunk.orderby ? (
          <>
            <span>, Ordered by </span>
            <Select
              key={`custom-column-select-${i}`}
              placeholder='Select a Column'
              value={chunk.orderby}
              outlined={false}
              showArrow={false}
              className='react-autoql-available-column-selector'
              onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
              options={getStringColumns(this.props.columns).map((col) => {
                return {
                  value: col.field,
                  label: col.title,
                  icon: 'table',
                }
              })}
            />
          </>
        ) : null}{' '}
        )
      </span>
    )
  }

  renderOperator = (chunk, i) => {
    const supportedOperators = this.getNextSupportedOperators().filter((op) => !GLOBAL_OPERATORS.includes(op))

    if (GLOBAL_OPERATORS.includes(chunk.value) || !supportedOperators.includes(chunk.value)) {
      return <span>{this.getLabelForOperator(this.OPERATORS[chunk.value])}</span>
    }

    return (
      <Select
        outlined={false}
        showArrow={false}
        value={chunk.value}
        align='middle'
        onChange={(operator) => {
          const columnFn = _cloneDeep(this.state.columnFn)
          columnFn[i].value = operator
          this.setState({ columnFn })
        }}
        options={supportedOperators.map((op) => {
          return {
            value: op,
            label: this.getLabelForOperator(this.OPERATORS[op]),
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
    } else if (chunk.type === 'function') {
      chunkElement = this.renderWindowFnChunk(chunk, i)
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
            {getSelectableColumns(this.props.columns)
              ?.filter((col) => !col.custom)
              ?.map((col, i) => {
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
                    if (op === FUNCTION_OPERATOR) {
                      return this.setState({ isFunctionConfigModalVisible: true })
                    }

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
                  {this.getLabelForOperator(this.OPERATORS[op])}
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
            enableContextMenu={false}
            allowCustomColumns={false}
          />
        </div>
      </div>
    )
  }

  renderFunctionConfigModal = () => {
    const numericalColumns = getNumericalColumns(this.props.columns)
    const stringColumns = getStringColumns(this.props.columns)

    const stringColumnOptions = stringColumns.map((col) => {
      return {
        value: col.field,
        label: col.title,
        listLabel: col.title,
        icon: 'table',
      }
    })

    stringColumnOptions.push({
      value: null,
      label: 'None',
    })

    return (
      <Modal
        className='custom-column-window-fn-modal'
        title='Add Window Function'
        isVisible={this.state.isFunctionConfigModalVisible}
        width='550px'
        height='500px'
        confirmText='Add Function'
        shouldRender={this.props.enableWindowFunctions}
        onClose={this.closeAddFunctionModal}
        onConfirm={this.onAddFunction}
        confirmDisabled={!this.isFunctionConfigComplete()}
      >
        <div>
          <div>
            <Select
              label='Function'
              className='custom-column-window-fn-selector'
              value={this.state.selectedFnType}
              onChange={(selectedFnType) => this.setState({ selectedFnType })}
              options={Object.keys(WINDOW_FUNCTIONS).map((fn) => {
                const fnObj = WINDOW_FUNCTIONS[fn]
                return {
                  value: fnObj.value,
                  label: this.getLabelForOperator(fnObj),
                }
              })}
            />
            <Select
              label='Column'
              className='custom-column-window-fn-selector'
              value={this.state.selectedFnColumn}
              onChange={(selectedFnColumn) => this.setState({ selectedFnColumn })}
              options={numericalColumns.map((col) => {
                return {
                  value: col.field,
                  label: col.title,
                  listLabel: col.title,
                  icon: 'table',
                }
              })}
            />
          </div>
          {stringColumns?.length > 0 && (
            <div>
              <Select
                label='Group By Column'
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnGroupby ?? null}
                onChange={(selectedFnGroupby) => this.setState({ selectedFnGroupby })}
                options={stringColumnOptions}
              />
            </div>
          )}

          {ORDERABLE_WINDOW_FN_TYPES.includes(this.state.selectedFnType) && (
            <div>
              <Select
                label='Order By Column'
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnOrderBy ?? null}
                onChange={(selectedFnOrderBy) => this.setState({ selectedFnOrderBy })}
                options={stringColumnOptions}
              />
            </div>
          )}
        </div>
      </Modal>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          className='custom-column-modal'
          title={this.props.initialColumn ? 'Edit Custom Column' : 'Configure Custom Column'}
          isVisible={this.props.isOpen}
          width='90vw'
          height='100vh'
          confirmText={this.props.initialColumn ? 'Update Column' : 'Save Column'}
          shouldRender={this.props.shouldRender}
          onClose={this.props.onClose}
          onConfirm={this.props.initialColumn ? this.onUpdateColumnConfirm : this.onAddColumnConfirm}
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
          {this.renderFunctionConfigModal()}
        </Modal>
      </ErrorBoundary>
    )
  }
}
