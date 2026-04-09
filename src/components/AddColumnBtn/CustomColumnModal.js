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
  FUNCTION_OPERATORS,
  HIGHLIGHTED_CLASS,
  DEFAULT_COLUMN_NAME,
  getSelectableColumns,
  getNumericalColumns,
  getStringColumns,
  getDateColumns,
  capitalizeFirstChar,
  getCleanColumnName,
  buildPlainColumnArrayFn,
  transformDivisionExpression,
  isOperatorJs,
  ROWS_RANGE,
  ROWS_RANGE_OPTIONS,
  getVisibleColumns,
  CustomColumnValues,
  CustomColumnTypes,
  CustomColumnRowRangeTypes,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Input } from '../Input'
import { Button } from '../Button'
import { Select } from '../Select'
// Use React.lazy for dynamic import of ChataTable to avoid circular import at module evaluation
const LazyChataTable = React.lazy(() => import('../ChataTable/ChataTable'))
import { ErrorBoundary } from '../../containers/ErrorHOC'
import normalizePreviewResponse from '../../utils/previewResponseUtils'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './CustomColumnModal.scss'

export default class CustomColumnModal extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.OPERATORS = getOperators(props.enableWindowFunctions)

    this.numberInputRefs = {}

    const initialColumn = props.initialColumn

    let initialColumnFn
    const overrideTableColumn = props.initialColumn?._snapshotDisplayOverride?.table_column
    const initialTableColumn = props.initialColumn?.table_column
    if (props.initialColumn?.columnFnArray) {
      initialColumnFn = props.initialColumn.columnFnArray
    } else if (overrideTableColumn) {
      initialColumnFn = this.buildFnArray(overrideTableColumn, props.columns)
    } else if (initialTableColumn) {
      initialColumnFn = this.buildFnArray(initialTableColumn, props.columns)
    } else if (props.initialColumn?.name) {
      initialColumnFn = this.buildFnArray(props.initialColumn?.name, props.columns)
    } else {
      initialColumnFn = []
    }

    // Clean up any saved artifacts (stray brackets, zero values)
    initialColumnFn = this.cleanColumnFn(initialColumnFn)

    // Expand nested COLUMN tokens to show full expressions when editing

    // Only expand nested COLUMN tokens when needed (legacy saved tokens or complex table_column)
    const needsExpansion = (initialColumnFn || []).some(
      (tok) =>
        tok?.type === CustomColumnTypes.COLUMN &&
        (tok?.column?.columnFnArray?.length || (tok?.column?.table_column && this.isComplexColumn(tok.column))),
    )
    if (needsExpansion) {
      initialColumnFn = this.expandNestedColumns(initialColumnFn)
    }
    initialColumnFn = this.cleanColumnFn(initialColumnFn)

    this.newColumnRaw = this.getRawColumnParams(initialColumn, props.initialColumn?.display_name)

    const initialMutator = this.safeCreateMutatorFn(initialColumnFn)
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
      selectedFnOperation: null,
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
      selectedFnMovingAverageTimeInterval: null,
    }
  }

  expandNestedColumns = (fn) => {
    const out = []
    for (const tok of fn) {
      if (tok?.type === CustomColumnTypes.COLUMN && tok.column) {
        let inner = tok.column.columnFnArray ? _cloneDeep(tok.column.columnFnArray) : null
        // If no explicit tokens but column is complex, build from table_column
        if (!inner && tok.column.table_column && this.isComplexColumn(tok.column)) {
          inner = this.buildFnArray(tok.column.table_column, this.props.columns)
        }
        if (inner && inner.length) {
          // Recursively expand inside the inner tokens as well
          const expandedInner = this.expandNestedColumns(inner)
          if (expandedInner.length > 1) {
            // Preserve grouping for nested custom columns during edit
            out.push({ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET, preserve: true })
            out.push(...expandedInner)
            out.push({ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.RIGHT_BRACKET, preserve: true })
          } else {
            out.push(...expandedInner)
          }
        } else {
          out.push(_cloneDeep(tok))
        }
      } else {
        out.push(_cloneDeep(tok))
      }
    }
    return out
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    enableWindowFunctions: PropTypes.bool,
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    queryResponse: PropTypes.shape({}),
    queryRequestData: PropTypes.shape({}),
    response: PropTypes.shape({}),
    popoverParentElement: PropTypes.any,
    tooltipID: PropTypes.string,

    onAddColumn: PropTypes.func,
    onUpdateColumn: PropTypes.func,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableWindowFunctions: true,
    columns: [],
    queryResponse: undefined,
    queryRequestData: null,
    response: null,
    popoverParentElement: null,
    tooltipID: '',
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

  // Sync columnFnArray to avoid stale state during async setState
  syncNewColumnFnArray = (columnFn) => {
    if (!this.newColumn) return
    try {
      this.newColumn.columnFnArray = _cloneDeep(columnFn) || []
    } catch (error) {
      console.error('Failed to sync column function array:', error)
    }
  }

  // Map order-by direction to SQL token: 'ASC' or 'DESC' (defaults to 'DESC')
  getOrderByDirection = (dir) => {
    const raw = typeof dir === 'object' && dir?.value ? dir.value : dir
    if (raw === null || raw === undefined) return 'DESC'
    const s = String(raw).toUpperCase()
    if (s.includes('ASC')) return 'ASC'
    if (s.includes('DESC')) return 'DESC'
    return 'DESC'
  }

  // Build PARTITION BY clause from columnFn (returns empty string if none)
  buildPartitionClause = (columnFn) => {
    const groupbyField = columnFn?.groupby ?? this.state.selectedFnGroupby
    if (!groupbyField) return ''
    const colName = getVisibleColumns(this.props.columns).find((column) => column.field === groupbyField)?.name
    return colName ? `PARTITION BY ${colName}` : ''
  }

  // Build ORDER BY clause (optionally include rows/range details)
  buildOrderByClause = (columnFn, includeRowsRange = true) => {
    const orderbyField = columnFn?.orderby ?? this.state.selectedFnOrderBy
    if (!orderbyField) return ''
    const colName = getVisibleColumns(this.props.columns).find((column) => column.field === orderbyField)?.name
    if (!colName) return ''

    let clause = `ORDER BY ${colName} ${this.getOrderByDirection(
      columnFn?.orderbyDirection ?? this.state?.selectedFnOrderByDirection,
    )}`

    if (includeRowsRange) {
      const rowsOrRange = columnFn?.rowsOrRange ?? this.state?.selectedFnRowsOrRange
      if (rowsOrRange) {
        clause += ' ' + rowsOrRange
        clause += !!rowsOrRange ? ' Between ' : ''
        const preN = columnFn?.rowsOrRangeOptionPreNValue ?? this.state?.selectedFnRowsOrRangeOptionPreNValue
        if (preN) clause += ' ' + preN
        const pre = columnFn?.rowsOrRangeOptionPre ?? this.state?.selectedFnRowsOrRangeOptionPre
        if (pre) clause += ' ' + pre
        clause += !!rowsOrRange ? ' AND ' : ''
        const postN = columnFn?.rowsOrRangeOptionPostNValue ?? this.state?.selectedFnRowsOrRangeOptionPostNValue
        if (postN) clause += ' ' + postN
        const post = columnFn?.rowsOrRangeOptionPost ?? this.state?.selectedFnRowsOrRangeOptionPost
        if (post) clause += ' ' + post
      }
    }

    return clause
  }

  updateTabulatorColumnFn = () => {
    const columns = _cloneDeep(this.state.columns)

    const { columnFn, columnType } = this.state

    // Validate formula completeness
    if (!this.isFormulaComplete()) {
      return
    }

    if (!this.hasVariablesInColumnFn()) {
      this.setState({ isFnValid: false, fnError: 'Formula must include at least one variable' })
      return
    }

    const structural = this.isStructurallyValidColumnFn()
    if (!structural.valid) {
      this.setState({ isFnValid: false, fnError: structural.error })
      return
    }

    // Create mutator and summary. If parsing fails, attempt one safe retry:
    // re-run `cleanColumnFn` (which inserts implicit multiplication) and retry createMutatorFn.

    let newMutator = this.safeCreateMutatorFn(columnFn)
    let newFnSummary = getFnSummary(columnFn)

    if (!newMutator || newMutator?.error) {
      // attempt a single retry with a cleaned copy (handles racey insertion cases)
      try {
        const retriedFn = this.cleanColumnFn(_cloneDeep(columnFn))
        const retriedMutator = this.safeCreateMutatorFn(retriedFn)
        if (retriedMutator && !retriedMutator.error) {
          newMutator = retriedMutator
          newFnSummary = getFnSummary(retriedFn)
          // persist the corrected token list so subsequent evaluations use it
          this.setState({ columnFn: retriedFn })
        }
      } catch (e) {
        console.warn('Failed to retry formula after cleaning:', e)
      }
      // If still failing, try rebuilding tokens from the generated SQL (best-effort canonicalization)
      if (!newMutator || newMutator?.error) {
        try {
          const protoSql = this.getColumnSQLWithOptionalBrackets(columnFn)
          const rebuiltFn = this.buildFnArray(protoSql, this.props.columns)
          const rebuiltMutator = this.safeCreateMutatorFn(rebuiltFn)
          if (rebuiltMutator && !rebuiltMutator.error) {
            newMutator = rebuiltMutator
            newFnSummary = getFnSummary(rebuiltFn)
            this.setState({ columnFn: rebuiltFn })
          }
        } catch (e) {
          console.warn('Failed to rebuild formula from SQL:', e)
        }
      }
    }

    if (!newMutator || newMutator?.error?.message) {
      const fnError = newMutator?.error?.message || (newMutator?.error && String(newMutator.error))
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

      let cleanedName = this.stripCoalesceWrapper(columnName)
      cleanedName = this.replaceTypeCastWithPreserveTokens(cleanedName)
      
      // Replace column names with placeholders before tokenization (handles nested parens & multi-word names)
      const allCols = [
        ...(cols || []),
        ...(this.props.queryResponse?.data?.data?.available_selects || [])
      ]
      const colsByLength = allCols.map((col, originalIndex) => ({ col, originalIndex }))
        .sort((a, b) => {
          const aLen = (a.col?.table_column || a.col?.name)?.length || 0
          const bLen = (b.col?.table_column || b.col?.name)?.length || 0
          return bLen - aLen // Longest first to avoid partial matches
        })

      const placeholderMap = {}
      for (let i = 0; i < colsByLength.length; i++) {
        const { col, originalIndex } = colsByLength[i]
        const candidates = [col?.table_column, col?.name].filter(Boolean)
        
        for (const matchStr of candidates) {
          if (!matchStr?.trim()) continue
          // Skip full-replacement matches (prevents formula matching its own custom column)
          if (matchStr.trim() === cleanedName.trim()) {
            continue
          }
          
          const regex = new RegExp(matchStr.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
          const replaced = cleanedName.replace(regex, `__COLREF_${originalIndex}__`)
          if (replaced !== cleanedName) {
            placeholderMap[`__COLREF_${originalIndex}__`] = col
            cleanedName = replaced
            break
          }
        }
      }
      
      const ops = buildPlainColumnArrayFn(cleanedName)
      if (ops?.length === 0) {
        return []
      }

      const fnArray = []
      let col // Declare for reuse in column matching logic
      for (const op of ops) {
        if (op === '__PRESERVE_LP__') {
          fnArray.push({ type: 'operator', value: CustomColumnValues.LEFT_BRACKET, preserve: true })
        } else if (op === '__PRESERVE_RP__') {
          fnArray.push({ type: 'operator', value: CustomColumnValues.RIGHT_BRACKET, preserve: true })
        } else if (isOperatorJs(op)) {
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
          // Check placeholder (pre-tokenization), then exact name, then normalized, then case-insensitive
          // Handle placeholders that may or may not have surrounding underscores
          let placeholderCol = placeholderMap[op]
          if (!placeholderCol && op.match(/^COLREF_\d+$/)) {
            // Try with underscores if this looks like a placeholder
            placeholderCol = placeholderMap[`__${op}__`]
          }
          
          if (placeholderCol) {
            fnArray.push({ type: 'column', value: placeholderCol?.field, column: placeholderCol })
          } else if ((col = cols?.find((c) => c?.name?.trim() === op)) || // exact match in cols
                     (col = this.props.queryResponse?.data?.data?.available_selects?.find((s) => s?.table_column?.trim() === getCleanColumnName(op))) || // normalized match
                     (col = cols?.find((c) => c?.table_column?.trim().toLowerCase() === op?.toLowerCase()))) { // case-insensitive
            fnArray.push({ type: 'column', value: col?.field || col?.table_column, column: col })
          }
        }
      }

      // Remove redundant nested bracket pairs wrapping the entire formula iteratively
      let cleaned = [...fnArray]
      let passnum = 0
      while (passnum++ < 10) {
        let foundRemoval = false
        
        // Count consecutive opening brackets at the start (skip preserved ones)
        let openCount = 0
        while (openCount < cleaned.length && 
               cleaned[openCount]?.value === CustomColumnValues.LEFT_BRACKET &&
               !cleaned[openCount]?.preserve) {
          openCount++
        }
        
        // Count consecutive closing brackets at the end (skip preserved ones)
        let closeCount = 0
        while (closeCount < cleaned.length && 
               cleaned[cleaned.length - 1 - closeCount]?.value === CustomColumnValues.RIGHT_BRACKET &&
               !cleaned[cleaned.length - 1 - closeCount]?.preserve) {
          closeCount++
        }
        
        // Remove outer wrapping brackets if entire expression is wrapped (at least one pair, and content between)
        if (openCount > 0 && closeCount > 0 && openCount + closeCount < cleaned.length) {
          // Remove minimum count to avoid unmatched brackets
          const pairsToRemove = Math.min(openCount, closeCount)
          cleaned.splice(0, pairsToRemove) // Remove opening brackets
          cleaned.splice(cleaned.length - pairsToRemove, pairsToRemove) // Remove closing brackets
          foundRemoval = true
        }
        
        if (!foundRemoval) break // Early exit if no removal occurred
      }
      
      return cleaned
    } catch (error) {
      console.error(error)
      return []
    }
  }

  stripCoalesceWrapper = (sql) => {
    if (!sql || typeof sql !== 'string') return sql
    
    let result = sql.trim()
    if (result.startsWith('=')) result = result.substring(1).trim()
    
    while (result.startsWith('(') && result.endsWith(')')) {
      const inner = result.substring(1, result.length - 1).trim()
      if (inner.startsWith('(') && !inner.endsWith(')')) break
      result = inner
    }
    
    // Recursively strip COALESCE and NULLIF wrappers until no more match
    let prevResult = ''
    let iterations = 0
    
    while (result !== prevResult && iterations < 10) {
      iterations++
      prevResult = result
      
      // Strip ALL NULLIF(..., 0) patterns
      const nullifResult = this.replaceNullifPattern(result)
      if (nullifResult !== result) {
        result = nullifResult
        continue
      }
      
      // Strip ALL COALESCE(..., 0) patterns
      const coalesceResult = this.replaceCoalescePattern(result)
      if (coalesceResult !== result) {
        result = coalesceResult
        continue
      }
      
      // Strip outer parens if still present
      if (result.startsWith('(') && result.endsWith(')')) {
        const inner = result.substring(1, result.length - 1).trim()
        if (!inner.startsWith('(') || inner.endsWith(')')) {
          result = inner
          continue
        }
      }
    }
    
    return result
  }

  // Generic function to strip SQL wrapper: NULLIF(content, 0) or COALESCE(content, 0) → content
  stripSqlWrapper = (sql, funcName) => {
    const lowerSql = sql.toLowerCase()
    const funcStr = `${funcName.toLowerCase()}(`
    const funcIdx = lowerSql.indexOf(funcStr)
    
    if (funcIdx === -1) return sql
    
    // Find matching closing paren by counting depth
    let balance = 1, closeIdx = -1
    const startPos = funcIdx + funcStr.length
    for (let i = startPos; i < sql.length; i++) {
      if (sql[i] === '(') balance++
      else if (sql[i] === ')' && --balance === 0) {
        closeIdx = i
        break
      }
    }
    
    if (closeIdx === -1) return sql
    
    // Extract content and find last ", 0" at depth 0
    const fullContent = sql.substring(startPos, closeIdx).trim()
    let contentEnd = -1, depth = 0
    for (let i = fullContent.length - 1; i >= 0; i--) {
      if (fullContent[i] === ')') depth++
      else if (fullContent[i] === '(') depth--
      else if (depth === 0 && fullContent.substring(i, i + 3) === ', 0') {
        contentEnd = i
        break
      }
    }
    
    return contentEnd === -1 ? sql : sql.substring(0, funcIdx) + fullContent.substring(0, contentEnd).trim() + sql.substring(closeIdx + 1)
  }

  replaceNullifPattern = (sql) => this.stripSqlWrapper(sql, 'NULLIF')
  replaceCoalescePattern = (sql) => this.stripSqlWrapper(sql, 'COALESCE')

  // Only unwrap type-cast wrappers (CAST/CONVERT) and preserve grouping once if the inner expression is complex.
  replaceTypeCastWithPreserveTokens = (sql) => {
    if (!sql || typeof sql !== 'string') return sql
    let result = sql
    let iterations = 0

    while (iterations++ < 20) {
      const lower = result.toLowerCase()
      const castIdx = lower.indexOf('cast(')
      const convertIdx = lower.indexOf('convert(')
      let startIdx = -1
      let isCast = false
      if (castIdx === -1 && convertIdx === -1) break
      if (convertIdx !== -1 && (castIdx === -1 || convertIdx < castIdx)) {
        startIdx = convertIdx
        isCast = false
      } else {
        startIdx = castIdx
        isCast = true
      }

      const funcLen = isCast ? 5 : 8 // "cast(" or "convert("
      // Find matching closing paren for this CAST/CONVERT(
      let depth = 1
      let closeIdx = -1
      for (let i = startIdx + funcLen; i < result.length; i++) {
        if (result[i] === '(') depth++
        else if (result[i] === ')' && --depth === 0) {
          closeIdx = i
          break
        }
      }
      if (closeIdx === -1) break

      const inner = result.substring(startIdx + funcLen, closeIdx)
      let expr = ''

      if (isCast) {
        // CAST(expr AS type)
        let splitIdx = -1
        let innerDepth = 0
        for (let i = 0; i < inner.length - 3; i++) {
          const ch = inner[i]
          if (ch === '(') innerDepth++
          else if (ch === ')') innerDepth--
          if (innerDepth === 0 && inner.substring(i, i + 4).toLowerCase() === ' as ') {
            splitIdx = i
          }
        }
        if (splitIdx === -1) break
        expr = inner.substring(0, splitIdx).trim()
      } else {
        // CONVERT(type, expr, [style])
        // Extract expr as the second argument at depth 0
        let innerDepth = 0
        let comma1 = -1
        let comma2 = -1
        for (let i = 0; i < inner.length; i++) {
          const ch = inner[i]
          if (ch === '(') innerDepth++
          else if (ch === ')') innerDepth--
          else if (ch === ',' && innerDepth === 0) {
            if (comma1 === -1) comma1 = i
            else {
              comma2 = i
              break
            }
          }
        }
        if (comma1 === -1) break
        const end = comma2 === -1 ? inner.length : comma2
        expr = inner.substring(comma1 + 1, end).trim()
      }

      // Don't preserve CAST-stripped expressions - they're backend artifacts, not user brackets
      result = result.substring(0, startIdx) + ` ${expr} ` + result.substring(closeIdx + 1)
    }

    return result
  }

  hasTopLevelOperator = (expr) => {
    if (!expr || typeof expr !== 'string') return false
    let depth = 0
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (depth === 0 && /[+\-*/]/.test(ch)) return true
    }
    return false
  }

  // Build SQL for function chunks
  buildFunctionSql = (columnFn, customColumn) => {
    const colName = this.sanitizeColumnName(columnFn?.column?.name)

    // PERCENT_OF_TOTAL
    if (columnFn.fn === CustomColumnValues.PERCENT_OF_TOTAL) {
      const windowClause =
        columnFn?.groupby ?? this.state.selectedFnGroupby
          ? `PARTITION BY ${
              getVisibleColumns(this.props.columns).find((column) => {
                return column.field === (columnFn?.groupby ?? this.state.selectedFnGroupby)
              })?.name
            }`
          : ''

      return `(COALESCE(${colName} / NULLIF(SUM(${colName}) OVER (${windowClause}), 0), 0) * 100)`
    }

    // MOVING_AVG
    if (columnFn.fn === CustomColumnValues.MOVING_AVG) {
      const orderClause = this.buildOrderByClause(columnFn, false)
      return `AVG(${colName}) OVER(${orderClause} ROWS BETWEEN ${
        columnFn?.movingAvgTimeInterval ?? this.state.selectedFnMovingAverageTimeInterval
      } PRECEDING AND CURRENT ROW)`
    }

    // CHANGE
    if (columnFn.fn === CustomColumnValues.CHANGE) {
      const orderClause = this.buildOrderByClause(columnFn, false)
      return `${colName} - LAG(${colName}) OVER(${orderClause})`
    }

    // CUMULATIVE_SUM
    if (columnFn.fn === CustomColumnValues.CUMULATIVE_SUM) {
      const orderClause = this.buildOrderByClause(columnFn, false)
      return `SUM(${colName}) OVER(${orderClause} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW )`
    }

    // CUMULATIVE_PERCENT
    if (columnFn.fn === CustomColumnValues.CUMULATIVE_PERCENT) {
      const orderClause = this.buildOrderByClause(columnFn, false)
      return `(COALESCE(SUM(${colName}) OVER(${orderClause} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(SUM(${colName}) OVER(), 0), 0) * 100)`
    }

    // SUM-derived percent (window function whose nextSelector is SUM)
    if (WINDOW_FUNCTIONS[columnFn?.fn ?? this.state.selectedFnType]?.nextSelector === CustomColumnTypes.SUM) {
      return `(COALESCE(${colName?.substring(
        colName?.indexOf('SUM(') + 4,
        colName?.indexOf(')'),
      )} / NULLIF(${colName}, 0), 0) * 100)`
    }

    // Default: generic function with window clause
    const valueArg =
      WINDOW_FUNCTIONS[columnFn?.fn ?? this.state.selectedFnType]?.nextSelector === CustomColumnTypes.COLUMN
        ? columnFn?.column?.name
        : WINDOW_FUNCTIONS[columnFn?.fn ?? this.state.selectedFnType]?.nextSelector === CustomColumnTypes.NUMBER
        ? columnFn?.nTileNumber ?? this.state.selectedFnNTileNumber
        : this.state.selected ?? ''

    const partitionClause = this.buildPartitionClause(columnFn)
    const orderClause = this.buildOrderByClause(columnFn, true)
    const overInner = `${partitionClause}${partitionClause && orderClause ? ' ' : ''}${orderClause}`

    return `${columnFn.fn}(${valueArg}) OVER(${overInner})`
  }

  sanitizeColumnName = (columnName) => {
    // Clean aggregated column names: "SUM(col, 0)" → "SUM(col)"
    if (!columnName || typeof columnName !== 'string') {
      return columnName
    }

    const AGG_FUNCTIONS = ['SUM', 'AVG', 'COUNT', 'COUNT_DISTINCT', 'MIN', 'MAX', 'STDDEV', 'VARIANCE']
    const regex = new RegExp(`^(${AGG_FUNCTIONS.join('|')})\\s*\\((.+)\\)$`, 'i')
    const match = columnName.match(regex)

    if (match) {
      const firstParam = match[2].split(',')[0]?.trim()
      if (firstParam) {
        return `${match[1]}(${firstParam})`
      }
    }

    return columnName
  }

  buildProtoTableColumn = (customColumn) => {
    if (customColumn?.columnFnArray) {
      let protoTableColumn = ''
      let i = 0

      for (const columnFn of customColumn?.columnFnArray) {
        const colName = this.sanitizeColumnName(columnFn?.column?.name)

        if (columnFn?.type === CustomColumnTypes.COLUMN) {
          protoTableColumn += colName
        } else if (columnFn?.type === CustomColumnTypes.OPERATOR) {
          let operatorJs = this.OPERATORS[columnFn?.value]?.js
          // Support raw js operators (e.g. '/') and operator "value" tokens (e.g. DIVIDE)
          // in addition to OPERATORS keys (e.g. DIVISION).
          if (!operatorJs && isOperatorJs(columnFn?.value)) {
            operatorJs = columnFn?.value
          }
          if (!operatorJs) {
            const opByValue = Object.values(this.OPERATORS || {}).find((op) => op?.value === columnFn?.value)
            operatorJs = opByValue?.js
          }
          protoTableColumn += operatorJs || ''
        } else if (columnFn?.type === CustomColumnTypes.NUMBER) {
          protoTableColumn += columnFn?.value || 0
        } else if (columnFn?.type === CustomColumnTypes.FUNCTION) {
          protoTableColumn += this.buildFunctionSql(columnFn, customColumn)
        } else {
          console.error('Unknown columnFn type')
        }
        const nextValue = customColumn?.columnFnArray?.[i + 1]?.value
        if (
          nextValue &&
          columnFn?.value !== CustomColumnValues.LEFT_BRACKET &&
          nextValue !== CustomColumnValues.RIGHT_BRACKET &&
          !(columnFn?.value === CustomColumnValues.RIGHT_BRACKET && nextValue === undefined)
        ) {
          protoTableColumn += ' '
        }
        i++
      }

      return protoTableColumn
    }
    return customColumn?.name || ''
  }

  validateAndPrepareColumn = () => {
    // Validate formula structure and content
    const structural = this.isStructurallyValidColumnFn()
    if (!structural.valid) {
      this.setState({ isFnValid: false, fnError: structural.error })
      return
    }

    if (!this.hasVariablesInColumnFn()) {
      this.setState({ isFnValid: false, fnError: 'Formula must include at least one variable' })
      return
    }

    const newColumn = _cloneDeep(this.newColumn)
    if (!newColumn.columnFnArray?.length) {
      newColumn.columnFnArray = _cloneDeep(this.state.columnFn) || []
    }
    return newColumn
  }

  // Determine if a column is "complex" (has operations, window functions, or is a custom column with actual formula)
  isComplexColumn = (col) => {
    if (!col) return false
    // Check if columnFnArray has more than just a simple column reference
    if (col?.columnFnArray && col.columnFnArray.length > 0) {
      // If it's just a single column reference, it's not complex
      if (col.columnFnArray.length === 1 && col.columnFnArray[0].type === CustomColumnTypes.COLUMN) {
        return false
      }
      // Multiple components or has operators/functions = complex
      return true
    }
    // Check table_column for arithmetic operators (catches DB-computed columns and custom formulas)
    const tableCol = col?.table_column?.trim()
    if (tableCol && /[+\-*/]/.test(tableCol)) return true
    // Custom columns are complex UNLESS they have a simple plain table_column (no operators or parens)
    if (col?.custom === true || col?.custom_column_display_name) {
      const normalizedTableCol = tableCol ? this.stripCoalesceWrapper(tableCol)?.trim() : ''
      if (normalizedTableCol && !/[+\-*/]/.test(normalizedTableCol)) return false // simple reference like 'Sales Amount' or '(Sales Amount)'
      return true // complex (no table_column set, or has operators/function calls)
    }
    // Window function results are complex
    if (col?.fnSummary || col?.mutator) return true
    return false
  }

  getColumnSQLWithOptionalBrackets = (columnFnArray) => {
    const baseColumn = this.buildProtoTableColumn({ columnFnArray })
    const hasExplicitDivision = (columnFnArray || []).some(
      (chunk) =>
        chunk?.type === CustomColumnTypes.OPERATOR &&
        (chunk?.value === CustomColumnValues.DIVISION ||
          chunk?.value === '/' ||
          this.OPERATORS?.[chunk?.value]?.js === '/'),
    )
    const withDivisionSafety = hasExplicitDivision ? transformDivisionExpression(baseColumn) : baseColumn
    // Wrap with outer brackets only when this formula explicitly used division and safety wrapper was added
    return hasExplicitDivision && withDivisionSafety.includes('COALESCE') ? `(${withDivisionSafety})` : withDivisionSafety
  }

  onUpdateColumnConfirm = () => {
    const newColumn = this.validateAndPrepareColumn()
    if (!newColumn) return

    newColumn.id = this.props.initialColumn?.id
    // Use getColumnSQLWithOptionalBrackets to generate SQL without temporary brackets
    const protoTableColumn = this.getColumnSQLWithOptionalBrackets(newColumn.columnFnArray)
    const columnDisplayName = this.state?.columnName?.trim()

    this.props.onUpdateColumn({
      ...newColumn,
      name: columnDisplayName,
      table_column: protoTableColumn,
      custom_column_display_name: columnDisplayName,
      _snapshotDisplayOverride: this.props.initialColumn?._snapshotDisplayOverride ?? null,
    })
  }

  cleanColumnFn = (columnFn) => {
    // Remove empty number values, but preserve explicit zeros so formula stays as entered.
    let result = columnFn.filter((chunk) => {
      if (chunk?.type !== CustomColumnTypes.NUMBER) return true
      // Keep UI placeholders for custom-number editing (added via "Custom Number...").
      if (chunk?.id && this.isValueEmpty(chunk?.value)) return true
      return !this.isValueEmpty(chunk?.value)
    })

    // Operator precedence — keyed by the CustomColumnValues / OPERATORS key names used in tokens
    // (e.g. token.value === 'ADDITION', not '+').
    const PREC = { ADDITION: 1, SUBTRACTION: 1, MULTIPLICATION: 2, DIVISION: 2 }
    // Only these operators allow same-precedence bracket removal on their right side
    const ASSOC_OPS = new Set(['ADDITION', 'MULTIPLICATION'])

    const getPrec = (token) => (token?.type === CustomColumnTypes.OPERATOR ? (PREC[token.value] ?? 0) : 0)

    // Minimum precedence of all operators at depth-0 within a token slice
    const minDepth0Prec = (tokens) => {
      let depth = 0
      let min = Infinity
      for (const t of tokens) {
        if (t?.value === CustomColumnValues.LEFT_BRACKET) depth++
        else if (t?.value === CustomColumnValues.RIGHT_BRACKET) depth--
        else if (depth === 0 && PREC[t?.value] != null) min = Math.min(min, PREC[t.value])
      }
      return min
    }

    // Iteratively remove bracket pairs that are semantically redundant given operator precedence.
    // A pair ( inner ) is redundant when:
    //   - RIGHT: inner's weakest op >= the operator to the right's precedence
    //   - LEFT:  inner's weakest op > the operator to the left's precedence
    //            OR same precedence AND left operator is truly associative (+, *)
    let changed = true
    let passnum = 0
    const maxIterations = 50 // Safety guard to prevent infinite loops from bracket-matching logic bugs
    while (changed && passnum < maxIterations) {
      passnum++
      changed = false
      for (let i = 0; i < result.length; i++) {
        if (result[i]?.value !== CustomColumnValues.LEFT_BRACKET) continue
        // Find the matching closing bracket via balanced counting
        let depth = 1
        let j = i + 1
        while (j < result.length && depth > 0) {
          if (result[j]?.value === CustomColumnValues.LEFT_BRACKET) depth++
          else if (result[j]?.value === CustomColumnValues.RIGHT_BRACKET) depth--
          j++
        }
        const rbIdx = j - 1
        const inner = result.slice(i + 1, rbIdx)
        const preserve =
          result[i]?.preserve ||
          result[rbIdx]?.preserve

        // For edit readability, unwrap non-preserved brackets around a single token.
        // Keep preserved pairs (explicit user/grouping intent).
        if (inner.length <= 1) {
          if (!preserve) {
            result = [...result.slice(0, i), ...inner, ...result.slice(rbIdx + 1)]
            changed = true
            break
          }
          continue
        }
        const leftOp = result[i - 1]
        const rightOp = result[rbIdx + 1]
        const lPrec = getPrec(leftOp)
        const rPrec = getPrec(rightOp)
        const innerMinP = minDepth0Prec(inner)

        const rightOk = innerMinP >= rPrec
        const leftOk = innerMinP > lPrec || (innerMinP === lPrec && leftOp && ASSOC_OPS.has(leftOp.value))

        if (rightOk && leftOk && !preserve) {
          result = [...result.slice(0, i), ...inner, ...result.slice(rbIdx + 1)]
          changed = true
          break
        }
      }
    }

    return result
  }

  // Create a mutator with defensive validation to avoid generating invalid JS
  safeCreateMutatorFn = (columnFn) => {
    try {
      const fn = columnFn || []
      for (let i = 0; i < fn.length - 1; i++) {
        const left = fn[i]
        const right = fn[i + 1]
        const leftIsOperand = left?.type !== CustomColumnTypes.OPERATOR
        const rightIsOperand = right?.type !== CustomColumnTypes.OPERATOR
        const rightIsLeftBracket = right?.type === CustomColumnTypes.OPERATOR && right?.value === CustomColumnValues.LEFT_BRACKET
        if (leftIsOperand && (rightIsOperand || rightIsLeftBracket)) {
          return { error: new Error('Invalid operator sequence') }
        }
      }
      // simple parentheses balance check
      let balance = 0
      for (const chunk of fn) {
        if (chunk?.type === CustomColumnTypes.OPERATOR) {
          if (chunk.value === CustomColumnValues.LEFT_BRACKET) balance++
          if (chunk.value === CustomColumnValues.RIGHT_BRACKET) balance--
          if (balance < 0) return { error: new Error('Mismatched parentheses') }
        }
      }
      if (balance !== 0) return { error: new Error('Mismatched parentheses') }

      return createMutatorFn(fn)
    } catch (e) {
      return { error: e }
    }
  }

  hasCustomColumnsInFormula = () => {
    return (this.state.columnFn || []).some(
      (chunk) => chunk?.type === CustomColumnTypes.COLUMN && chunk?.column?.custom_column_display_name,
    )
  }

  isFormulaAlreadyWrapped = (arr) => arr?.[0]?.value === CustomColumnValues.LEFT_BRACKET && arr?.[arr.length - 1]?.value === CustomColumnValues.RIGHT_BRACKET

  addColumnToFormula = (col, columnFn, lastTerm) => {
    // Determine if column has explicit tokens, or build from SQL if complex
    let colTokens = col?.columnFnArray
    if (colTokens?.length) {
      // Normalize incoming tokens from saved/derived columns so wrapper-only
      // operands like `(Under Profit)` are treated as a single operand.
      colTokens = this.cleanColumnFn(_cloneDeep(colTokens))
    }
    if (!colTokens && this.isComplexColumn(col)) {
      // Column is complex but doesn't have explicit tokens — build from table_column SQL
      colTokens = this.buildFnArray(col.table_column, this.state.columns)
    }

    // If the source column has an explicit or derived multi-token list, insert its
    // tokens directly into the current formula wrapped with brackets. This preserves
    // the original grouping (e.g. `(Goals + Assists)`) when composing expressions.
    if (colTokens && colTokens.length > 1) {
      // If the last term is not an operator, replace the previous token with the
      // entire token list; otherwise append.
      if (lastTerm && lastTerm.type !== CustomColumnTypes.OPERATOR) {
        // remove the previous token
        columnFn.splice(columnFn.length - 1, 1)
      }
      // Insert left bracket, the cloned tokens, then right bracket
      columnFn.push({ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.LEFT_BRACKET })
      for (const t of _cloneDeep(colTokens)) columnFn.push(t)
      columnFn.push({ type: CustomColumnTypes.OPERATOR, value: CustomColumnValues.RIGHT_BRACKET })
    } else {
      const newChunk = {
        type: 'column',
        value: col.field,
        column: col,
      }

      if (lastTerm && lastTerm.type !== CustomColumnTypes.OPERATOR) {
        columnFn[columnFn.length - 1] = newChunk
      } else {
        columnFn.push(newChunk)
      }

      const chunkIndex = columnFn.length - 1

      if (this.isComplexColumn(col)) {
        // Only add brackets if: (1) not adjacent-wrapped in formula, and (2) column not already wrapped
        if (
          !(columnFn[chunkIndex - 1]?.value === CustomColumnValues.LEFT_BRACKET &&
            columnFn[chunkIndex + 1]?.value === CustomColumnValues.RIGHT_BRACKET) &&
          !this.isFormulaAlreadyWrapped(col?.columnFnArray)
        ) {
          columnFn.splice(chunkIndex + 1, 0, { type: 'operator', value: CustomColumnValues.RIGHT_BRACKET })
          columnFn.splice(chunkIndex, 0, { type: 'operator', value: CustomColumnValues.LEFT_BRACKET })
        }
      }
    }
  }

  onAddColumnConfirm = () => {
    const newColumn = this.validateAndPrepareColumn()
    if (!newColumn) return

    const protoTableColumn = this.getColumnSQLWithOptionalBrackets(newColumn.columnFnArray)
    const columnDisplayName = this.state?.columnName?.trim()

    this.props.onAddColumn({
      ...newColumn,
      name: columnDisplayName,
      columnFnArray: newColumn.columnFnArray,
      table_column: protoTableColumn,
      custom_column_display_name: columnDisplayName,
    })
  }

  changeChunkOrderby = (value, type, i) => {
    if (type === CustomColumnTypes.FUNCTION) {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].orderby = value
      }
      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
    }
  }

  changeChunkRowsOrRangeStart = (value, type, i) => {
    if (type === CustomColumnTypes.FUNCTION) {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].rowsOrRangeOptionPre = value
      }
      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
    }
  }

  changeChunkRowsOrRangeEnd = (value, type, i) => {
    if (type === CustomColumnTypes.FUNCTION) {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].rowsOrRangeOptionPost = value
      }
      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
    }
  }

  changeChunkGroupby = (value, type, i) => {
    if (type === CustomColumnTypes.FUNCTION) {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].groupby = value
      }
      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
    }
  }

  changeChunkRowsOrRange = (value, type, i) => {
    if (type === CustomColumnTypes.FUNCTION) {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].rowsOrRange = value
      }
      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
    }
  }

  changeChunkOrderbyDirection = (value, type, i) => {
    if (type === CustomColumnTypes.FUNCTION) {
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].orderbyDirection = value
      }
      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
    }
  }

  changeChunkValue = (value, type, i) => {
    if (type === CustomColumnTypes.COLUMN || type === CustomColumnTypes.FUNCTION) {
      const column = this.props.columns.find((col) => col.field === value)
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].value = value
        columnFn[i].column = column
      }

      this.setState({ columnFn })
      this.syncNewColumnFnArray(columnFn)
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

  hasVariablesInColumnFn = () => {
    const columnFn = this.state.columnFn || []
    return columnFn.some(
      (chunk) =>
        chunk &&
        (chunk.type === CustomColumnTypes.COLUMN ||
          (chunk.type === CustomColumnTypes.NUMBER && !this.isValueEmpty(chunk?.value)) ||
          (chunk.type === CustomColumnTypes.FUNCTION && (chunk.fn || chunk.column || chunk.nTileNumber))),
    )
  }

  isFormulaComplete = () => {
    const columnFn = this.state.columnFn || []
    if (columnFn.length === 0) return false
    const lastChunk = columnFn[columnFn.length - 1]
    // Treat a newly inserted custom-number placeholder as incomplete until user enters a value.
    if (lastChunk?.type === CustomColumnTypes.NUMBER && this.isValueEmpty(lastChunk?.value)) return false
    // If the last chunk is an operator (and not a right bracket), the formula is incomplete
    if (lastChunk?.type === CustomColumnTypes.OPERATOR && lastChunk?.value !== CustomColumnValues.RIGHT_BRACKET)
      return false
    return true
  }

  isStructurallyValidColumnFn = () => {
    const columnFn = this.state.columnFn || []
    for (let i = 0; i < columnFn.length - 1; i++) {
      const a = columnFn[i]
      const b = columnFn[i + 1]
      // Disallow adjacency of two operands (e.g. `8 2`) or operand followed
      // by left bracket (e.g. `8 (`) which indicates a missing operator.
      const aIsOperand = a?.type !== CustomColumnTypes.OPERATOR
      const bIsOperand = b?.type !== CustomColumnTypes.OPERATOR
      const bIsLeftBracket = b?.type === CustomColumnTypes.OPERATOR && b?.value === CustomColumnValues.LEFT_BRACKET
      if ((aIsOperand && bIsOperand) || (aIsOperand && bIsLeftBracket)) {
        return { valid: false, error: 'Invalid operator sequence' }
      }
      if (a?.type === CustomColumnTypes.OPERATOR && b?.type === CustomColumnTypes.OPERATOR) {
        const leftLeft = a?.value === CustomColumnValues.LEFT_BRACKET && b?.value === CustomColumnValues.LEFT_BRACKET
        const rightRight =
          a?.value === CustomColumnValues.RIGHT_BRACKET && b?.value === CustomColumnValues.RIGHT_BRACKET
        const unaryAllowed =
          (b?.value === CustomColumnValues.ADDITION || b?.value === CustomColumnValues.SUBTRACTION) &&
          (a?.value === CustomColumnValues.LEFT_BRACKET || i === 0)
        // Allow `)anything`, `(+`, `(-`, `((`, `))`, `operator(`
        const afterRightBracket = a?.value === CustomColumnValues.RIGHT_BRACKET
        const bracketAfterOp =
          b?.value === CustomColumnValues.LEFT_BRACKET && a?.value !== CustomColumnValues.RIGHT_BRACKET
        if (!leftLeft && !rightRight && !unaryAllowed && !afterRightBracket && !bracketAfterOp) {
          return { valid: false, error: 'Invalid operator sequence' }
        }
      }
    }

    let balance = 0
    for (let i = 0; i < columnFn.length; i++) {
      const chunk = columnFn[i]
      if (chunk?.type === CustomColumnTypes.OPERATOR) {
        if (chunk.value === CustomColumnValues.LEFT_BRACKET) balance++
        if (chunk.value === CustomColumnValues.RIGHT_BRACKET) balance--
        if (balance < 0) return { valid: false, error: 'Mismatched parentheses' }
      }
    }
    if (balance !== 0) return { valid: false, error: 'Mismatched parentheses' }

    return { valid: true }
  }

  getColumnType = () => {
    const selectedColumnTypes = this.getFnColumns()?.map((col) => col.type)

    if (!selectedColumnTypes?.length && this.state.columnFn.find((chunk) => chunk.type === CustomColumnTypes.NUMBER)) {
      return ColumnTypes.QUANTITY
    }

    if (selectedColumnTypes.every((colType) => colType === selectedColumnTypes[0])) {
      return selectedColumnTypes[0]
    }

    if (selectedColumnTypes.find((colType) => colType === ColumnTypes.STRING)) {
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
      if (selectedColumnTypes.find((colType) => colType === ColumnTypes.DOLLAR_AMT)) {
        return ColumnTypes.DOLLAR_AMT
      }

      return ColumnTypes.QUANTITY
    }

    return ColumnTypes.STRING
  }

  shouldDisableOperator = (op) => {
    const { columnFn } = this.state
    const lastTerm = columnFn[columnFn.length - 1]

    if (FUNCTION_OPERATORS.includes(lastTerm?.value)) {
      return true
    }

    if (GLOBAL_OPERATORS.includes(op)) {
      if (op === CustomColumnValues.LEFT_BRACKET) {
        if (!lastTerm) {
          return false
        }

        if (lastTerm?.value === CustomColumnValues.RIGHT_BRACKET || lastTerm?.type !== CustomColumnTypes.OPERATOR) {
          // Cannot start bracket after another bracket or operand
          return true
        }
      }

      if (op === CustomColumnValues.RIGHT_BRACKET) {
        if (lastTerm?.value === CustomColumnValues.LEFT_BRACKET) {
          // Cannot have empty brackets
          return true
        }

        const numRightBrackets = columnFn.filter((chunk) => chunk.value === CustomColumnValues.RIGHT_BRACKET)?.length
        const numLeftBrackets = columnFn.filter((chunk) => chunk.value === CustomColumnValues.LEFT_BRACKET)?.length

        if (numRightBrackets >= numLeftBrackets) {
          // No more closing brackets than opening
          return true
        }
      }
    } else if (FUNCTION_OPERATORS.includes(op)) {
      if (!lastTerm) {
        return false
      }

      if (lastTerm?.value === CustomColumnValues.RIGHT_BRACKET || lastTerm?.type !== CustomColumnTypes.OPERATOR) {
        // Cannot use function after bracket or operand
        return true
      }
    } else if (
      lastTerm?.type === CustomColumnTypes.OPERATOR &&
      lastTerm?.value !== CustomColumnValues.RIGHT_BRACKET &&
      !FUNCTION_OPERATORS.includes(lastTerm?.value)
    ) {
      return true
    }

    return false
  }

  getNextSupportedOperators = () => {
    const columnType = this.getColumnType()
    const supportedOperators = COLUMN_TYPES[columnType]?.supportedOperators ?? []
    let operatorsArray = [...supportedOperators, ...GLOBAL_OPERATORS]

    if (
      this.props.enableWindowFunctions &&
      getColumnTypeAmounts(this.props.queryResponse?.data?.data?.columns)?.amountOfNumberColumns
    ) {
      operatorsArray = operatorsArray.concat(
        !this.state.columnFn || this.state.columnFn?.length === 0 ? FUNCTION_OPERATORS : [],
      )
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
      fn: this.state.selectedFnType
        ? this.state.selectedFnType
        : this.state.selectedFnOperation
        ? this.state.selectedFnOperation
        : null,
      column:
        WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === CustomColumnTypes.COLUMN
          ? this.props.columns.find((col) => col.field === this.state.selectedFnColumn)
          : WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === CustomColumnTypes.SUM
          ? this.props.columns.find((col) => col.field === this.state.selectedFnSum)
          : this.state.selectedFnColumn
          ? this.props.columns.find((col) => col.field === this.state.selectedFnColumn)
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
      movingAvgTimeInterval: this.state.selectedFnMovingAverageTimeInterval,
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
            this.state.selectedFnRowsOrRangeOptionPre !== CustomColumnRowRangeTypes.PRECEDING) || // preconditions are complete
            (this.state.selectedFnRowsOrRangeOptionPre === CustomColumnRowRangeTypes.PRECEDING &&
              this.state.selectedFnRowsOrRangeOptionPreNValue !== null)) &&
          ((this.state.selectedFnRowsOrRangeOptionPost !== null &&
            this.state.selectedFnRowsOrRangeOptionPost !== CustomColumnRowRangeTypes.FOLLOWING) || // postconditions are complete
            (this.state.selectedFnRowsOrRangeOptionPost === CustomColumnRowRangeTypes.FOLLOWING &&
              this.state.selectedFnRowsOrRangeOptionPostNValue !== null))
    const totalPercentComplete =
      this.state.selectedFnOperation === CustomColumnValues.PERCENT_OF_TOTAL && !!this.state.selectedFnColumn
    const rankComplete = this.state.selectedFnOperation === CustomColumnValues.RANK && !!this.state.selectedFnOrderBy
    const movingAvgComplete =
      this.state.selectedFnOperation === CustomColumnValues.MOVING_AVG &&
      !!this.state.selectedFnColumn &&
      !!this.state.selectedFnOrderBy &&
      !!this.state.selectedFnMovingAverageTimeInterval &&
      this.state.selectedFnMovingAverageTimeInterval > 0
    const cumulateiveSumComplete =
      this.state.selectedFnOperation === CustomColumnValues.CUMULATIVE_SUM &&
      !!this.state.selectedFnColumn &&
      !!this.state.selectedFnOrderBy
    const cumulateivePercentComplete =
      this.state.selectedFnOperation === CustomColumnValues.CUMULATIVE_PERCENT &&
      !!this.state.selectedFnColumn &&
      !!this.state.selectedFnOrderBy
    const changeComplete =
      this.state.selectedFnOperation === CustomColumnValues.CHANGE &&
      !!this.state.selectedFnColumn &&
      !!this.state.selectedFnOrderBy
    const metRequirements =
      (selectedFunc !== null &&
        (requiredCols === null || (requiredCols !== null && requiredNotSetArr?.length === 0)) &&
        rowOrRangeComplete) ||
      totalPercentComplete ||
      rankComplete ||
      movingAvgComplete ||
      cumulateiveSumComplete ||
      cumulateivePercentComplete ||
      changeComplete

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
    const label = this.getLabelForOperator(WINDOW_FUNCTIONS[chunk.fn]) ?? chunk.fn.replaceAll('_', ' ')
    return (
      <span>
        <span>{label}( </span>
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
            <span>{`${!!chunk.column || !!chunk.nTileNumber ? ', ' : ''}Partition By `} </span>
            <Select
              key={`custom-column-select-${i}`}
              placeholder='Select a Column'
              value={chunk.groupby}
              outlined={false}
              showArrow={false}
              className='react-autoql-available-column-selector'
              onChange={(value) => this.changeChunkGroupby(value, chunk.type, i)}
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
              onChange={(value) => this.changeChunkOrderby(value, chunk.type, i)}
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
            <Select
              key={`custom-orderedby-direction-select-${i}`}
              placeholder='Direction'
              value={chunk.orderbyDirection ?? null}
              outlined={false}
              showArrow={false}
              className='react-autoql-available-column-selector'
              onChange={(value) => this.changeChunkOrderbyDirection(value, chunk.type, i)}
              options={ORDERBY_DIRECTIONS}
              isDisabled={!chunk.orderby}
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
        options={supportedOperators
          .filter((op) => !FUNCTION_OPERATORS.includes(op))
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
    if (chunk.type === CustomColumnTypes.NUMBER) {
      chunkElement = this.renderCustomNumberInput(chunk, i)
    } else if (chunk.type === CustomColumnTypes.COLUMN) {
      chunkElement = this.renderAvailableColumnSelector(chunk, i)
    } else if (chunk.type === CustomColumnTypes.OPERATOR) {
      chunkElement = this.renderOperator(chunk, i)
    } else if (chunk.type === CustomColumnTypes.FUNCTION) {
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
              {!this.hasVariablesInColumnFn() ? (
                <span className='react-autoql-formula-builder-validation-message-warning'>
                  <Icon type='warning-triangle' warning /> Formula must include at least one variable
                </span>
              ) : !!this.state.fnError ? (
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
          {(columnFn.length === 0 || columnFn?.some((op) => op?.fn === undefined || op?.fn?.length === 0)) && (
            <>
              {!this.state.isFunctionConfigModalVisible && (
                <span className='react-autoql-formula-builder-column-container'>
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
                              lastTerm?.type === CustomColumnTypes.COLUMN ||
                              lastTerm?.type === CustomColumnTypes.NUMBER ||
                              lastTerm?.value === CustomColumnValues.RIGHT_BRACKET
                            }
                            onClick={() => {
                              this.addColumnToFormula(col, columnFn, lastTerm)
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
                          lastTerm?.type === CustomColumnTypes.COLUMN ||
                          lastTerm?.type === CustomColumnTypes.NUMBER ||
                          lastTerm?.value === CustomColumnValues.RIGHT_BRACKET
                        }
                        onClick={() => {
                          const newChunk = {
                            type: 'number',
                            value: undefined,
                            id: uuid(),
                          }

                          if (lastTerm && lastTerm.type !== CustomColumnTypes.OPERATOR) {
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
                            style={{
                              width: `${FUNCTION_OPERATORS.includes(op) ? '-webkit-fill-available' : 'undefined'}`,
                            }}
                            onClick={() => {
                              if (FUNCTION_OPERATORS.includes(op)) {
                                return this.setState({
                                  selectedFnOperation: op,
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
                                  selectedFnMovingAverageTimeInterval: null,
                                })
                              }

                              const newChunk = {
                                type: 'operator',
                                value: op,
                              }

                              if (
                                lastTerm &&
                                lastTerm?.type === CustomColumnTypes.OPERATOR &&
                                lastTerm?.value !== CustomColumnValues.RIGHT_BRACKET &&
                                op !== CustomColumnValues.LEFT_BRACKET &&
                                op !== CustomColumnValues.RIGHT_BRACKET
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
            </>
          )}
        </div>
        {this.state.isFunctionConfigModalVisible && (
          <div style={{ height: '100%' }}>
            {this.renderFunctionConfigModalContent()}
          </div>
        )}
      </div>
    )
  }

  renderTablePreview = () => {
    const originalResponse = this.props.queryResponse ?? {}

    const safeResponse = normalizePreviewResponse(originalResponse, this.state.columns)

    return (
      <div className='react-autoql-table-preview-wrapper'>
        <div className='react-autoql-input-label'>Preview</div>
        <div className='react-autoql-table-preview-container'>
          <React.Suspense fallback={<div />}>
            <LazyChataTable
              key={this.TABLE_ID}
              ref={(r) => (this.tableRef = r)}
              authentication={this.props.authentication}
              dataFormatting={this.props.dataFormatting}
              response={safeResponse}
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
          </React.Suspense>
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
    const dateColumns = getDateColumns(this.props.columns)

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
      <div style={{ height: '100%' }}>
        <div ref={(r) => (this.windowFnPopover = r)} style={{ minHeight: 'calc(100% - 50px)' }}>
          {this.state.selectedFnOperation === CustomColumnValues.FUNCTION && (
            <>
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
                      selectedFnMovingAverageTimeInterval: null,
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
                {WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === CustomColumnTypes.COLUMN && (
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
                {WINDOW_FUNCTIONS[this.state.selectedFnType]?.nextSelector === CustomColumnTypes.NUMBER && (
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
              </div>
              {stringColumns?.length > 0 &&
                this.state.selectedFnType !== null &&
                this.state.selectedFnType !== CustomColumnValues.PERCENT_OF_TOTAL && (
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
                  </div>
                )}

              {WINDOW_FUNCTIONS[this.state.selectedFnType]?.orderable &&
                this.state.selectedFnType !== CustomColumnValues.PERCENT_OF_TOTAL && (
                  <div>
                    <Select
                      label='Order By'
                      isRequired={this.isInputRequired('selectedFnOrderBy')}
                      className='custom-column-window-fn-selector'
                      value={this.state.selectedFnOrderBy ?? null}
                      onChange={(selectedFnOrderBy) =>
                        this.setState({ selectedFnOrderBy }, () => this.syncNewColumnFnArray(this.state.columnFn))
                      }
                      positions={['bottom', 'top', 'right', 'left']}
                      options={allColumnsOptions}
                    />
                    <Select
                      label='Order By Direction'
                      isRequired={this.isInputRequired('selectedFnOrderByDirection')}
                      className='custom-column-window-fn-selector'
                      value={this.state.selectedFnOrderByDirection ?? null}
                      onChange={(selectedFnOrderByDirection) =>
                        this.setState({ selectedFnOrderByDirection }, () =>
                          this.syncNewColumnFnArray(this.state.columnFn),
                        )
                      }
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
                                option.canEndWith === true &&
                                option.value !== this.state.selectedFnRowsOrRangeOptionPre,
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
            </>
          )}
          {this.state.selectedFnOperation === CustomColumnValues.PERCENT_OF_TOTAL && (
            <>
              <div>PERCENT OF TOTAL</div>
              <div>
                <Select
                  label='Total % of Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnColumn ?? null}
                  onChange={(selectedFnColumn) => {
                    this.setState({ selectedFnColumn })
                  }}
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
              </div>
              <div>
                <Select
                  label='Partition By Column'
                  isRequired={false}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnGroupby ?? null}
                  onChange={(selectedFnGroupby) => {
                    this.setState({ selectedFnGroupby })
                    if (selectedFnGroupby === null) this.setState({ selectedFnHaving: null })
                  }}
                  positions={['bottom', 'top', 'right', 'left']}
                  options={allColumnsOptions}
                />
              </div>
            </>
          )}
          {this.state.selectedFnOperation === CustomColumnValues.RANK && (
            <>
              <div>RANK</div>
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
              </div>
              <div>
                <Select
                  label='Order By Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnOrderBy ?? null}
                  onChange={(selectedFnOrderBy) =>
                    this.setState({ selectedFnOrderBy }, () => this.syncNewColumnFnArray(this.state.columnFn))
                  }
                  positions={['bottom', 'top', 'right', 'left']}
                  options={allColumnsOptions}
                />
                <Select
                  label='Order By Direction'
                  isRequired={this.isInputRequired('selectedFnOrderByDirection')}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnOrderByDirection ?? null}
                  onChange={(selectedFnOrderByDirection) =>
                    this.setState({ selectedFnOrderByDirection }, () => this.syncNewColumnFnArray(this.state.columnFn))
                  }
                  positions={['bottom', 'top', 'right', 'left']}
                  options={ORDERBY_DIRECTIONS}
                  isDisabled={!this.state.selectedFnOrderBy}
                  outlined={true}
                />
              </div>
            </>
          )}
          {this.state.selectedFnOperation === CustomColumnValues.MOVING_AVG && (
            <>
              <div>Moving Average</div>
              <div>
                <Select
                  label='Average Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnColumn ?? null}
                  onChange={(selectedFnColumn) => {
                    this.setState({ selectedFnColumn })
                  }}
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
              </div>
              <div>
                <Select
                  label='Order By Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnOrderBy ?? null}
                  onChange={(selectedFnOrderBy) => {
                    this.setState({ selectedFnOrderBy })
                  }}
                  positions={['bottom', 'top', 'right', 'left']}
                  options={numericalColumns.concat(dateColumns).map((col) => {
                    return {
                      value: col.field,
                      label: col.title,
                      listLabel: col.title,
                      icon: 'table',
                    }
                  })}
                />
              </div>
              <div>
                <Input
                  label='Precede Interval'
                  isRequired={true}
                  type='number'
                  showSpinWheel={true}
                  placeholder='eg. "10"'
                  defaultValue={this.state.selectedFnMovingAverageTimeInterval ?? null}
                  onChange={(e) => {
                    this.setState({ selectedFnMovingAverageTimeInterval: e.target.value })
                  }}
                />
              </div>
            </>
          )}
          {this.state.selectedFnOperation === CustomColumnValues.CUMULATIVE_SUM && (
            <>
              <div>Cumulative Sum</div>
              <div>
                <Select
                  label='Cumulative Sum Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnColumn ?? null}
                  onChange={(selectedFnColumn) => {
                    this.setState({ selectedFnColumn })
                  }}
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
              </div>
              <div>
                <Select
                  label='Order By Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnOrderBy ?? null}
                  onChange={(selectedFnOrderBy) => {
                    this.setState({ selectedFnOrderBy })
                  }}
                  positions={['bottom', 'top', 'right', 'left']}
                  options={numericalColumns.concat(dateColumns).map((col) => {
                    return {
                      value: col.field,
                      label: col.title,
                      listLabel: col.title,
                      icon: 'table',
                    }
                  })}
                />
              </div>
            </>
          )}
          {this.state.selectedFnOperation === CustomColumnValues.CUMULATIVE_PERCENT && (
            <>
              <div>Cumulative Percent</div>
              <div>
                <Select
                  label='Cumulative Percent Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnColumn ?? null}
                  onChange={(selectedFnColumn) => {
                    this.setState({ selectedFnColumn })
                  }}
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
              </div>
              <div>
                <Select
                  label='Order By Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnOrderBy ?? null}
                  onChange={(selectedFnOrderBy) => {
                    this.setState({ selectedFnOrderBy })
                  }}
                  positions={['bottom', 'top', 'right', 'left']}
                  options={numericalColumns.concat(dateColumns).map((col) => {
                    return {
                      value: col.field,
                      label: col.title,
                      listLabel: col.title,
                      icon: 'table',
                    }
                  })}
                />
              </div>
            </>
          )}
          {this.state.selectedFnOperation === CustomColumnValues.CHANGE && (
            <>
              <div>Change Value</div>
              <div>
                <Select
                  label='Change Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnColumn ?? null}
                  onChange={(selectedFnColumn) => {
                    this.setState({ selectedFnColumn })
                  }}
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
              </div>
              <div>
                <Select
                  label='Order By Column'
                  isRequired={true}
                  className='custom-column-window-fn-selector'
                  value={this.state.selectedFnOrderBy ?? null}
                  onChange={(selectedFnOrderBy) => {
                    this.setState({ selectedFnOrderBy })
                  }}
                  positions={['bottom', 'top', 'right', 'left']}
                  options={numericalColumns.concat(dateColumns).map((col) => {
                    return {
                      value: col.field,
                      label: col.title,
                      listLabel: col.title,
                      icon: 'table',
                    }
                  })}
                />
              </div>
            </>
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
          confirmDisabled={
            !this.state.isFnValid ||
            !this.state.isColumnNameValid ||
            !this.state.columnFn?.length ||
            !this.hasVariablesInColumnFn()
          }
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
