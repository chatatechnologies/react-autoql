import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import axios from 'axios'
import {
  fetchDataPreview,
  REQUEST_CANCELLED_ERROR,
  formatElement,
  getDataFormatting,
  dataFormattingDefault,
} from 'autoql-fe-utils'

import { Card } from '../Card'
import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import { Icon } from '../Icon'
import { rebuildTooltips } from '../Tooltip'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { dataFormattingType } from '../../props/types'

import './DataPreview.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)

    this.DATA_PREVIEW_ROWS = 5

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
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  getDataPreview = () => {
    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()

    this.setState({ loading: true, error: undefined, dataPreview: undefined })
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.props.subject?.id,
      numRows: this.DATA_PREVIEW_ROWS,
      source: 'data_explorer.data_preview',
      scope: 'data_explorer',
      cancelToken: this.axiosSource.token,
    })
      .then((response) => {
        this.setState({ dataPreview: response, loading: false })
      })
      .catch((error) => {
        if (error?.message !== REQUEST_CANCELLED_ERROR) {
          console.error(error)
          this.setState({ loading: false, error: error?.response?.data })
        }
      })
  }

  formatColumnHeader = (column) => {
    return (
      <div className='data-preview-col-header' data-for={this.props.tooltipID ?? 'data-preview-tooltip'}>
        {column?.display_name}
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

  renderDataPreviewGrid = () => {
    const rows = this.state.dataPreview?.data?.data?.rows
    const columns = this.state.dataPreview?.data?.data?.columns

    if (!this.state.error && (!columns || !rows)) {
      return null
    }

    const config = getDataFormatting(this.props.dataFormatting)

    let maxHeight = this.props.dataExplorerRef?.clientHeight * 0.75
    if (isNaN(maxHeight)) {
      maxHeight = 500
    }

    return (
      <div className='data-preview'>
        <CustomScrollbars style={{ height: '165px' }}>
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
                    return <th key={`col-header-${i}`}>{this.formatColumnHeader(col)}</th>
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  return (
                    <tr key={`row-${i}`} className='data-preview-row'>
                      {row.map((cell, j) => {
                        const column = columns[j]
                        return <td key={`cell-${j}`}>{this.formatCell({ cell, column, config })}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CustomScrollbars>
      </div>
    )
  }

  renderLoadingContainer = () => {
    return (
      <div className='data-explorer-card-placeholder data-preview'>
        <LoadingDots />
      </div>
    )
  }

  renderDataPreviewTitle = () => {
    return (
      <div className='react-autoql-card-title-text'>
        <Icon style={{ fontSize: '20px' }} type='table' /> Data Preview - "{this.props.subject?.query}"
      </div>
    )
  }

  render = () => {
    if (!this.props.shouldRender) {
      return null
    }

    return (
      <ErrorBoundary>
        <Card
          className='data-explorer-data-preview'
          data-test='data-explorer-data-preview'
          title={this.renderDataPreviewTitle()}
          isCollapsed={this.props.isCollapsed}
          onIsCollapsedChange={this.props.onIsCollapsedChange}
          defaultCollapsed={this.props.defaultCollapsed}
        >
          {this.state.loading ? this.renderLoadingContainer() : this.renderDataPreviewGrid()}
        </Card>
      </ErrorBoundary>
    )
  }
}
