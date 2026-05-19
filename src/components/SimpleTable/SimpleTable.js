import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { formatElement, dataFormattingDefault } from 'autoql-fe-utils'

import { dataFormattingType } from '../../props/types'

import './SimpleTable.scss'

const ROW_HEIGHT = 36
const OVERSCAN = 10
const MIN_COL_WIDTH = 50
const WIDTH_BUFFER = 5

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
  }

  static defaultProps = {
    columns: [],
    rows: [],
    dataFormatting: dataFormattingDefault,
  }

  constructor(props) {
    super(props)
    this.state = {
      startIdx: 0,
      endIdx: Math.min(props.rows.length, OVERSCAN * 3),
      columnWidths: [],
      minHeaderWidths: [],
      isResizing: false,
    }
    this.scrollContainerRef = React.createRef()
    this.tableRef = React.createRef()
  }

  componentDidMount() {
    this.captureColumnWidths()
    this.scrollContainerRef.current?.addEventListener('scroll', this.onScroll, { passive: true })
  }

  componentDidUpdate(prevProps) {
    if (prevProps.rows !== this.props.rows) {
      this.setState({ startIdx: 0, endIdx: Math.min(this.props.rows.length, OVERSCAN * 3) })
    }
    if (prevProps.columns !== this.props.columns) {
      this.setState({ columnWidths: [], minHeaderWidths: [] }, this.captureColumnWidths)
    }
  }

  componentWillUnmount() {
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
    const scrollTop = el.scrollTop
    const viewHeight = el.clientHeight
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const endIdx = Math.min(
      this.props.rows.length,
      Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + OVERSCAN,
    )
    if (startIdx !== this.state.startIdx || endIdx !== this.state.endIdx) {
      this.setState({ startIdx, endIdx })
    }
  }

  captureColumnWidths = () => {
    const el = this.tableRef.current
    if (!el) return
    const ths = Array.from(el.querySelectorAll('thead th'))
    if (!ths.length) return

    // Measure header text natural width (batch write + read = one reflow)
    const contentDivs = ths.map((th) => th.querySelector('.simple-table-header-cell-content'))
    contentDivs.forEach((div) => { if (div) div.style.display = 'inline-block' })
    const minHeaderWidths = contentDivs.map((div) =>
      div ? Math.ceil(div.getBoundingClientRect().width) : MIN_COL_WIDTH,
    )
    contentDivs.forEach((div) => { if (div) div.style.display = '' })

    // Temporarily disable overflow:hidden so cells report their full scrollWidth
    el.classList.add('simple-table-measuring')
    const widths = ths.map((_, colIndex) => {
      const tds = Array.from(el.querySelectorAll(`tbody td:nth-child(${colIndex + 1})`))
        .filter(td => td.colSpan < 2)
      let max = minHeaderWidths[colIndex]
      tds.forEach((td) => { max = Math.max(max, td.scrollWidth + WIDTH_BUFFER) })
      return Math.max(max, MIN_COL_WIDTH)
    })
    el.classList.remove('simple-table-measuring')

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

    const headerTh = el.querySelectorAll('thead th')[colIndex]

    // Measure header text natural width as floor
    let minWidth = MIN_COL_WIDTH
    const contentDiv = headerTh?.querySelector('.simple-table-header-cell-content')
    if (contentDiv) {
      contentDiv.style.display = 'inline-block'
      minWidth = Math.ceil(contentDiv.getBoundingClientRect().width)
      contentDiv.style.display = ''
    }

    // Set to 1px so all cells overflow — scrollWidth becomes their natural content width
    el.style.setProperty(`--col-${colIndex}-width`, '1px')
    const tds = Array.from(el.querySelectorAll(`tbody td:nth-child(${colIndex + 1})`))
      .filter(td => td.colSpan < 2)
    let maxWidth = minWidth
    tds.forEach((td) => { maxWidth = Math.max(maxWidth, td.scrollWidth + WIDTH_BUFFER) })

    const newWidths = [...this.state.columnWidths]
    newWidths[colIndex] = maxWidth
    this.applyColVarsToDom(newWidths)
    this.setState({ columnWidths: newWidths })
  }

  isNumericType = (type) => {
    return type === 'DOLLAR_AMT' || type === 'QUANTITY' || type === 'RATIO' || type === 'PERCENT'
  }

  startResize = (e, colIndex) => {
    e.preventDefault()
    e.stopPropagation()
    this.resizeStartX = e.clientX
    this.resizeColIndex = colIndex
    this.resizeStartWidth = this.state.columnWidths[colIndex] || MIN_COL_WIDTH
    this.resizeMinWidth = Math.max(MIN_COL_WIDTH, this.state.minHeaderWidths[colIndex] || MIN_COL_WIDTH)
    this.resizeStartTotalWidth = this.state.columnWidths.reduce((sum, w) => sum + (w || 0), 0)
    this.setState({ isResizing: true })
    document.addEventListener('mousemove', this.onResizeMouseMove)
    document.addEventListener('mouseup', this.onResizeMouseUp)
  }

  onResizeMouseMove = (e) => {
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
          onDoubleClick={(e) => { e.stopPropagation(); this.fitColumnToData(colIndex) }}
        />
      </td>
    )
  }

  renderHeader = () => {
    const { columns } = this.props
    const { columnWidths } = this.state
    return (
      <thead className='simple-table-header'>
        <tr>
          {columns.map((col, i) => (
            <th
              key={i}
              className='simple-table-header-cell'
              style={columnWidths.length ? { width: `var(--col-${i}-width)` } : undefined}
            >
              <div className='simple-table-header-cell-content'>{col.display_name}</div>
              <div
                className='simple-table-resize-handle'
                onMouseDown={(e) => this.startResize(e, i)}
                onDoubleClick={(e) => { e.stopPropagation(); this.fitColumnToData(i) }}
              />
            </th>
          ))}
        </tr>
      </thead>
    )
  }

  renderRows = () => {
    const { columns, rows } = this.props
    const { startIdx, endIdx } = this.state
    const totalHeight = rows.length * ROW_HEIGHT
    const topPad = startIdx * ROW_HEIGHT
    const bottomPad = totalHeight - endIdx * ROW_HEIGHT

    return (
      <tbody>
        {topPad > 0 && (
          <tr style={{ height: topPad }}>
            <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
          </tr>
        )}
        {rows.slice(startIdx, endIdx).map((row, i) => {
          const rowIndex = startIdx + i
          return (
            <tr
              key={rowIndex}
              className={`simple-table-row${rowIndex % 2 === 1 ? ' simple-table-row-even' : ''}`}
            >
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
      columnWidths.forEach((w, i) => { tableVarStyle[`--col-${i}-width`] = `${w}px` })
      tableVarStyle['--table-width'] = `${columnWidths.reduce((s, w) => s + (w || 0), 0)}px`
    }

    return (
      <div
        className={`simple-table-outer-container${isResizing ? ' simple-table-resizing' : ''}`}
        ref={this.scrollContainerRef}
      >
        <div className='simple-table-scroll-inner'>
          <table
            className='simple-table'
            ref={this.tableRef}
            style={hasWidths ? { tableLayout: 'fixed', width: 'var(--table-width)', ...tableVarStyle } : undefined}
          >
            {this.renderHeader()}
            {rows.length > 0 ? this.renderRows() : null}
          </table>
          {rows.length === 0 && (
            <div className='simple-table-empty'>No data available</div>
          )}
        </div>
      </div>
    )
  }
}
