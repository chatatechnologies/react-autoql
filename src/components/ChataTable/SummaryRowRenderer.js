import React from 'react'
import { isColumnSummable, formatElement } from 'autoql-fe-utils'
import { setupCopyableCell, handleCellCopy } from './CopyUtils'

export class SummaryRowRenderer {
  constructor(summaryTooltipId, tooltipCopyTexts, dataFormatting) {
    this.SUMMARY_TOOLTIP_ID = summaryTooltipId
    this.TOOLTIP_COPY_TEXTS = tooltipCopyTexts
    this.dataFormatting = dataFormatting
  }

  formatSummaryValue(value, col, colIdx) {
    if (typeof value === 'number') {
      return formatElement({ element: value, column: col, config: this.dataFormatting })
    }
    return value
  }

  getVisibleColumns(columns) {
    return columns.filter((col) => col.visible !== false && col.is_visible !== false)
  }

  needsLabelColumn(columns) {
    const visibleColumns = this.getVisibleColumns(columns)
    return (
      (visibleColumns.length === 1 && isColumnSummable(visibleColumns[0])) ||
      (visibleColumns.length > 1 && isColumnSummable(visibleColumns[0]))
    )
  }

  getColumnWidths(totalWidth) {
    const labelWidth = Math.max(80, totalWidth * 0.4)
    const valueWidth = totalWidth - labelWidth
    return { labelWidth, valueWidth }
  }

  createCellStyle(width, isLabel, columnAlign) {
    return {
      width,
      minWidth: width,
      maxWidth: width,
      padding: '4px 8px',
      borderRight: '1px solid var(--react-autoql-table-border-color)',
      background: 'var(--react-autoql-background-color-secondary)',
      fontWeight: isLabel ? 600 : 400,
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      fontSize: '11px',
      textAlign: isLabel ? 'left' : columnAlign || 'right',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      cursor: isLabel ? 'default' : 'pointer',
    }
  }

  createSummaryCell(type, value, width, isLabel = false, columnAlign, shouldEnableCopy = false, key) {
    const cellProps = {
      className: `tabulator-cell${shouldEnableCopy ? ' copyable-cell' : ''}${isLabel ? ' label-column' : ''}`,
      style: this.createCellStyle(width, isLabel, columnAlign),
      title: shouldEnableCopy ? null : value,
      ref: shouldEnableCopy
        ? (el) => el && setupCopyableCell(el, this.SUMMARY_TOOLTIP_ID, this.TOOLTIP_COPY_TEXTS.DEFAULT)
        : null,
      onContextMenu: shouldEnableCopy ? (e) => handleCellCopy(e, value, this.TOOLTIP_COPY_TEXTS) : undefined,
    }

    return (
      <div key={key} {...cellProps}>
        {value}
      </div>
    )
  }

  renderSingleColumn(type, columns, summaryStats, colWidths) {
    const visibleColumns = this.getVisibleColumns(columns)
    const column = visibleColumns[0]
    const columnIndex = columns.indexOf(column)
    const stat = summaryStats[columnIndex]

    const value = type === 'total' ? stat?.sum : stat?.avg
    const formattedValue = value !== undefined ? this.formatSummaryValue(value, column, columnIndex) : ''
    const labelValue = type === 'total' ? 'Total' : 'Average'

    const totalWidth = colWidths[columnIndex] || 100
    const { labelWidth, valueWidth } = this.getColumnWidths(totalWidth)

    return [
      this.createSummaryCell(type, labelValue, labelWidth, true, undefined, false, `${type}-label`),
      this.createSummaryCell(
        type,
        formattedValue,
        valueWidth,
        false,
        column?.align,
        value !== null,
        `${type}-value-${columnIndex}`,
      ),
    ]
  }

