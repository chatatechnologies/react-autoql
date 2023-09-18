import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import axios from 'axios'
import { fetchDataPreview } from 'autoql-fe-utils'

// import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import { Icon } from '../Icon'

import { getDataFormatting, dataFormattingDefault } from '../../props/defaults'
import { dataFormattingType } from '../../props/types'
import { formatElement } from '../../js/Util.js'
import { responseErrors } from '../../js/errorMessages'
import { rebuildTooltips } from '../Tooltip'
import { Checkbox } from '../Checkbox'

import './DataPreview.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.DATA_PREVIEW_ROWS = 5

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
  }

  formatColumnHeader = (column, i) => {
    return (
      <div className='data-preview-col-header' data-for={this.props.tooltipID ?? 'data-preview-tooltip'}>
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
                        className={
                          this.state.checkedColumns.includes(i) ? 'data-preview-column-selected' : 'data-preview-column'
                        }
                        onClick={() => this.onColumnHeaderClick(i)}
                      >
                        <div className='data-preview-column-header-hover-element' />
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
                            className={`${
                              this.state.checkedColumns.includes(j) ? 'data-preview-cell-selected' : 'data-preview-cell'
                            }`}
                            key={`cell-${j}`}
                          >
                            <div className='data-preview-cell-hover-element' />
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
      </ErrorBoundary>
    )
  }
}
