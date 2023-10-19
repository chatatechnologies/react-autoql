import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

import { formatElement, getDataFormatting, dataFormattingDefault } from 'autoql-fe-utils'

import { Checkbox } from '../Checkbox'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { dataFormattingType } from '../../props/types'

import './SelectableTable.scss'

export default class SelectableTable extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    shouldRender: PropTypes.bool,
    queryResponse: PropTypes.shape({}),
    onColumnSelection: PropTypes.func,
    selectedColumns: PropTypes.arrayOf(PropTypes.number),
    showEndOfPreviewMessage: PropTypes.bool,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    shouldRender: true,
    queryResponse: null,
    onColumnSelection: () => {},
    selectedColumns: [],
    showEndOfPreviewMessage: true,
  }

  componentDidMount = () => {
    setTimeout(() => {
      this.scrollbars?.update()
    }, 2000)
  }

  formatColumnHeader = (column, i) => {
    return (
      <div
        className='selectable-table-col-header'
        data-tooltip-id={this.props.tooltipID}
        data-tooltip-content={JSON.stringify(column)}
      >
        <span>{column?.display_name}</span>
        <Checkbox checked={this.props.selectedColumns?.includes(i)} onChange={() => this.onColumnHeaderClick(i)} />
      </div>
    )
  }

  formatCell = ({ cell, column, config }) => {
    return (
      <div
        className='selectable-table-cell'
        style={{
          textAlign: column.type === 'DOLLAR_AMT' ? 'right' : 'center',
        }}
      >
        {formatElement({
          element: cell,
          column,
          config,
        })}
      </div>
    )
  }

  onColumnHeaderClick = (index) => {
    let selectedColumns = _cloneDeep(this.props.selectedColumns)

    if (selectedColumns?.includes(index)) {
      selectedColumns = selectedColumns.filter((i) => i !== index)
    } else {
      selectedColumns.push(index)
    }

    this.props.onColumnSelection?.(selectedColumns)
  }

  onMouseOverColumn = (e, columnIndex) => {
    // Must use vanilla styling to achieve hover styles for a whole column
    const allColumnHeaders = this.tableRef?.querySelectorAll('.selectable-table-column')
    allColumnHeaders?.forEach((header) => {
      header.classList.remove('react-autoql-selectable-table-hovered')
    })

    const columnHeader = this.tableRef?.querySelector(`#col-header-${columnIndex}`)
    columnHeader?.classList.add('react-autoql-selectable-table-hovered')

    const allCells = this.tableRef?.querySelectorAll('.selectable-table-cell')
    allCells?.forEach((cell) => {
      cell.classList.remove('react-autoql-selectable-table-hovered')
    })

    const cells = this.tableRef?.querySelectorAll(`.cell-${columnIndex}`)
    cells?.forEach((cell) => cell.classList.add('react-autoql-selectable-table-hovered'))
  }

  renderTableCaption = () => {
    if (!this.props.queryResponse?.data?.data?.columns) {
      return null
    }

    return (
      <div className='react-autoql-selectable-table-header'>
        <span className='react-autoql-selectable-table-selected-columns-text'>{this.props.caption}</span>
      </div>
    )
  }

  render = () => {
    if (!this.props.shouldRender) {
      return null
    }

    const rows = this.props.queryResponse?.data?.data?.rows
    const columns = this.props.queryResponse?.data?.data?.columns
    const config = getDataFormatting(this.props.dataFormatting)

    return (
      <ErrorBoundary>
        <div ref={(r) => (this.tableRef = r)} className='react-autoql-selectable-table'>
          <div className='react-autoql-selectable-table-wrapper'>
            <CustomScrollbars autoHide={true} ref={(r) => (this.scrollbars = r)} table>
              <table>
                <thead>
                  <tr>
                    {columns.map((col, i) => {
                      return (
                        <th
                          id={`col-header-${i}`}
                          key={`col-header-${i}`}
                          className={`selectable-table-column ${
                            this.props.selectedColumns.includes(i)
                              ? 'selectable-table-column-selected'
                              : 'selectable-table-column-unselected'
                          }`}
                          onClick={() => this.onColumnHeaderClick(i)}
                          onMouseOver={(e) => this.onMouseOverColumn(e, i)}
                        >
                          {this.formatColumnHeader(col, i)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    return (
                      <tr key={`row-${i}`} className='selectable-table-row'>
                        {row.map((cell, j) => {
                          const column = columns[j]
                          return (
                            <td
                              className={`selectable-table-cell ${
                                this.props.selectedColumns.includes(j)
                                  ? 'selectable-table-cell-selected'
                                  : 'selectable-table-cell-unselected'
                              } cell-${j}`}
                              onClick={() => this.onColumnHeaderClick(j)}
                              onMouseOver={(e) => this.onMouseOverColumn(e, j)}
                              key={`cell-${j}`}
                            >
                              {this.formatCell({ cell, column, config })}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {!!this.props.showEndOfPreviewMessage && (
                    <tr className='selectable-table-end-of-preview-message'>
                      <td className='selectable-table-end-of-preview-sticky-wrapper' colSpan={`${columns.length}`}>
                        End of Preview
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CustomScrollbars>
          </div>
          {!!this.props.caption && this.renderTableCaption()}
        </div>
      </ErrorBoundary>
    )
  }
}
