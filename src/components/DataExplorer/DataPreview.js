import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import { COLUMN_TYPES, fetchDataPreview } from 'autoql-fe-utils'

// import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import { Icon } from '../Icon'

import { getDataFormatting, dataFormattingDefault } from '../../props/defaults'
import { dataFormattingType } from '../../props/types'
import { formatElement } from '../../js/Util.js'
import { responseErrors } from '../../js/errorMessages'
import { Tooltip, rebuildTooltips } from '../Tooltip'
import { Checkbox } from '../Checkbox'

import './DataPreview.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.DATA_PREVIEW_ROWS = 5
    this.ID = uuid()

    this.state = {
      dataPreview: null,
      checkedColumns: [],
    }
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    authentication: authenticationType,
    shouldRender: PropTypes.bool,
    subject: PropTypes.shape({}),

    isCollapsed: PropTypes.bool,
    onIsCollapsedChange: PropTypes.func,
    defaultCollapsed: PropTypes.bool,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    authentication: {},
    shouldRender: true,
    subject: null,
    rebuildTooltips: undefined,
    isCollapsed: undefined,
    onIsCollapsedChange: () => {},

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

    if (this.state.dataPreview && !_isEqual(this.state.dataPreview, prevState.dataPreview)) {
      rebuildTooltips()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(responseErrors.CANCELLED)
  }

  getDataPreview = () => {
    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()

    this.setState({ loading: true, error: undefined, dataPreview: undefined, checkedColumns: [] })
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.props.subject?.name,
      numRows: this.DATA_PREVIEW_ROWS,
      source: 'data_explorer.data_preview',
      scope: 'data_explorer',
      cancelToken: this.axiosSource.token,
      numRows: 100,
    })
      .then((response) => {
        this.setState({ dataPreview: response, loading: false })
      })
      .catch((error) => {
        if (error?.message !== responseErrors.CANCELLED) {
          console.error(error)
          this.setState({ loading: false, error: error?.response?.data })
        }
      })
      .finally(() => {
        rebuildTooltips()
      })
  }

  formatColumnHeader = (column, i) => {
    return (
      <div className='data-preview-col-header' data-for={`data-preview-tooltip-${this.ID}`} data-tip={col.name}>
        <span>{column?.display_name}</span>
        <Checkbox checked={this.state.checkedColumns?.includes(i)} onChange={() => this.onColumnHeaderClick(i)} />
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
    let checkedColumns = _cloneDeep(this.state.checkedColumns)

    if (checkedColumns?.includes(index)) {
      checkedColumns = checkedColumns.filter((i) => i !== index)
    } else {
      checkedColumns.push(index)
    }

    this.setState({ checkedColumns })
  }

  // getColumnHeaderTooltip = (col) => {
  //   const name = col.display_name
  //   const type = COLUMN_TYPES[col.type]?.description
  //   return `<strong>Field: </strong>${name}<br/><strong>Data Type: </strong>${type}`
  // }

  renderHeaderTooltipContent = (columnName) => {
    console.log({ columnName })
    const columns = this.state.dataPreview?.data?.data?.columns
    const column = columns?.find((col) => col.name === columnName)

    //

    console.log({ column })

    if (!column) {
      return null
    }

    const name = column.display_name
    const type = COLUMN_TYPES[column.type]?.description

    return `<strong>Field: </strong>${name}<br/><strong>Data Type: </strong>${type}`

    // return (
    //   <div>
    //     <div className='data-explorer-tooltip-title'>{column?.display_name}</div>
    //     {!!type && <div className='data-explorer-tooltip-section'>{type}</div>}
    //     {/* Disable this until we have a better way to get query suggestions for columns
    //     <div className="data-explorer-tooltip-section">
    //       <strong>Query suggestions:</strong>
    //       <br />
    //       {this.renderColumnQuerySuggestions(column)}
    //     </div> */}
    //   </div>
    // )
  }

  renderDataPreviewGrid = () => {
    const rows = this.state.dataPreview?.data?.data?.rows
    const columns = this.state.dataPreview?.data?.data?.columns

    if (!this.state.error && (!columns || !rows)) {
      return null
    }

    const config = getDataFormatting(this.props.dataFormatting)

    return (
      <div className='data-preview'>
        {/* <CustomScrollbars> */}
        <div className='data-preview-table-header'>
          <span className='react-autoql-data-preview-selected-columns-text'>
            Select fields to use in Sample Queries
          </span>
          {!!this.state.checkedColumns?.length && (
            <span
              className='react-autoql-data-preview-selected-columns-clear-btn'
              onClick={() => this.setState({ checkedColumns: [] })}
            >
              Clear selections{' '}
              <span className='react-autoql-data-preview-selected-columns-badge'>
                {this.state.checkedColumns.length}
              </span>
            </span>
          )}
        </div>
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
                        key={`col-header-${i}`}
                        className={`${this.state.checkedColumns.includes(i) ? 'data-preview-column-selected' : ''}`}
                        onClick={() => this.onColumnHeaderClick(i)}
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
                            className={`${this.state.checkedColumns.includes(j) ? 'data-preview-cell-selected' : ''}`}
                            onClick={() => this.onColumnHeaderClick(j)}
                            // onMouseOver={}
                            key={`cell-${j}`}
                          >
                            {this.formatCell({ cell, column, config })}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {/* </CustomScrollbars> */}
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
    const lowerCaseSubject = this.props.subject?.name
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
        <div className='data-explorer-data-preview' data-test='data-explorer-data-preview'>
          {this.state.loading ? this.renderLoadingContainer() : this.renderDataPreviewGrid()}
        </div>
        {/* <Tooltip
          className='data-preview-tooltip'
          id={`data-preview-tooltip-${this.ID}`}
          place='right'
          delayHide={200}
          delayUpdate={200}
          effect='solid'
          content={this.renderHeaderTooltipContent}
          clickable
        /> */}
      </ErrorBoundary>
    )
  }
}
