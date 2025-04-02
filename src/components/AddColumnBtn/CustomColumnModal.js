import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'

import {
  AggTypes,
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
  ORDERBY_DIRECTIONS,
  getOperators,
  GLOBAL_OPERATORS,
  FUNCTION_OPERATOR,
  HIGHLIGHTED_CLASS,
  DEFAULT_COLUMN_NAME,
  getSelectableColumns,
  getNumericalColumns, // useful? 
  getStringColumns, // useful?
  capitalizeFirstChar,
  getCleanColumnName, // useful?
  buildPlainColumnArrayFn, // useful?
  isOperatorJs,
  ROWS_RANGE,
  ROWS_RANGE_OPTIONS,
  getVisibleColumns,
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

    let initialColumnFn
    if (props.initialColumn?.name) {
      initialColumnFn = this.buildFnArray(props.initialColumn?.name, props.columns)
    } else {
      initialColumnFn = props.initialColumn?.columnFnArray ?? []
    }

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
      isColumnNameValid: props.initialColumn
        ? true
        : this.checkColumnName(props.initialColumn?.display_name ?? DEFAULT_COLUMN_NAME),

      isFunctionConfigModalVisible: false,
      selectedFnType: Object.keys(WINDOW_FUNCTIONS)[0],
      selectedFnColumn: numericalColumns?.[0]?.field,
      selectedFnNTileNumber: null,
      selectedFnGroupby: null,
      selectedFnHaving: null,
      selectedFnOperator: null,
      selectedFnOperatorValue: null,
      selectedFnOrderBy: null,
      selectedFnOrderByDirection: null,
      selectedFnRowsOrRange: null,
      selectedFnRowsOrRangeOptionPre: null,
      selectedFnRowsOrRangeOptionPreNValue: null,
      selectedFnRowsOrRangeOptionPost: null,
      selectedFnRowsOrRangeOptionPostNValue: null,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    enableWindowFunctions: PropTypes.bool,
    queryResponse: PropTypes.shape({}),

    onAddColumn: PropTypes.func,
    onUpdateColumn: PropTypes.func,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableWindowFunctions: false,

    queryResponse: undefined,
    onAddColumn: () => {},
    onUpdateColumn: () => {},
    onClose: () => {},
  }

  componentDidUpdate = (prevProps, prevState) => {
    // Update column mutator is function changed
    if (
      !deepEqual(this.state.columnFn, prevState.columnFn) ||
      this.state.columnType !== prevState.columnType ||
      this.state.columnName !== prevState.columnName
    ) {
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

  buildFnArray = (columnName, cols) => {
    try {
      if (!columnName) {
        return []
      }

      const ops = buildPlainColumnArrayFn(columnName)
      if (ops?.length === 0) {
        return []
      }

      const fnArray = []
      let i = 0
      for (const op of ops) {
        if (isOperatorJs(op)) {
          let opValue = ''
          Object.keys(this.OPERATORS).forEach((key) => {
            if (this.OPERATORS?.[key]?.js === op) {
              opValue = key
            }
          })
          fnArray.push({ type: 'operator', value: opValue })
        } else if (!isNaN(op)) {
          fnArray.push({ type: 'number', value: op })
        } else {
          let column = cols?.find((col) => col?.name?.trim() === op)
          if (column) {
            fnArray.push({ type: 'column', value: column?.field, column })
          } else {
            const cleanName = getCleanColumnName(op)
            const availableSelect = this.props.queryResponse?.data?.data?.available_selects?.find((select) => {
              return select?.table_column?.trim() === cleanName
            })
            if (availableSelect) {
              fnArray.push({ type: 'column', value: availableSelect?.table_column, column: availableSelect })
            }
          }
        }
        i++
      }

      return fnArray
    } catch (error) {
      console.error(error)
      return []
    }
  }

  buildProtoTableColumn = (customColumn) => {
    if (customColumn?.columnFnArray) {
      let protoTableColumn = ''
      let i = 0
      for (const columnFn of customColumn?.columnFnArray) {
        const colName = columnFn?.column?.name
        if (columnFn?.type === 'column') {
          protoTableColumn += columnFn?.column?.name
        } else if (columnFn?.type === 'operator') {
          protoTableColumn += this.OPERATORS[columnFn?.value]?.js
        } else if (columnFn?.type === 'number') {
          protoTableColumn += columnFn?.value || 0
        } else if (columnFn?.type === 'function') {
          protoTableColumn +=
            WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'sum'
              ? `${colName?.substring(colName?.indexOf('sum(') + 4, colName?.indexOf(')'))} / ${colName} * 100`
              : `${columnFn.fn}(` +
                `${
                  WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'column'
                    ? columnFn?.column?.name
                    : WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'number'
                    ? this.state.selectedFnNTileNumber
                    : this.state.selected ?? ''
                })` +
                `${
                  ' OVER (' +
                  `${
                    this.state.selectedFnGroupby
                      ? ' PARTITION BY ' +
                        getVisibleColumns(this.props.columns).find((column) => {
                          return column.field === this.state.selectedFnGroupby
                        })?.name
                      : ''
                  }` +
                  `${
                    this.state.selectedFnOrderBy
                      ? ' ORDER BY ' +
                        getVisibleColumns(this.props.columns).find((column) => {
                          return column.field === this.state.selectedFnOrderBy
                        })?.name +
                        ` ${this.state?.selectedFnOrderByDirection || ' DESC '} ` +
                        ` ${this.state?.selectedFnRowsOrRange || ''} ` +
                        ` ${!!this.state?.selectedFnRowsOrRange ? ' Between ' : ''}` +
                        ` ${this.state?.selectedFnRowsOrRangeOptionPreNValue || ''} ` +
                        ` ${this.state?.selectedFnRowsOrRangeOptionPre || ''} ` +
                        ` ${!!this.state?.selectedFnRowsOrRange ? ' AND ' : ''} ` +
                        ` ${this.state?.selectedFnRowsOrRangeOptionPostNValue || ''} ` +
                        ` ${this.state?.selectedFnRowsOrRangeOptionPost || ''} `
                      : ''
                  })`
                }`
        } else {
          console.error('Unknown columnFn type')
        }
        const nextValue = customColumn?.columnFnArray?.[i + 1]?.value
        if (columnFn?.value !== 'LEFT_BRACKET' && nextValue !== 'RIGHT_BRACKET') {
          protoTableColumn += ' '
        }
        i++
      }

      return protoTableColumn
    }
    return customColumn?.name || ''
  }

  onUpdateColumnConfirm = () => {
    const newColumn = _cloneDeep(this.newColumn)
    newColumn.id = this.props.initialColumn?.id
    const protoTableColumn = this.buildProtoTableColumn(newColumn)
    this.props.onUpdateColumn({
      ...newColumn,
      table_column: protoTableColumn,
      custom_column_display_name: this.state?.columnName?.trim(),
    })
  }

  onAddColumnConfirm = () => {
    const newColumn = _cloneDeep(this.newColumn)
    newColumn?.columnFnArray?.unshift({
      type: 'operator',
      value: 'LEFT_BRACKET',
    })
    newColumn?.columnFnArray?.push({
      type: 'operator',
      value: 'RIGHT_BRACKET',
    })
    const protoTableColumn = this.buildProtoTableColumn(newColumn)
    this.props.onAddColumn({
      ...newColumn,
      table_column: protoTableColumn,
      custom_column_display_name: this.state?.columnName?.trim(),
    })
  }

  changeChunkGroupby = (value, type, i) => {
    if (type === 'function') {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].groupby = value
      }
      this.setState({ columnFn })
    }
  }

  changeChunkOrderby = (value, type, i) => {
    if (type === 'function') {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].orderby = value
      }
      this.setState({ columnFn })
    }
  }

  changeChunkRowsOrRange = (value, type, i) => {
    if (type === 'function') {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].rowsOrRange = value
      }
      this.setState({ columnFn })
    }
  }

  changeChunkRowsOrRangeStart = (value, type, i) => {
    if (type === 'function') {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].rowsOrRangeOptionPre = value
      }
      this.setState({ columnFn })
    }
  }

  changeChunkRowsOrRangeEnd = (value, type, i) => {
    if (type === 'function') {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].rowsOrRangeOptionPost = value
      }
      this.setState({ columnFn })
    }
  }

  changeChunkValue = (value, type, i) => {
    if (type === 'column' || type === 'function') {
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
      column:
        WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'column'
          ? this.props.columns.find((col) => col.field === this.state.selectedFnColumn)
          : WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'sum'
          ? this.props.columns.find((col) => col.field === this.state.selectedFnSum)
          : null,
      nTileNumber: this.state.selectedFnNTileNumber,
      groupby: this.state.selectedFnGroupby,
      having: this.state.selectedFnHaving,
      operator: this.state.selectedFnOperator,
      operatorValue: this.state.selectedFnOperatorValue,
      orderby: this.state.selectedFnOrderBy,
      orderbyDirection: this.state.selectedFnOrderByDirection,
      rowsOrRange: this.state.selectedFnRowsOrRange,
      rowsOrRangeOptionPre: this.state.selectedFnRowsOrRangeOptionPre,
      rowsOrRangeOptionPreNValue: this.state.selectedFnRowsOrRangeOptionPreNValue,
      rowsOrRangeOptionPost: this.state.selectedFnRowsOrRangeOptionPost,
      rowsOrRangeOptionPostNValue: this.state.selectedFnRowsOrRangeOptionPostNValue,
    })

    this.setState({
      isFunctionConfigModalVisible: false,
      columnFn,
    })
  }

  isFunctionConfigComplete = () => {
    const selectedFunc = this.state.selectedFnType
    const requiredCols = WINDOW_FUNCTIONS[selectedFunc]?.requiredCols
    const requiredNotSetArr =
      requiredCols !== null
        ? requiredCols?.filter((colName) => this.state[colName] === null || this.state[colName] === undefined)
        : []
    const rowOrRangeComplete =
      this.state.selectedFnRowsOrRange === null
        ? true // rows selected
        : this.state.selectedFnRowsOrRangeOptionPre &&
          this.state.selectedFnRowsOrRangeOptionPost && //  need to be selected if pre and post options are selected
          ((this.state.selectedFnRowsOrRangeOptionPre !== null &&
            this.state.selectedFnRowsOrRangeOptionPre !== 'PRECEDING') || // preconditions are complete
            (this.state.selectedFnRowsOrRangeOptionPre === 'PRECEDING' &&
              this.state.selectedFnRowsOrRangeOptionPreNValue !== null)) &&
          ((this.state.selectedFnRowsOrRangeOptionPost !== null &&
            this.state.selectedFnRowsOrRangeOptionPost !== 'FOLLOWING') || // postconditions are complete
            (this.state.selectedFnRowsOrRangeOptionPost === 'FOLLOWING' &&
              this.state.selectedFnRowsOrRangeOptionPostNValue !== null))

    const metRequirements =
      selectedFunc !== null &&
      (requiredCols === null || (requiredCols !== null && requiredNotSetArr?.length === 0)) &&
      rowOrRangeComplete
    return metRequirements
  }

  checkColumnName = (nameVal) => {
    const columnNameExists = this.props?.columns?.find((col) => col?.display_name === nameVal)
    return !columnNameExists && nameVal
  }

  handleColumnNameUpdate = (nameVal) => {
    if (this.checkColumnName(nameVal)) {
      this.setState({ isColumnNameValid: true })
    } else {
      this.setState({ isColumnNameValid: false })
    }
    this.setState({
      columnName: nameVal,
    })
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
        errormessage={
          this.state?.isColumnNameValid
            ? ''
            : this.state?.columnName?.length > 0
            ? 'A column with this name already exists.'
            : 'Column name cannot be empty'
        }
        onChange={(e) => {
          this.handleColumnNameUpdate(e.target.value)
        }}
      />
    )
  }

  renderColumnTypeSelector = () => {
    const currentColumnType = COLUMN_TYPES[this.getColumnType()]?.description
    const formattedCurrentColumnType = currentColumnType ? ` (${currentColumnType})` : ''
    return (
      <div className='custom-column-builder-type-selector'>
        <Input
          ref={(r) => (this.inputRef = r)}
          focusOnMount
          label='Formatting'
          value={
            capitalizeFirstChar(this.state.columnType) + formattedCurrentColumnType ??
            this.getColumnType() + formattedCurrentColumnType
          }
          disabled={true}
        />
      </div>
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
        showSpinWheel={true}
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
        {chunk.column && (
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
        )}
        {chunk.nTileNumber && <span>{chunk.nTileNumber}</span>}
        {chunk.groupby ? (
          <>
            <span>{`${!!chunk.column || !!chunk.nTileNumber ? ', ' : ''}Partition by `} </span>
            <Select
              key={`custom-column-select-${i}`}
              placeholder='Select a Column'
              value={chunk.groupby}
              outlined={false}
              showArrow={false}
              className='react-autoql-available-column-selector'
              onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
              options={getVisibleColumns(this.props.columns).map((col) => {
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
              key={`custom-orderedby-select-${i}`}
              placeholder='Select Rows or Range'
              value={chunk.orderby}
              outlined={false}
              showArrow={false}
              className='react-autoql-available-column-selector'
              onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
              options={getVisibleColumns(this.props.columns).map((col) => {
                return {
                  value: col.field,
                  label: col.title,
                  icon: 'table',
                }
              })}
            />
            {chunk.rowsOrRange ? (
              <>
                <Select
                  key={`custom-rows-or-range-select-${i}`}
                  placeholder='Select a ROW OR RANGE'
                  value={chunk.rowsOrRange}
                  outlined={false}
                  showArrow={false}
                  className='react-autoql-available-column-selector'
                  onChange={(value) => this.changeChunkRowsOrRange(value, chunk.type, i)}
                  options={ROWS_RANGE}
                />
                BETWEEN
                <Select
                  key={`custom-row-range-start-select-${i}`}
                  placeholder='Select Row Or Range Start With'
                  value={chunk.rowsOrRangeOptionPre}
                  outlined={false}
                  showArrow={false}
                  className='react-autoql-available-column-selector'
                  onChange={(value) => this.changeChunkRowsOrRangeStart(value, chunk.type, i)}
                  options={ROWS_RANGE_OPTIONS.filter((option) => option.canStartWith === true)}
                />
                AND
                <Select
                  key={`custom-row-range-end-select-${i}`}
                  placeholder='Select Row Or Range End With'
                  value={chunk.rowsOrRangeOptionPost}
                  outlined={false}
                  showArrow={false}
                  className='react-autoql-available-column-selector'
                  onChange={(value) => this.changeChunkRowsOrRangeEnd(value, chunk.type, i)}
                  options={ROWS_RANGE_OPTIONS.filter(
                    (option) => option.canEndWith === true && option.value !== chunk.rowsOrRangeOptionPre,
                  )}
                />
              </>
            ) : null}
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
        options={supportedOperators
          .filter((op) => op !== FUNCTION_OPERATOR)
          .map((op) => {
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
        <div style={{ minWidth: '300px' }}>
          {!this.state.isFunctionConfigModalVisible && (
            <span style={{ display: 'flex', height: '-webkit-fill-available' }}>
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
                          lastTerm?.type === 'column' ||
                          lastTerm?.type === 'number' ||
                          lastTerm?.value === 'RIGHT_BRACKET'
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
                    const buttonElement = (
                      <Button
                        key={`react-autoql-formula-calculator-button-${op}`}
                        className='react-autoql-formula-calculator-button'
                        disabled={this.shouldDisableOperator(op)}
                        style={{ width: `${op === FUNCTION_OPERATOR ? '-webkit-fill-available' : 'undefined'}` }}
                        onClick={() => {
                          if (op === FUNCTION_OPERATOR) {
                            return this.setState({
                              isFunctionConfigModalVisible: true,
                              selectedFnType: null,
                              selectedFnColumn: null,
                              selectedFnNTileNumber: null,
                              selectedFnGroupby: null,
                              selectedFnHaving: null,
                              selectedFnOperator: null,
                              selectedFnOperatorValue: null,
                              selectedFnOrderBy: null,
                              selectedFnOrderByDirection: null,
                              selectedFnRowsOrRange: null,
                              selectedFnRowsOrRangeOptionPre: null,
                              selectedFnRowsOrRangeOptionPost: null,
                            })
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

                    return buttonElement
                  })}
                </div>
              </div>
            </span>
          )}
          <div>{this.state.isFunctionConfigModalVisible && this.renderFunctionConfigModalContent()}</div>
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

  isInputRequired = (columnName) => {
    return (
      WINDOW_FUNCTIONS[this.state.selectedFnType]?.requiredCols?.find((colName) => colName === columnName)?.length > 1
    )
  }
  renderFunctionConfigModalContent = () => {
    const allColumns = getVisibleColumns(this.props.columns)
    const allColumnsOptions = allColumns.map((col) => {
      return {
        value: col.field,
        label: col.title,
        listLabel: col.title,
        icon: 'table',
      }
    })
    allColumnsOptions.push({
      value: null,
      label: 'None',
    })
    const numericalColumns = getNumericalColumns(this.props.columns)
    const stringColumns = getStringColumns(this.props.columns)
    const sumColumns = numericalColumns.filter((col) => col?.name?.toUpperCase().startsWith(AggTypes.SUM))
    let sumComlumnOptions = []
    if (sumColumns.length === 0) {
      sumComlumnOptions.push({
        value: null,
        label: 'Must create a sum value to use here',
      })
    } else {
      sumComlumnOptions = sumColumns.map((col) => {
        return {
          value: col.field,
          label: col.title,
          listLabel: col.title,
          icon: 'table',
        }
      })
    }

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
      <div>
        <div ref={(r) => (this.windowFnPopover = r)} style={{ minHeight: '25vh' }}>
          <div>
            <Select
              label='Function'
              isRequired={true}
              className='custom-column-window-fn-selector-top'
              value={this.state.selectedFnType}
              onChange={(selectedFnType) => {
                this.setState({
                  selectedFnType,
                  selectedFnColumn: null,
                  selectedFnNTileNumber: null,
                  selectedFnGroupby: null,
                  selectedFnHaving: null,
                  selectedFnOperator: null,
                  selectedFnOperatorValue: null,
                  selectedFnOrderBy: null,
                  selectedFnOrderByDirection: null,
                  selectedFnRowsOrRange: null,
                  selectedFnRowsOrRangeOptionPre: null,
                  selectedFnRowsOrRangeOptionPreNValue: null,
                  selectedFnRowsOrRangeOptionPost: null,
                  selectedFnRowsOrRangeOptionPostNValue: null,
                })
              }}
              positions={['bottom', 'top', 'right', 'left']}
              options={Object.keys(WINDOW_FUNCTIONS).map((fn) => {
                const fnObj = WINDOW_FUNCTIONS[fn]
                return {
                  value: fnObj.value,
                  label: fnObj.label,
                }
              })}
            />
            {WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'column' && (
              <Select
                label='Column'
                isRequired={this.isInputRequired('selectedFnColumn')}
                className='custom-column-window-fn-selector-top'
                value={this.state.selectedFnColumn}
                onChange={(selectedFnColumn) => this.setState({ selectedFnColumn })}
                positions={['bottom', 'top', 'right', 'left']}
                options={numericalColumns.map((col) => {
                  return {
                    value: col.field,
                    label: col.title,
                    listLabel: col.title,
                    icon: 'table',
                  }
                })}
              />
            )}
            {WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'number' && (
              <Input
                label='# of buckets'
                isRequired={this.isInputRequired('selectedFnNTileNumber')}
                type='number'
                showSpinWheel={true}
                placeholder='eg. "10"'
                defaultValue={this.state.selectedFnNTileNumber}
                onChange={(e) => {
                  this.setState({ selectedFnNTileNumber: e.target.value })
                }}
              />
            )}
            {WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === 'sum' && (
              <Select
                label='Available Sums'
                isRequired={this.isInputRequired('selectedFnSum')}
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnSum ?? null}
                onChange={(selectedFnSum) => {
                  this.setState({ selectedFnSum })
                }}
                positions={['bottom', 'top', 'right', 'left']}
                options={sumComlumnOptions}
              />
            )}
          </div>
          {stringColumns?.length > 0 &&
            this.state.selectedFnType !== null &&
            this.state.selectedFnType !== 'PERCENT_TOTAL' && (
              <div>
                <Select
                  label='Partition By Column'
                  isRequired={this.isInputRequired('selectedFnGroupby')}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnGroupby ?? null}
                  onChange={(selectedFnGroupby) => {
                    this.setState({ selectedFnGroupby })
                    if (selectedFnGroupby === null) this.setState({ selectedFnHaving: null })
                  }}
                  positions={['bottom', 'top', 'right', 'left']}
                  options={allColumnsOptions}
                />
                {/* </div>
            <div>
              <Select
                label='Having'
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnHaving ?? null}
                onChange={(selectedFnHaving) => this.setState({ selectedFnHaving })}
                positions={['bottom', 'top', 'right', 'left']}
                options={stringColumnOptions}
                isDisabled={!this.state.selectedFnGroupby}
                outlined={true}
              />
              <Select
                label='Operator'
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnOperator ?? null}
                onChange={(selectedFnOperator) => this.setState({ selectedFnOperator })}
                positions={['bottom', 'top', 'right', 'left']}
                options={this.OPERATORS}
                isDisabled={!this.state.selectedFnHaving}
                outlined={true}
              />*/}
              </div>
            )}

          {WINDOW_FUNCTIONS[this.state.selectedFnType]?.orderable && this.state.selectedFnType !== 'PERCENT_TOTAL' && (
            <div>
              <Select
                label='Order By Column'
                isRequired={this.isInputRequired('selectedFnOrderBy')}
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnOrderBy ?? null}
                onChange={(selectedFnOrderBy) => {
                  this.setState({ selectedFnOrderBy })
                }}
                positions={['bottom', 'top', 'right', 'left']}
                options={allColumnsOptions}
              />
              <Select
                label='Order By Direction'
                isRequired={this.isInputRequired('selectedFnOrderByDirection')}
                className='custom-column-window-fn-selector'
                value={this.state.selectedFnOrderByDirection ?? null}
                onChange={(selectedFnOrderByDirection) => this.setState({ selectedFnOrderByDirection })}
                positions={['bottom', 'top', 'right', 'left']}
                options={ORDERBY_DIRECTIONS}
                isDisabled={!this.state.selectedFnOrderBy}
                outlined={true}
              />

              {WINDOW_FUNCTIONS[this.state.selectedFnType]?.rowsOrRange && (
                <>
                  <div>
                    <Select
                      label='ROWS or RANGE'
                      isRequired={this.isInputRequired('selectedFnRowsOrRange')}
                      className='custom-column-window-fn-selector'
                      value={this.state.selectedFnRowsOrRange ?? null}
                      onChange={(selectedFnRowsOrRange) => {
                        this.setState({ selectedFnRowsOrRange })
                      }}
                      positions={['bottom', 'top', 'right', 'left']}
                      isDisabled={!this.state.selectedFnOrderBy}
                      options={ROWS_RANGE}
                    />
                  </div>
                  <div
                    className={`react-autoql-input-label ${!this.state.selectedFnRowsOrRange ? 'disabled' : ''}`}
                    style={{ padding: '2px 5px' }}
                  >
                    BETWEEN
                  </div>
                  <div>
                    <Select
                      label='Row Or Range Start With'
                      isRequired={this.isInputRequired('selectedFnRowsOrRangeOptionPre')}
                      className='custom-column-window-fn-selector'
                      value={this.state.selectedFnRowsOrRangeOptionPre ?? null}
                      onChange={(selectedFnRowsOrRangeOptionPre) => {
                        this.setState({
                          selectedFnRowsOrRangeOptionPre: selectedFnRowsOrRangeOptionPre,
                          selectedFnRowsOrRangeOptionPreNValue: null,
                        })
                      }}
                      positions={['bottom', 'top', 'right', 'left']}
                      options={ROWS_RANGE_OPTIONS.filter((option) => option.canStartWith === true)}
                      isDisabled={!this.state.selectedFnRowsOrRange}
                      outlined={true}
                    />
                    {ROWS_RANGE_OPTIONS.find((o) => o.value === this.state.selectedFnRowsOrRangeOptionPre)
                      ?.hasNValue && (
                      <Input
                        label='N Value'
                        isRequired={true}
                        type='number'
                        showSpinWheel={true}
                        placeholder='eg. "10"'
                        defaultValue={this.state.selectedFnRowsOrRangeOptionPreNValue}
                        onChange={(e) => {
                          this.setState({ selectedFnRowsOrRangeOptionPreNValue: e.target.value })
                        }}
                        disabled={!this.state.selectedFnRowsOrRangeOptionPre}
                      />
                    )}
                  </div>
                  <div
                    className={`react-autoql-input-label ${!this.state.selectedFnRowsOrRange ? 'disabled' : ''}`}
                    style={{ padding: '2px 5px' }}
                  >
                    AND
                  </div>
                  <div>
                    <Select
                      label='Row Or Range Ending With'
                      isRequired={this.isInputRequired('selectedFnRowsOrRangeOptionPost')}
                      className='custom-column-window-fn-selector'
                      value={this.state.selectedFnRowsOrRangeOptionPost ?? null}
                      onChange={(selectedFnRowsOrRangeOptionPost) => {
                        this.setState({
                          selectedFnRowsOrRangeOptionPost: selectedFnRowsOrRangeOptionPost,
                          selectedFnRowsOrRangeOptionPostNValue: null,
                        })
                      }}
                      positions={['bottom', 'top', 'right', 'left']}
                      options={ROWS_RANGE_OPTIONS.filter(
                        (option) =>
                          option.canEndWith === true && option.value !== this.state.selectedFnRowsOrRangeOptionPre,
                      )}
                      isDisabled={!this.state.selectedFnRowsOrRange}
                      outlined={true}
                    />
                    {ROWS_RANGE_OPTIONS.find((o) => o.value === this.state.selectedFnRowsOrRangeOptionPost)
                      ?.hasNValue && (
                      <Input
                        label='N Value 2'
                        isRequired={true}
                        type='number'
                        showSpinWheel={true}
                        placeholder='eg. "10"'
                        defaultValue={this.state.selectedFnRowsOrRangeOptionPostNValue}
                        onChange={(e) => {
                          this.setState({ selectedFnRowsOrRangeOptionPostNValue: e.target.value })
                        }}
                        disabled={!this.state.selectedFnRowsOrRangeOptionPre}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className='react-autoql-window-fn-popover-footer'>
          <Button type='default' onClick={this.closeAddFunctionModal}>
            Cancel
          </Button>
          <Button type='primary' onClick={this.onAddFunction} disabled={!this.isFunctionConfigComplete()}>
            Add Function
          </Button>
        </div>
      </div>
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
          confirmDisabled={!this.state.isFnValid || !this.state.isColumnNameValid || !this.state.columnFn?.length}
          enableBodyScroll={true}
        >
          <div ref={(r) => (this.columnModalContentRef = r)} className='custom-column-modal'>
            <div className='custom-column-modal-form-wrapper'>
              <div className='custom-column-modal-name-and-type'>{this.renderColumnNameInput()}</div>
              {this.renderColumnFnBuilder()}
            </div>
            {this.renderTablePreview()}
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
