import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'

import { formatElement, getDataFormatting, dataFormattingDefault } from 'autoql-fe-utils'

import { Checkbox } from '../Checkbox'
import { LoadingDots } from '../LoadingDots'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { dataFormattingType } from '../../props/types'

import './SelectableTable.scss'

export default class SelectableTable extends React.Component {
  constructor(props) {
    super(props)

    this.DATA_PREVIEW_ROWS = 5
    this.ID = uuid()

    this.state = {}
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    shouldRender: PropTypes.bool,
    queryResponse: PropTypes.shape({}),
    onColumnSelection: PropTypes.func,
    selectedColumns: PropTypes.arrayOf(PropTypes.number),
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    shouldRender: true,
    queryResponse: null,
    onColumnSelection: () => {},
    selectedColumns: [],
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  formatColumnHeader = (column, i) => {
    return (
      <div
        className='data-preview-col-header'
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
        className='data-preview-cell'
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

    this.props.onColumnSelection(selectedColumns)
  }

  onMouseOverColumn = (e, columnIndex) => {
    // Must use vanilla styling to achieve hover styles for a whole column
    const allColumnHeaders = this.dataPreviewRef?.querySelectorAll('.data-preview-column')
    allColumnHeaders?.forEach((header) => {
      header.classList.remove('react-autoql-data-preview-hovered')
    })

    const columnHeader = this.dataPreviewRef?.querySelector(`#col-header-${columnIndex}`)
    columnHeader?.classList.add('react-autoql-data-preview-hovered')

    const allCells = this.dataPreviewRef?.querySelectorAll('.data-preview-cell')
    allCells?.forEach((cell) => {
      cell.classList.remove('react-autoql-data-preview-hovered')
    })

    const cells = this.dataPreviewRef?.querySelectorAll(`.cell-${columnIndex}`)
    cells?.forEach((cell) => cell.classList.add('react-autoql-data-preview-hovered'))
  }

  renderDataPreviewCaption = (columns) => {
    if (!columns) {
      return null
    }

    return (
      <div className='data-preview-table-header'>
        <span className='react-autoql-data-preview-selected-columns-text'>Select fields to use in Sample Queries</span>
      </div>
    )
  }

  renderDataPreviewTable = (columns, rows) => {}

  renderDataPreviewGrid = () => {
    const rows = this.props.queryResponse?.data?.data?.rows
    const columns = this.props.queryResponse?.data?.data?.columns

    // if (this.state.error || !columns || !rows) {
    //   return (
    //     <div className='data-preview-error-message'>
    //       <p>
    //         {this.state.error?.message ?? 'Oops... Something went wrong and we were unable to fetch your Data Preview.'}
    //       </p>
    //       {this.state.error?.reference_id ? <p>Error ID: {this.state.error.reference_id}</p> : null}
    //       <p>
    //         <a onClick={this.getDataPreview}>Try again</a>
    //       </p>
    //     </div>
    //   )
    // }

    const config = getDataFormatting(this.props.dataFormatting)

    return (
      <div className='data-preview'>
        <div className='data-preview-table-wrapper'>
          {this.state.error || !columns || !rows ? (
            <div className='data-preview-error-message'>
              <p>
                {this.state.error?.message ??
                  'Oops... Something went wrong and we were unable to fetch your Data Preview.'}
              </p>
              {this.state.error?.reference_id ? <p>Error ID: {this.state.error.reference_id}</p> : null}
              <p>
                <a onClick={this.getDataPreview}>Try again</a>
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {columns.map((col, i) => {
                    return (
                      <th
                        id={`col-header-${i}`}
                        key={`col-header-${i}`}
                        className={`data-preview-column ${
                          this.props.selectedColumns.includes(i)
                            ? 'data-preview-column-selected'
                            : 'data-preview-column-unselected'
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
                    <tr key={`row-${i}`} className='data-preview-row'>
                      {row.map((cell, j) => {
                        const column = columns[j]
                        return (
                          <td
                            className={`data-preview-cell ${
                              this.props.selectedColumns.includes(j)
                                ? 'data-preview-cell-selected'
                                : 'data-preview-cell-unselected'
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
                <tr className='data-preview-end-of-preview-message'>
                  <td className='data-preveiew-end-of-preview-sticky-wrapper' colSpan={`${columns.length}`}>
                    End of Preview
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        {/* {this.renderDataPreviewCaption(columns)} */}
      </div>
    )
  }

  renderLoadingContainer = () => {
    return (
      <div className='data-explorer-section-placeholder data-preview'>
        <LoadingDots />
      </div>
    )
  }

  render = () => {
    if (!this.props.shouldRender) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          id={`data-explorer-data-preview-${this.ID}`}
          className='data-explorer-data-preview'
          data-test='data-explorer-data-preview'
          ref={(r) => (this.dataPreviewRef = r)}
          style={this.props.style}
        >
          {this.state.loading ? this.renderLoadingContainer() : this.renderDataPreviewGrid()}
        </div>
      </ErrorBoundary>
    )
  }
}
