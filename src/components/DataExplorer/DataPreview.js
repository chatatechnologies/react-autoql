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
    disableColumnSelection: PropTypes.bool,
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
    disableColumnSelection: false,
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
    this.axiosSource?.abort(REQUEST_CANCELLED_ERROR)
  }

  getDataPreview = () => {
    this.cancelCurrentRequest()
    this.axiosSource = new AbortController()

    this.setState({ loading: true, error: undefined, dataPreview: undefined })
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.props.subject?.context,
      numRows: this.DATA_PREVIEW_ROWS,
      source: 'data_explorer.data_preview',
      scope: 'data_explorer',
      signal: this.axiosSource.signal,
    })
      .then((response) => {
        if (this._isMounted) {
          // Add metadata to determine whether or not a user can generate sample queries from the column
          if (response?.data?.data?.columns?.length) {
            response.data.data.columns.forEach((column) => {
              column.isGroupable = this.isColumnGroupable(column)
              column.isFilterable = this.isColumnFilterable(column)
            })
          }

          this.setState({ dataPreview: response, loading: false })
          this.props.onDataPreview?.(response)
        }
      })
      .catch((error) => {
        if (this._isMounted) {
          const isCancelled = error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.message === REQUEST_CANCELLED_ERROR
          if (!isCancelled) {
            console.error(error)
            this.setState({ loading: false, error: error?.response?.data })
          }
        }
      })
  }

  isColumnGroupable = (column) => {
    const groupsNotProvided = !this.props.subject?.groups
    const existsInGroups = !!this.props.subject?.groups?.find((groupby) => groupby.table_column === column.name)
    const groupbysAllowed = groupsNotProvided || existsInGroups
    return groupbysAllowed
  }

  isColumnFilterable = (column) => {
    const filtersNotProvided = !this.props.subject?.filters
    const existsInFilters = !!this.props.subject?.filters?.find((filter) => filter.table_column === column.name)
    const filtersAllowed = filtersNotProvided || existsInFilters
    return filtersAllowed
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
            <a onClick={this.getDataPreview}>Try again</a>
          </p>
        </div>
      )
    }

    const disabledColumns = []
    this.state.dataPreview?.data?.data?.columns?.forEach((column, i) => {
      if (!column.isFilterable && !column.isGroupable) {
        disabledColumns.push(i)
      }
    })

    return (
      <SelectableTable
        dataFormatting={this.props.dataFormatting}
        onColumnSelection={this.props.onColumnSelection}
        selectedColumns={this.props.selectedColumns}
        shouldRender={this.props.shouldRender}
        queryResponse={this.state.dataPreview}
        showEndOfPreviewMessage={true}
        tooltipID={this.props.tooltipID}
        disableColumnSelection={this.props.disableColumnSelection}
        // Disable this for now, the logic to disable the columns does not match with the
        // ability to create sample queries currently. We will need to revisit this logic
        // with the recommendation service in the future if we want to have this feature
        // disabledColumns={disabledColumns}
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
