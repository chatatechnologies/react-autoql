import React from 'react'
import PropTypes from 'prop-types'
import { isColumnSummable } from 'autoql-fe-utils'
import { handleCellCopy, setupCopyableCell } from './CopyUtils'
import { TOOLTIP_COPY_TEXTS } from '../../js/Constants'

export function SummaryRow({
  type,
  columns = [],
  summaryStats = [],
  colWidths = [],
  isPivot,
  formatSummaryValue,
  getVisibleColumns,
  needsLabelColumn,
  renderSingleColumnSummary,
  renderSplitFirstColumnSummary,
  renderMultiColumnSummary,
}) {
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    minHeight: '26px',
    background: 'var(--react-autoql-background-color-secondary)',
    borderTop: type === 'total' ? '2px solid var(--react-autoql-table-border-color)' : undefined,
    borderBottom: '1px solid var(--react-autoql-table-border-color)',
    minWidth: 'max-content',
  }

  const visibleColumns = getVisibleColumns(columns)
  const needsSingleColumnLayout = needsLabelColumn(columns)
  let summaryContent
  if (needsSingleColumnLayout) {
    if (visibleColumns.length === 1) {
      summaryContent = renderSingleColumnSummary(type, columns, summaryStats, colWidths, formatSummaryValue)
    } else {
      summaryContent = renderSplitFirstColumnSummary(
        type,
        columns,
        summaryStats,
        colWidths,
        isPivot,
        formatSummaryValue,
      )
    }
  } else {
    summaryContent = renderMultiColumnSummary(type, columns, summaryStats, colWidths, isPivot, formatSummaryValue)
  }

  return (
    <div className='tabulator-calcs-holder' style={containerStyle}>
      {summaryContent}
    </div>
  )
}

SummaryRow.propTypes = {
  type: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  summaryStats: PropTypes.array.isRequired,
  colWidths: PropTypes.array.isRequired,
  isPivot: PropTypes.bool,
  formatSummaryValue: PropTypes.func.isRequired,
  getVisibleColumns: PropTypes.func.isRequired,
  needsLabelColumn: PropTypes.func.isRequired,
  renderSingleColumnSummary: PropTypes.func.isRequired,
  renderSplitFirstColumnSummary: PropTypes.func.isRequired,
  renderMultiColumnSummary: PropTypes.func.isRequired,
}
