import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

import {
  fetchDataPreview,
  REQUEST_CANCELLED_ERROR,
  formatElement,
  getDataFormatting,
  dataFormattingDefault,
} from 'autoql-fe-utils'

// import { CustomScrollbars } from '../CustomScrollbars'
import { Icon } from '../Icon'
import { Checkbox } from '../Checkbox'
import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { dataFormattingType } from '../../props/types'

import './DataPreview.scss'
import { Select } from '../Select'
import MultiSelect from '../MultiSelect/MultiSelect'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.DATA_PREVIEW_ROWS = 5
    this.ID = uuid()

    this.state = {
      dataPreview: null,
    }
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    authentication: authenticationType,
    shouldRender: PropTypes.bool,
    subject: PropTypes.shape({}),

    isCollapsed: PropTypes.bool,
    onIsCollapsedChange: PropTypes.func,
    onColumnSelection: PropTypes.func,
    onDataPreview: PropTypes.func,

    defaultCollapsed: PropTypes.bool,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    authentication: {},
    shouldRender: true,
    subject: null,
    isCollapsed: undefined,
    onIsCollapsedChange: () => {},
    onColumnSelection: () => {},
    onDataPreview: () => {},

    defaultCollapsed: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.subject) {
      this.getDataPreview()
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.props.subject && !_isEqual(this.props.subject, prevProps.subject)) {
      this.getDataPreview()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  getDataPreview = () => {
    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()

    this.setState({ loading: true, error: undefined, dataPreview: undefined })
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.props.subject?.context,
      numRows: this.DATA_PREVIEW_ROWS,
      source: 'data_explorer.data_preview',
      scope: 'data_explorer',
      cancelToken: this.axiosSource.token,
      numRows: 100,
    })
      .then((response) => {
        this.setState({ dataPreview: response, loading: false })
        this.props.onDataPreview(response)
      })
      .catch((error) => {
        if (error?.message !== REQUEST_CANCELLED_ERROR) {
          console.error(error)
          this.setState({ loading: false, error: error?.response?.data })
        }
      })
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

    console.log('new column selection:', _cloneDeep(selectedColumns), 'old selection', this.props.selectedColumns)
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

  renderDataPreviewHeader = (columns) => {
    return (
      <div className='data-preview-table-header'>
        <span className='react-autoql-data-preview-selected-columns-text'>Select fields to use in Sample Queries</span>
      </div>
    )
  }

  renderDataPreviewTable = (columns, rows) => {
    const config = getDataFormatting(this.props.dataFormatting)

    return (
      <div className='data-preview-table-wrapper'>
        {!!this.state.error ? (
          <div className='data-preview-error-message'>
            <div>{this.state.error.message}</div>
            {this.state.error.reference_id && (
              <>
                <br />
                <div>Error ID: {this.state.error.reference_id}</div>
              </>
            )}
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
                <td className='data-preveiew-end-of-preview-sticky-wrapper' colspan={`${columns.length}`}>
                  End of Preview
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    )
  }

  renderDataPreviewGrid = () => {
    const rows = this.state.dataPreview?.data?.data?.rows
    const columns = this.state.dataPreview?.data?.data?.columns

    if (!this.state.error && (!columns || !rows)) {
      return null
    }

    return (
      <div className='data-preview'>
        {this.renderDataPreviewHeader(columns)}
        {this.renderDataPreviewTable(columns, rows)}
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

  renderDataPreviewTitle = () => {
    const lowerCaseSubject = this.props.subject?.displayName
    const titleCaseSubject = lowerCaseSubject[0].toUpperCase() + lowerCaseSubject.substring(1)

    return (
      <div className='react-autoql-data-explorer-section-title'>
        <Icon style={{ fontSize: '20px' }} type='book' /> {titleCaseSubject}
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
        >
          {this.state.loading ? this.renderLoadingContainer() : this.renderDataPreviewGrid()}
        </div>
      </ErrorBoundary>
    )
  }
}