  renderMultipleColumns(type, columns, summaryStats, colWidths, isPivot) {
    const visibleColumns = this.getVisibleColumns(columns)
    const needsSplit = this.needsLabelColumn(columns)

    if (needsSplit && visibleColumns.length > 1) {
      return this.renderSplitFirstColumn(type, columns, summaryStats, colWidths, isPivot)
    }

    return this.renderRegularColumns(type, columns, summaryStats, colWidths, isPivot)
  }

  renderSplitFirstColumn(type, columns, summaryStats, colWidths, isPivot) {
    const visibleColumns = this.getVisibleColumns(columns)
    const firstColumn = visibleColumns[0]
    const firstColumnIndex = columns.indexOf(firstColumn)
    const stat = summaryStats[firstColumnIndex]

    const value = type === 'total' ? stat?.sum : stat?.avg
    const formattedValue = value !== undefined ? this.formatSummaryValue(value, firstColumn, firstColumnIndex) : ''
    const labelValue = type === 'total' ? 'Total' : 'Average'

    const totalWidth = colWidths[firstColumnIndex] || 100
    const { labelWidth, valueWidth } = this.getColumnWidths(totalWidth)

    const cells = [
      this.createSummaryCell(type, labelValue, labelWidth, true, undefined, false, `${type}-first-label`),
      this.createSummaryCell(
        type,
        formattedValue,
        valueWidth,
        false,
        firstColumn?.align,
        value !== null,
        `${type}-first-value-${firstColumnIndex}`,
      ),
    ]

    // Add remaining columns
    for (let i = 1; i < visibleColumns.length; i++) {
      const col = visibleColumns[i]
      const colIndex = columns.indexOf(col)
      const colStat = summaryStats[colIndex]
      const colValue = type === 'total' ? colStat?.sum : colStat?.avg
      const colFormatted = colValue !== undefined ? this.formatSummaryValue(colValue, col, colIndex) : ''

      cells.push(
        this.createSummaryCell(
          type,
          colFormatted,
          colWidths[colIndex] || 100,
          false,
          col?.align,
          colValue !== null,
          `${type}-col-${colIndex}`,
        ),
      )
    }

    return cells
  }

  renderRegularColumns(type, columns, summaryStats, colWidths, isPivot) {
    const firstVisibleIndex = columns.findIndex((col) => col.visible !== false && col.is_visible !== false)

    return columns.map((col, index) => {
      if (col.visible === false || col.is_visible === false) return null

      const stat = summaryStats[index]
      const isFirstVisible = index === firstVisibleIndex

      let value
      if (isFirstVisible && !this.needsLabelColumn(columns)) {
        value = type === 'total' ? 'Total' : 'Average'
      } else {
        const rawValue = type === 'total' ? stat?.sum : stat?.avg
        value = rawValue !== undefined ? this.formatSummaryValue(rawValue, col, index) : ''
      }

      const shouldEnableCopy = !isFirstVisible || this.needsLabelColumn(columns)

      return this.createSummaryCell(
        type,
        value,
        colWidths[index] || 100,
        isFirstVisible && !this.needsLabelColumn(columns),
        col?.align,
        shouldEnableCopy && stat,
        `${type}-${col?.field ?? index}`,
      )
    })
  }

  render(type, columns, summaryStats, colWidths, isPivot) {
    const containerStyle = {
      display: 'flex',
      alignItems: 'center',
      minHeight: '26px',
      background: 'var(--react-autoql-background-color-secondary)',
      borderTop: type === 'total' ? '2px solid var(--react-autoql-table-border-color)' : undefined,
      borderBottom: '1px solid var(--react-autoql-table-border-color)',
      minWidth: 'max-content',
    }

    const visibleColumns = this.getVisibleColumns(columns)
    let summaryContent

    if (visibleColumns.length === 1) {
      summaryContent = this.renderSingleColumn(type, columns, summaryStats, colWidths)
    } else {
      summaryContent = this.renderMultipleColumns(type, columns, summaryStats, colWidths, isPivot)
    }

    return (
      <div className='tabulator-calcs-holder' style={containerStyle}>
        {React.Children.toArray(summaryContent)}
      </div>
    )
  }
}
