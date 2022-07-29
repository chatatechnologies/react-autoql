import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import _isEqual from 'lodash.isequal'
import { Scrollbars } from 'react-custom-scrollbars-2'
import ReactDOMServer from 'react-dom/server'

import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import { fetchDataPreview } from '../../js/queryService'
import { TopicName } from './TopicName'
import { Icon } from '../Icon'

import {
  getDataFormatting,
  getThemeConfig,
  dataFormattingDefault,
  themeConfigDefault,
} from '../../props/defaults'
import { dataFormattingType, themeConfigType } from '../../props/types'
import { formatElement } from '../../js/Util.js'

import './DataPreview.scss'
import { Card } from '../Card'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      dataPreview: null,
    }
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,
    authentication: authenticationType,
    shouldRender: PropTypes.bool,
    subject: PropTypes.shape({}),
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,
    authentication: {},
    shouldRender: true,
    subject: null,
    rebuildTooltips: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.subject) {
      this.getDataPreview()
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.props.subject &&
      !_isEqual(this.props.subject, prevProps.subject)
    ) {
      this.getDataPreview()
    }

    if (
      this.state.dataPreview &&
      !_isEqual(this.state.dataPreview, prevState.dataPreview)
    ) {
      this.props.rebuildTooltips()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getDataPreview = () => {
    this.setState({ loading: true, error: false, dataPreview: undefined })
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.props.subject?.name,
    })
      .then((response) => {
        this.setState({ dataPreview: response, loading: false })
      })
      .catch((error) => {
        console.error(error)
        this.setState({ loading: false, error: true })
      })
  }

  formatColumnHeader = (column) => {
    return (
      <div
        className="data-preview-col-header"
        data-for="data-preview-tooltip"
        data-tip={JSON.stringify(column)}
      >
        {column?.display_name}
      </div>
    )
  }

  formatCell = ({ cell, column, config }) => {
    return (
      <div
        className="data-preview-cell"
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

    if (!columns || !rows) {
      return null
    }

    const config = getDataFormatting(this.props.dataFormatting)

    return (
      <div className="data-preview">
        <Scrollbars
          autoHeight
          autoHeightMin={0}
          autoHeightMax={800}
          className="data-preview-scroll-component"
          renderView={(props) => (
            <div {...props} className="data-preview-scroll-container" />
          )}
        >
          <table>
            <thead>
              <tr>
                {columns.map((col, i) => {
                  return (
                    <th key={`col-header-${i}`}>
                      {this.formatColumnHeader(col)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                return (
                  <tr key={`row-${i}`} className="data-preview-row">
                    {row.map((cell, j) => {
                      const column = columns[j]
                      return (
                        <td key={`cell-${j}`}>
                          {this.formatCell({ cell, column, config })}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Scrollbars>
      </div>
    )
  }

  renderLoadingContainer = () => {
    return (
      <div className="data-explorer-card-placeholder">
        <LoadingDots />
      </div>
    )
  }

  renderDataPreviewTitle = () => {
    return (
      <div>
        <Icon style={{ fontSize: '20px' }} type="table" /> Data Preview - "All{' '}
        {this.props.subject?.name}"
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
          className="data-explorer-data-preview"
          data-test="data-explorer-data-preview"
          title={this.renderDataPreviewTitle()}
          subtitle={<em>{this.props.subject?.name} data snapshot</em>}
        >
          {this.state.loading
            ? this.renderLoadingContainer()
            : this.renderDataPreviewGrid()}
        </Card>
      </ErrorBoundary>
    )
  }

  render2 = () => {
    if (!this.props.shouldRender) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.dataExplorerPage = r)}
          className="data-explorer-data-preview react-autoql-card"
          data-test="data-explorer-data-preview"
        >
          <div className="react-autoql-card-title-container">
            <div className="react-autoql-card-title">
              <div>
                <Icon style={{ fontSize: '20px' }} type="table" /> Data Preview
                - "All {this.props.subject?.name}"
              </div>
              <Icon type="caret-down" />
            </div>
            <div className="data-explorer-subtitle">
              <em>{this.props.subject?.name} data snapshot</em>
            </div>
          </div>
          {/* <div className="data-preview-header">
            <TopicName topic={this.props.subject} />
          </div> */}
          {this.state.loading
            ? this.renderLoadingContainer()
            : this.renderDataPreviewGrid()}
        </div>
      </ErrorBoundary>
    )
  }
}
