import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import _isEqual from 'lodash.isequal'

import { QueryOutput } from '../QueryOutput'
import { LoadingDots } from '../LoadingDots'
import { authenticationType } from '../../props/types'
import { fetchDataPreview } from '../../js/queryService'
import { TopicName } from './TopicName'
import { Icon } from '../Icon'

import './DataPreview.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      dataPreview: null,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    shouldRender: PropTypes.bool,
    subject: PropTypes.shape({}),
  }

  static defaultProps = {
    authentication: {},
    shouldRender: true,
    subject: null,
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.subject) {
      this.getDataPreview()
    }
  }

  componentDidUpdate = (prevProps) => {
    if (
      this.props.subject &&
      !_isEqual(this.props.subject, prevProps.subject)
    ) {
      this.getDataPreview()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getDataPreview = () => {
    this.setState({ loading: true, error: false })
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

  render = () => {
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
          <div className="data-explorer-title data-preview-title">
            <Icon style={{ fontSize: '20px' }} type="search" /> Data Preview
          </div>
          <div className="data-preview-header">
            <TopicName topic={this.props.subject} />
          </div>
          <div className="data-preview-content">
            {this.state.loading ? (
              <LoadingDots />
            ) : (
              <QueryOutput
                ref={(r) => (this.inputRef = r)}
                themeConfig={this.props.themeConfig}
                authentication={this.props.authentication}
                autoQLConfig={{
                  enableQueryInterpretation: false,
                  enableQueryValidation: false,
                  enableQuerySuggestions: false,
                  enableColumnVisibilityManager: false,
                  enableDrilldowns: false,
                  enableNotifications: false,
                  enableCSVDownload: false,
                  enableReportProblem: false,
                }}
                enableAjaxTableData={false}
                showQueryInterpretation={false}
                autoChartAggregations={false}
                enableDynamicCharting={false}
                enableFilterLocking={false}
                enableTableSorting={false}
                queryResponse={this.state.dataPreview}
                displayType={this.state.displayType}
                preferredDisplayType="table"
                onRecommendedDisplayType={(displayType) =>
                  this.setState({ displayType })
                }
              />
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
