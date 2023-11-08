import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'

import { fetchDataPreview, REQUEST_CANCELLED_ERROR, dataFormattingDefault } from 'autoql-fe-utils'

import { SelectableTable } from '../SelectableTable'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import TablePlaceholder from '../TablePlaceholder/TablePlaceholder'

import { authenticationType, dataFormattingType } from '../../props/types'

import './DataPreview.scss'

export default class DataPreview extends React.Component {
  constructor(props) {
    super(props)

    this.DATA_PREVIEW_ROWS = 20
    this.ID = uuid()

    this.state = {
      dataPreview: props.data,
      error: undefined,
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
    if (this.props.subject && !this.props.data) {
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
    })
      .then((response) => {
        if (this._isMounted) {
          this.setState({ dataPreview: response, loading: false })
          this.props.onDataPreview?.(response)
        }
      })
      .catch((error) => {
        if (this._isMounted) {
          if (error?.message !== REQUEST_CANCELLED_ERROR) {
            console.error(error)
            this.setState({ loading: false, error: error?.response?.data })
          }
        }
      })
  }

  renderDataPreviewGrid = () => {
    if (this.state.error || !this.state.dataPreview?.data?.data?.columns || !this.state.dataPreview?.data?.data?.rows) {
      return (
        <div className='data-preview-error-message'>
          <p>
            {this.state.error?.message ?? 'Oops... Something went wrong and we were unable to fetch your Data Preview.'}
          </p>
          {this.state.error?.reference_id ? <p>Error ID: {this.state.error.reference_id}</p> : null}
          <p>
            <a onClick={() => this.props.onError}>Try again</a>
          </p>
        </div>
      )
    }

    return (
      <SelectableTable
        dataFormatting={this.props.dataFormatting}
        onColumnSelection={this.props.onColumnSelection}
        selectedColumns={this.props.selectedColumns}
        shouldRender={this.props.shouldRender}
        queryResponse={this.state.dataPreview}
        showEndOfPreviewMessage={true}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  renderLoadingContainer = () => {
    return (
      <div className='data-explorer-section-placeholder data-preview'>
        <TablePlaceholder />
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
          style={this.props.style}
        >
          {this.state.loading ? this.renderLoadingContainer() : this.renderDataPreviewGrid()}
        </div>
      </ErrorBoundary>
    )
  }
}
