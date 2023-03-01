import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import _isEqual from 'lodash.isequal'
import axios from 'axios'

import { Card } from '../Card'
import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import { fetchDataPreview } from '../../js/queryService'
import { Icon } from '../Icon'

import { getDataFormatting, dataFormattingDefault } from '../../props/defaults'
import { dataFormattingType } from '../../props/types'
import { formatElement } from '../../js/Util.js'
import { responseErrors } from '../../js/errorMessages'

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
    rebuildTooltips: PropTypes.func,
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
    rebuildTooltips: () => {},
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
      this.props.rebuildTooltips()
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

    this.setState({ loading: true, error: undefined, dataPreview: undefined })
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.props.subject?.name,
      numRows: this.DATA_PREVIEW_ROWS,
      cancelToken: this.axiosSource.token,
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

  formatColumnHeader = (column) => {
    return (
      <div
        className='data-preview-col-header'
        data-for={this.props.tooltipID ?? 'data-preview-tooltip'}
        data-tip={JSON.stringify(column)}
      >
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
        <CustomScrollbars autoHide={false} style={{ height: '165px' }}>
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
      <div>
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
