import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ColumnTypes, dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { SimpleTable } from '../../SimpleTable'
import { dataFormattingType } from '../../../props/types'

import StatusItem from './StatusItem'

const SCROLL_PAGE_RATIO = 0.8

/**
 * Table item. The API's column objects already use SimpleTable's shape
 * ({ display_name, dow_style, type, precision }) and the same ColumnTypes
 * vocabulary, and rows already arrive as an array of arrays - so both pass straight
 * through with no mapping layer. The only fixup is a type default, since SimpleTable
 * keys formatting and sorting off column.type.
 *
 * The card around it exists because a 22-column table in a 400px drawer is mostly
 * off-screen: the fade, the pager and the footer range are what tell the reader
 * there is more table to the right.
 */
const TableItem = ({ data, dataFormatting, maxHeight, isRevealed, onRevealComplete, onProgress }) => {
  const columns = useMemo(() => {
    return (data?.columns ?? []).map((column) => ({
      ...column,
      type: column?.type || ColumnTypes.STRING,
    }))
  }, [data])

  const rows = data?.rows ?? []
  const hasData = !!columns.length && !!rows.length

  const wrapperRef = useRef(null)
  const scrollElRef = useRef(null)
  const completedRef = useRef(false)
  const [scroll, setScroll] = useState({ left: 0, width: 0, scrollWidth: 0 })

  useEffect(() => {
    if (completedRef.current) {
      return
    }

    completedRef.current = true
    onProgress?.()
    onRevealComplete?.()
    // Reporting completion once on mount is the point - a table has nothing to type out.
  }, [])

  const syncScroll = useCallback(() => {
    const el = scrollElRef.current
    if (!el) {
      return
    }

    setScroll({ left: el.scrollLeft, width: el.clientWidth, scrollWidth: el.scrollWidth })
  }, [])

  // SimpleTable owns its own scroll container; find it by class rather than reaching
  // into the component instance. If the markup ever changes, the affordances below
  // simply stay hidden instead of breaking the table.
  useEffect(() => {
    if (!hasData) {
      return undefined
    }

    const el = wrapperRef.current?.querySelector('.simple-table-outer-container')
    scrollElRef.current = el ?? null

    if (!el) {
      return undefined
    }

    el.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('resize', syncScroll)
    // Column widths are measured after mount, so read once the table has settled.
    const timeout = setTimeout(syncScroll, 0)

    return () => {
      el.removeEventListener('scroll', syncScroll)
      window.removeEventListener('resize', syncScroll)
      clearTimeout(timeout)
    }
  }, [hasData, syncScroll])

  const pageRight = () => {
    scrollElRef.current?.scrollBy({ left: scrollElRef.current.clientWidth * SCROLL_PAGE_RATIO, behavior: 'smooth' })
  }

  // Which columns are currently in view, read off the rendered header cells.
  const visibleRange = useMemo(() => {
    const el = scrollElRef.current
    if (!el || !scroll.width) {
      return null
    }

    const headers = el.querySelectorAll('.simple-table-header-cell')
    if (!headers.length) {
      return null
    }

    let first = 1
    let last = headers.length

    for (let i = 0; i < headers.length; i++) {
      const { offsetLeft, offsetWidth } = headers[i]

      if (offsetLeft + offsetWidth > scroll.left) {
        first = i + 1
        break
      }
    }

    for (let i = 0; i < headers.length; i++) {
      const { offsetLeft, offsetWidth } = headers[i]

      if (offsetLeft + offsetWidth >= scroll.left + scroll.width) {
        last = i + 1
        break
      }
    }

    return { first, last, total: headers.length }
  }, [scroll])

  if (!hasData) {
    return <StatusItem data={{ text: 'This response included a table with no data.' }} type='status' />
  }

  // autoql-fe-utils' exportCSV fetches a CSV for a saved queryId, which session
  // responses don't have - the rows are already here, so build the file locally.
  const onExportCSV = () => {
    const escapeCell = (value) => {
      const cell = value === null || value === undefined ? '' : `${value}`
      return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
    }

    const csv = [
      columns.map((column) => escapeCell(column.display_name ?? column.name)).join(','),
      ...rows.map((row) => row.map(escapeCell).join(',')),
    ].join('\n')

    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    link.download = 'agent-response.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const canScrollX = scroll.scrollWidth > scroll.width + 1
  const isAtEnd = !canScrollX || scroll.left + scroll.width >= scroll.scrollWidth - 2
  const thumbWidth = canScrollX ? Math.max(8, (scroll.width / scroll.scrollWidth) * 100) : 100
  const thumbLeft = canScrollX ? (scroll.left / (scroll.scrollWidth - scroll.width)) * (100 - thumbWidth) : 0

  return (
    <div className={`react-autoql-agent-table-item${isRevealed ? '' : ' animate-in'}`} ref={wrapperRef}>
      <div className='react-autoql-agent-table-header'>
        <span className='react-autoql-agent-table-meta'>
          {rows.length.toLocaleString()} {rows.length === 1 ? 'row' : 'rows'} · {columns.length}{' '}
          {columns.length === 1 ? 'col' : 'cols'}
        </span>
        <button className='react-autoql-agent-table-action' onClick={onExportCSV} aria-label='Download as CSV'>
          <Icon type='download' />
          <span>CSV</span>
        </button>
      </div>

      <div className='react-autoql-agent-table-body'>
        <SimpleTable columns={columns} rows={rows} dataFormatting={dataFormatting} maxHeight={maxHeight} />
        {canScrollX && (
          <>
            <div className={`react-autoql-agent-table-fade${isAtEnd ? ' is-hidden' : ''}`} />
            <button
              className={`react-autoql-agent-table-pager${isAtEnd ? ' is-hidden' : ''}`}
              onClick={pageRight}
              aria-label='Scroll columns right'
              tabIndex={isAtEnd ? -1 : 0}
            >
              <Icon type='caret-right' />
            </button>
          </>
        )}
      </div>

      {canScrollX && (
        <div className='react-autoql-agent-table-footer'>
          <div className='react-autoql-agent-table-track'>
            <div
              className='react-autoql-agent-table-thumb'
              style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
            />
          </div>
          {!!visibleRange && (
            <span className='react-autoql-agent-table-range'>
              {visibleRange.first}–{visibleRange.last} of {visibleRange.total}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

TableItem.propTypes = {
  data: PropTypes.shape({ columns: PropTypes.array, rows: PropTypes.array }),
  dataFormatting: dataFormattingType,
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isRevealed: PropTypes.bool,
  onRevealComplete: PropTypes.func,
  onProgress: PropTypes.func,
}

TableItem.defaultProps = {
  data: {},
  dataFormatting: dataFormattingDefault,
  maxHeight: 400,
  isRevealed: false,
  onRevealComplete: undefined,
  onProgress: undefined,
}

export default TableItem
