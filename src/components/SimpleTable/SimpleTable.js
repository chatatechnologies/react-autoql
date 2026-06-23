import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {
  formatElement,
  dataFormattingDefault,
  dateSortFn,
  ColumnTypes,
  setHeaderFilterPlaceholder,
  createFilterFunction,
  isColumnNumberType,
  getFilterPrecision,
  DAYJS_PRECISION_FORMATS,
} from 'autoql-fe-utils'

import dayjs from '../../js/dayjsWithPlugins'
import { dataFormattingType } from '../../props/types'
import { Popover } from '../Popover'
import { DateRangePicker } from '../DateRangePicker'
import { Button } from '../Button'

import './SimpleTable.scss'

const ROW_HEIGHT = 36
const OVERSCAN = 10
const MIN_COL_WIDTH = 50
const WIDTH_BUFFER = 20

export default class SimpleTable extends Component {
  static propTypes = {
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        display_name: PropTypes.string,
        dow_style: PropTypes.string,
        type: PropTypes.string,
        precision: PropTypes.string,
        maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.bool]),
        minWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.bool]),
      }),
    ),
    rows: PropTypes.array,
    dataFormatting: dataFormattingType,
    maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }

  static defaultProps = {
    columns: [],
    rows: [],
    dataFormatting: dataFormattingDefault,
    maxHeight: undefined,
  }

  constructor(props) {
    super(props)
    this.state = {
      startIdx: 0,
      endIdx: Math.min(props.rows.length, OVERSCAN * 3),
      columnWidths: [],
      minHeaderWidths: [],
      isResizing: false,
      isFiltering: false,
      sortCol: null,
      sortDir: null,
      filterInputValues: {},
      filterValues: {},
      datePickerColumn: null,
      datePickerColIndex: null,
      dateRangeSelection: null,
    }
    this.currentDateRangeSelections = {}
    this.scrollContainerRef = React.createRef()
    this.tableRef = React.createRef()
  }

  componentDidMount() {
    this._isMounted = true
    this.captureColumnWidths()
    this.scrollContainerRef.current?.addEventListener('scroll', this.onScroll, { passive: true })
  }

  componentDidUpdate(prevProps) {
    if (prevProps.rows !== this.props.rows) {
      this.setState({
        startIdx: 0,
        endIdx: Math.min(this.props.rows.length, OVERSCAN * 3),
        sortCol: null,
        sortDir: null,
        filterInputValues: {},
        filterValues: {},
      })
    }
    if (prevProps.columns !== this.props.columns) {
      this.setState(
        { columnWidths: [], minHeaderWidths: [], sortCol: null, sortDir: null, filterInputValues: {}, filterValues: {} },
        this.captureColumnWidths,
      )
    }

  }

  componentWillUnmount() {
    this._isMounted = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    if (this.scrollRafId) cancelAnimationFrame(this.scrollRafId)
    this.scrollContainerRef.current?.removeEventListener('scroll', this.onScroll)
    document.removeEventListener('mousemove', this.onResizeMouseMove)
    document.removeEventListener('mouseup', this.onResizeMouseUp)
  }

  onScroll = () => {
    if (this.scrollRafId) cancelAnimationFrame(this.scrollRafId)
    this.scrollRafId = requestAnimationFrame(this.updateVisibleRange)
  }

  updateVisibleRange = () => {
    const el = this.scrollContainerRef.current
    if (!el) return
    const rowCount = this._visibleRowCount ?? this.props.rows.length
    const scrollTop = el.scrollTop
    const viewHeight = el.clientHeight
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const endIdx = Math.min(rowCount, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + OVERSCAN)
    if (startIdx !== this.state.startIdx || endIdx !== this.state.endIdx) {
      this.setState({ startIdx, endIdx })
    }
  }

  captureColumnWidths = () => {
    const el = this.tableRef.current
    if (!el) return
    const ths = Array.from(el.querySelectorAll('thead th'))
    if (!ths.length) return

    // Force fixed layout, override min-width: 100%, set each th directly to 1px.
    // CSS vars aren't applied to <th> on initial render (hasWidths=false, no style prop),
    // so we must set th.style.width directly. Clearing min-width prevents it from
    // overriding the narrow table width and distributing columns at container-width/N.
    el.style.tableLayout = 'fixed'
    el.style.width = '1px'
    el.style.minWidth = '0'
    ths.forEach((th) => {
      th.style.width = '1px'
    })

    const minHeaderWidths = ths.map((th) => {
      const div = th.querySelector('.simple-table-header-cell-content')
      return div ? Math.ceil(div.scrollWidth) : MIN_COL_WIDTH
    })

    const widths = ths.map((_, colIndex) => {
      const tds = Array.from(el.querySelectorAll(`tbody td:nth-child(${colIndex + 1})`)).filter((td) => td.colSpan < 2)
      let max = minHeaderWidths[colIndex] + WIDTH_BUFFER
      tds.forEach((td) => {
        max = Math.max(max, td.scrollWidth + WIDTH_BUFFER)
      })
      return Math.max(max, MIN_COL_WIDTH)
    })

    el.style.tableLayout = ''
    el.style.width = ''
    el.style.minWidth = ''
    ths.forEach((th) => {
      th.style.width = ''
    })

    if (widths.some((w) => w > 0)) {
      this.applyColVarsToDom(widths)
      this.setState({ columnWidths: widths, minHeaderWidths })
    }
  }

  applyColVarsToDom = (widths) => {
    const el = this.tableRef.current
    if (!el) return
    const total = widths.reduce((sum, w) => sum + (w || 0), 0)
    widths.forEach((w, i) => el.style.setProperty(`--col-${i}-width`, `${w}px`))
    el.style.setProperty('--table-width', `${total}px`)
  }

  fitColumnToData = (colIndex) => {
    const el = this.tableRef.current
    if (!el) return

    // Clear min-width so table can narrow; set column to 1px so scrollWidth = natural content width
    el.style.minWidth = '0'
    el.style.setProperty(`--col-${colIndex}-width`, '1px')

    const headerTh = el.querySelectorAll('thead th')[colIndex]
    const contentDiv = headerTh?.querySelector('.simple-table-header-cell-content')
    const minWidth = contentDiv ? Math.ceil(contentDiv.scrollWidth) : MIN_COL_WIDTH

    const tds = Array.from(el.querySelectorAll(`tbody td:nth-child(${colIndex + 1})`)).filter((td) => td.colSpan < 2)
    let maxWidth = minWidth
    tds.forEach((td) => {
      maxWidth = Math.max(maxWidth, td.scrollWidth + WIDTH_BUFFER)
    })

    el.style.minWidth = ''
    const newWidths = [...this.state.columnWidths]
    newWidths[colIndex] = maxWidth
    this.applyColVarsToDom(newWidths)
    this.setState({ columnWidths: newWidths })
  }


  handleHeaderClick = (colIndex) => {
    if (this.resizeDragged) return
    const { sortCol, sortDir } = this.state
    const { rows } = this.props
    let newState
    if (sortCol !== colIndex) {
      newState = { sortCol: colIndex, sortDir: 'asc' }
    } else if (sortDir === 'asc') {
      newState = { sortCol: colIndex, sortDir: 'desc' }
    } else {
      newState = { sortCol: null, sortDir: null }
    }
    if (this.scrollContainerRef.current) {
      this.scrollContainerRef.current.scrollTop = 0
    }
    this.setState({ ...newState, startIdx: 0, endIdx: Math.min(rows.length, OVERSCAN * 3) })
  }

  toggleIsFiltering = (filterOn) => {
    const isFiltering = typeof filterOn === 'boolean' ? filterOn : !this.state.isFiltering
    this.setState({ isFiltering })
    return isFiltering
  }

  getHeaderFilters = () => {
    const { filterValues } = this.state
    return Object.entries(filterValues)
      .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
      .map(([field, value]) => ({ field, value }))
  }

  handleFilterChange = (colIndex, value) => {
    const filterInputValues = { ...this.state.filterInputValues, [colIndex]: value }
    this.setState({ filterInputValues })
  }

  applyFilter = (colIndex, value) => {
    const filterValues = { ...this.state.filterValues }
    if (value.trim()) {
      filterValues[colIndex] = value.trim()
    } else {
      delete filterValues[colIndex]
    }
    if (this.scrollContainerRef.current) this.scrollContainerRef.current.scrollTop = 0
    this.setState({ filterValues, startIdx: 0, endIdx: Math.min(this.props.rows.length, OVERSCAN * 3) })
  }

  handleFilterKeyDown = (colIndex, e) => {
    if (e.key === 'Enter') {
      this.applyFilter(colIndex, this.state.filterInputValues[colIndex] ?? '')
    }
  }

  clearFilter = (colIndex) => {
    const filterInputValues = { ...this.state.filterInputValues }
    const filterValues = { ...this.state.filterValues }
    delete filterInputValues[colIndex]
    delete filterValues[colIndex]
    delete this.currentDateRangeSelections[colIndex]
    if (this.scrollContainerRef.current) this.scrollContainerRef.current.scrollTop = 0
    this.setState({ filterInputValues, filterValues, startIdx: 0, endIdx: Math.min(this.props.rows.length, OVERSCAN * 3) })
  }

  handleDateInputClick = (col, colIndex, e) => {
    e.stopPropagation()
    this.setState({ datePickerColumn: col, datePickerColIndex: colIndex, dateRangeSelection: null })
  }

  onDateRangeSelection = (dateRangeSelection) => {
    this.setState({ dateRangeSelection })
  }

  onDateRangeSelectionApplied = () => {
    const { datePickerColumn, datePickerColIndex, dateRangeSelection } = this.state
    this.setState({ datePickerColumn: null, datePickerColIndex: null, dateRangeSelection: null })

    if (!dateRangeSelection || !datePickerColumn) return

    let { startDate, endDate } = dateRangeSelection
    if (startDate && !endDate) endDate = startDate
    else if (!startDate && endDate) startDate = endDate
    if (!startDate) return

    const filterPrecision = getFilterPrecision(datePickerColumn)
    const fmt = DAYJS_PRECISION_FORMATS[filterPrecision]

    const fmtDate = (d) => dayjs(dayjs(d).format(fmt)).utc().format(fmt)
    const formattedStart = fmtDate(startDate)
    const formattedEnd = fmtDate(endDate)
    const filterText = formattedStart === formattedEnd ? formattedStart : `${formattedStart} to ${formattedEnd}`

    this.currentDateRangeSelections[datePickerColIndex] = dateRangeSelection
    const filterInputValues = { ...this.state.filterInputValues, [datePickerColIndex]: filterText }
    const filterValues = { ...this.state.filterValues, [datePickerColIndex]: filterText }
    if (this.scrollContainerRef.current) this.scrollContainerRef.current.scrollTop = 0
    this.setState({ filterInputValues, filterValues, startIdx: 0, endIdx: Math.min(this.props.rows.length, OVERSCAN * 3) })
  }

  getFilteredRows = (rows) => {
    const { columns, dataFormatting } = this.props
    const { filterValues } = this.state
    const active = Object.entries(filterValues)
    if (!active.length) return rows

    if (
      this._filteredRows &&
      this._filteredRowsInput === rows &&
      this._filteredRowsFilterValues === filterValues
    ) {
      return this._filteredRows
    }

    const filterFns = active.map(([colIndexStr, filterVal]) => {
      const colIndex = parseInt(colIndexStr)
      const col = columns[colIndex]
      return { colIndex, filterVal, fn: createFilterFunction({ column: col, dataFormatting }) }
    })

    const result = rows.filter((row) =>
      filterFns.every(({ colIndex, filterVal, fn }) => fn(filterVal, row[colIndex])),
    )

    this._filteredRowsInput = rows
    this._filteredRowsFilterValues = filterValues
    this._filteredRows = result
    return result
  }

  getVisibleRows = () => {
    const filtered = this.getFilteredRows(this.props.rows)
    const result = this.getSortedRows(filtered)
    this._visibleRowCount = result.length
    return result
  }

  getSortedRows = (rows = this.props.rows) => {
    const { columns } = this.props
    const { sortCol, sortDir } = this.state
    if (sortCol === null || !sortDir) return rows

    const cacheKey = `${sortCol}-${sortDir}`
    if (this._sortedRows && this._sortCacheKey === cacheKey && this._sortedRowsInput === rows) {
      return this._sortedRows
    }

    const col = columns[sortCol]
    const isDate = col?.type === ColumnTypes.DATE || col?.type === ColumnTypes.DATE_STRING
    const isNumeric = isColumnNumberType(col)
    const isString = col?.type === ColumnTypes.STRING
    const multiplier = sortDir === 'asc' ? 1 : -1

    const decorated = rows.map((row) => {
      const val = row[sortCol]
      let key
      if (val == null || val === '') {
        key = null
      } else if (isNumeric) {
        const n = Number(val)
        key = isNaN(n) ? null : n
      } else if (isDate) {
        key = val
      } else {
        key = String(val)
      }
      return [key, row]
    })

    const nullsLast = ([a], [b]) => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return 0
    }

    if (isNumeric) {
      decorated.sort(([a], [b]) => nullsLast([a], [b]) || multiplier * (a - b))
    } else if (isDate) {
      decorated.sort(([a], [b]) => nullsLast([a], [b]) || multiplier * dateSortFn(a, b, col, 'isTable'))
    } else if (isString) {
      decorated.sort(([a], [b]) => nullsLast([a], [b]) || multiplier * a.localeCompare(b))
    } else {
      decorated.sort(([a], [b]) => nullsLast([a], [b]) || multiplier * a.localeCompare(b, undefined, { numeric: true }))
    }

    const sorted = decorated.map(([, row]) => row)

    this._sortCacheKey = cacheKey
    this._sortedRowsInput = rows
    this._sortedRows = sorted
    return sorted
  }

  startResize = (e, colIndex) => {
    e.preventDefault()
    e.stopPropagation()
    this.resizeStartX = e.clientX
    this.resizeColIndex = colIndex
    this.resizeStartWidth = this.state.columnWidths[colIndex] || MIN_COL_WIDTH
    this.resizeMinWidth = Math.max(MIN_COL_WIDTH, this.state.minHeaderWidths[colIndex] || MIN_COL_WIDTH)
    this.resizeStartTotalWidth = this.state.columnWidths.reduce((sum, w) => sum + (w || 0), 0)
    this.resizeDragged = false
    this.setState({ isResizing: true })
    document.addEventListener('mousemove', this.onResizeMouseMove)
    document.addEventListener('mouseup', this.onResizeMouseUp)
  }

  onResizeMouseMove = (e) => {
    this.resizeDragged = true
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = requestAnimationFrame(() => {
      const delta = e.clientX - this.resizeStartX
      const newWidth = Math.max(this.resizeStartWidth + delta, this.resizeMinWidth)
      const newTotal = this.resizeStartTotalWidth + (newWidth - this.resizeStartWidth)
      const el = this.tableRef.current
      if (el) {
        el.style.setProperty(`--col-${this.resizeColIndex}-width`, `${newWidth}px`)
        el.style.setProperty('--table-width', `${newTotal}px`)
      }
    })
  }

  onResizeMouseUp = () => {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    document.removeEventListener('mousemove', this.onResizeMouseMove)
    document.removeEventListener('mouseup', this.onResizeMouseUp)
    const el = this.tableRef.current
    const finalWidths = this.state.columnWidths.map((w, i) => {
      const val = el?.style.getPropertyValue(`--col-${i}-width`)
      return val ? parseFloat(val) : w
    })
    this.setState({ columnWidths: finalWidths, isResizing: false })
    // Clear after a tick so the click event fired on mouseup can check it first
    setTimeout(() => {
      this.resizeDragged = false
    }, 0)
  }

  renderCell = (cell, column, colIndex) => {
    const formatted = formatElement({ element: cell, column, config: this.props.dataFormatting })
    const textAlign = column?.hozAlign || undefined
    return (
      <td key={colIndex} className='simple-table-cell' style={{ textAlign }}>
        {formatted}
        <div
          className='simple-table-resize-handle'
          onMouseDown={(e) => this.startResize(e, colIndex)}
          onDoubleClick={(e) => {
            e.stopPropagation()
            this.fitColumnToData(colIndex)
          }}
        />
      </td>
    )
  }

  renderHeader = () => {
    const { columns } = this.props
    const { columnWidths, sortCol, sortDir, filterValues, isFiltering } = this.state
    return (
      <thead className='simple-table-header'>
        <tr>
          {columns.map((col, i) => {
            const dir = sortCol === i ? sortDir : null
            const isFiltered = !!filterValues[i]
            return (
              <th
                key={i}
                className={`simple-table-header-cell${isFiltered ? ' simple-table-header-cell--filtered' : ''}`}
                style={columnWidths.length ? { width: `var(--col-${i}-width)` } : undefined}
                onClick={() => this.handleHeaderClick(i)}
              >
                <div className='simple-table-header-cell-content'>{col.display_name}</div>
                <div className={`simple-table-sort-arrow simple-table-sort-arrow--${dir || 'none'}`} />
                <div
                  className='simple-table-resize-handle'
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => this.startResize(e, i)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    this.fitColumnToData(i)
                  }}
                />
              </th>
            )
          })}
        </tr>
        {isFiltering && this.renderFilterRow()}
      </thead>
    )
  }

  renderDateRangePickerPopover = () => {
    const { datePickerColumn, datePickerColIndex } = this.state
    if (!datePickerColumn) return null

    return (
      <Popover
        isOpen
        align='start'
        positions={['bottom', 'right', 'left', 'top']}
        onClickOutside={(e) => {
          e.stopPropagation()
          if (this._isMounted) this.setState({ datePickerColumn: null, datePickerColIndex: null, dateRangeSelection: null })
        }}
        content={
          <div className='react-autoql-popover-date-picker'>
            <h3>{datePickerColumn.display_name}</h3>
            <DateRangePicker
              initialRange={this.currentDateRangeSelections[datePickerColIndex]}
              onSelection={this.onDateRangeSelection}
              validRange={datePickerColumn.dateRange}
              type={datePickerColumn.precision}
            />
            <Button type='primary' onClick={this.onDateRangeSelectionApplied}>
              Apply
            </Button>
          </div>
        }
      >
        <span style={{ position: 'absolute' }} />
      </Popover>
    )
  }

  renderFilterRow = () => {
    const { columns } = this.props
    const { columnWidths, filterInputValues, filterValues, datePickerColIndex } = this.state
    return (
      <tr className='simple-table-filter-row'>
        {columns.map((col, i) => {
          const isDateCol = col.type === ColumnTypes.DATE
          const hasInput = !!(filterInputValues[i] || filterValues[i])
          const isDatePickerOpen = isDateCol && datePickerColIndex === i
          return (
            <td
              key={i}
              className='simple-table-filter-cell'
              style={columnWidths.length ? { width: `var(--col-${i}-width)` } : undefined}
            >
              <div className='simple-table-filter-input-wrapper' style={{ position: 'relative' }}>
                {isDatePickerOpen && this.renderDateRangePickerPopover()}
                <input
                  className='simple-table-filter-input'
                  placeholder={setHeaderFilterPlaceholder(col)}
                  value={filterInputValues[i] || ''}
                  readOnly={isDateCol}
                  onChange={isDateCol ? undefined : (e) => this.handleFilterChange(i, e.target.value)}
                  onKeyDown={isDateCol ? undefined : (e) => this.handleFilterKeyDown(i, e)}
                  onClick={isDateCol ? (e) => this.handleDateInputClick(col, i, e) : (e) => e.stopPropagation()}
                />
                {hasInput && (
                  <button
                    className='simple-table-filter-clear-btn'
                    onClick={(e) => { e.stopPropagation(); this.clearFilter(i) }}
                    tabIndex={-1}
                  >
                    ×
                  </button>
                )}
              </div>
            </td>
          )
        })}
      </tr>
    )
  }

  renderRows = (visibleRows) => {
    const { columns } = this.props
    const { startIdx, endIdx } = this.state
    const totalHeight = visibleRows.length * ROW_HEIGHT
    const topPad = startIdx * ROW_HEIGHT
    const bottomPad = totalHeight - endIdx * ROW_HEIGHT

    return (
      <tbody>
        {topPad > 0 && (
          <tr style={{ height: topPad }}>
            <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
          </tr>
        )}
        {visibleRows.slice(startIdx, endIdx).map((row, i) => {
          const rowIndex = startIdx + i
          return (
            <tr key={rowIndex} className={`simple-table-row${rowIndex % 2 === 0 ? ' simple-table-row-even' : ''}`}>
              {columns.map((col, colIndex) => this.renderCell(row[colIndex], col, colIndex))}
            </tr>
          )
        })}
        {bottomPad > 0 && (
          <tr style={{ height: bottomPad }}>
            <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
          </tr>
        )}
      </tbody>
    )
  }

  render() {
    const { rows } = this.props
    const { isResizing, columnWidths } = this.state
    const hasWidths = columnWidths.length > 0

    const tableVarStyle = {}
    if (hasWidths) {
      columnWidths.forEach((w, i) => {
        tableVarStyle[`--col-${i}-width`] = `${w}px`
      })
      tableVarStyle['--table-width'] = `${columnWidths.reduce((s, w) => s + (w || 0), 0)}px`
    }

    const visibleRows = this.getVisibleRows()
    const emptyMessage = rows.length === 0
      ? 'No data available'
      : visibleRows.length === 0 ? 'No results match the current filters' : null

    return (
      <div
        className={`simple-table-outer-container${isResizing ? ' simple-table-resizing' : ''}`}
        ref={this.scrollContainerRef}
        style={this.props.maxHeight != null ? { maxHeight: this.props.maxHeight, height: 'auto' } : undefined}
      >
        <div className='simple-table-scroll-inner'>
          <table
            className='simple-table'
            ref={this.tableRef}
            style={hasWidths ? { tableLayout: 'fixed', width: 'var(--table-width)', ...tableVarStyle } : undefined}
          >
            {this.renderHeader()}
            {visibleRows.length > 0 ? this.renderRows(visibleRows) : null}
          </table>
        </div>
        {emptyMessage && (
          <div className='simple-table-empty'>
            {emptyMessage}
          </div>
        )}
      </div>
    )
  }
}
