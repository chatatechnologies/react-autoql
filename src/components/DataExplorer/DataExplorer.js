import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import ReactTooltip from 'react-tooltip'
import _isEqual from 'lodash.isequal'

import DataExplorerInput from './DataExplorerInput'
import DataPreview from './DataPreview'
import DEConstants from './constants'
import { authenticationType } from '../../props/types'
import { LoadingDots } from '../LoadingDots'
import { Spinner } from '../Spinner'
import { Icon } from '../Icon'
import { TopicName } from './TopicName'
import { Chip } from '../Chip'

import './DataExplorer.scss'

export default class DataExplorer extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedSubject: null,
      selectedVL: null,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    shouldRender: PropTypes.bool,
    inputPlaceholder: PropTypes.string,
  }

  static defaultProps = {
    authentication: {},
    shouldRender: true,
    inputPlaceholder: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps, prevState) => {}

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputSelection = (listItem) => {
    if (
      listItem?.type === DEConstants.SUBJECT_TYPE &&
      !_isEqual(listItem, this.state.selectedSubject)
    ) {
      this.setState({
        selectedSubject: listItem,
        activeTopicType: listItem?.type,
      })
    } else if (
      listItem?.type === DEConstants.VL_TYPE &&
      !_isEqual(listItem, this.state.selectedVL)
    ) {
      this.setState({
        selectedVL: listItem,
        activeTopicType: listItem?.type,
      })
    }
  }

  renderIntroMessage = () => {
    return (
      <div className="data-explorer-intro-message">
        <h2>Welcome to Data Explorer</h2>
        {this.props.introMessage ? (
          <p>{this.props.introMessage}</p>
        ) : (
          <div>
            <p>Pick one or more data subjects and</p>
            <br />
            <p>Preview raw data structures</p>
            <p>Get query suggestions</p>
            <p>Explore value label categories</p>
          </div>
        )}
      </div>
    )
  }

  onChipDelete = (topic) => {
    if (topic?.type === DEConstants.SUBJECT_TYPE) {
      this.setState({ selectedSubject: null })
    } else if (topic?.type === DEConstants.VL_TYPE) {
      this.setState({ selectedVL: null })
    }
  }

  onChipClick = (topic) => {
    if (topic?.type !== this.state.activeTopicType) {
      this.setState({ activeTopicType: topic?.type })
    }
  }

  renderTopicChip = (topic) => {
    if (!topic) {
      return null
    }

    return (
      <Chip
        onDelete={() => this.onChipDelete(topic)}
        onClick={() => this.onChipClick(topic)}
        selected={this.state.activeTopicType === topic.type}
      >
        <TopicName topic={topic} />
      </Chip>
    )
  }

  renderDataPreview = () => {
    if (
      !this.state.selectedSubject ||
      this.state.activeTopicType !== DEConstants.SUBJECT_TYPE
    ) {
      return null
    }

    return (
      <div className="data-preview-section">
        {/* <div>
          All <TopicName topic={this.state.selectedSubject} />
        </div> */}
        <DataPreview
          authentication={this.props.authentication}
          themeConfig={this.props.themeConfig}
          subject={this.state.selectedSubject}
          shouldRender={this.props.shouldRender}
        />
      </div>
    )
  }

  renderVLSubjectList = () => {
    if (
      !this.state.selectedVL ||
      this.activeTopicType !== DEConstants.VL_TYPE
    ) {
      return null
    }

    return (
      <div>
        <h2>List of subjects for VL</h2>
        <p>list of subjects goes here</p>
      </div>
    )
  }

  renderQuerySuggestions = () => {
    if (!this.state.selectedVL && !this.state.selectedSubject) {
      return null
    }

    return (
      <div>
        <div className="data-explorer-title">Query Suggestion List</div>
        <p>explore queries list goes here</p>
      </div>
    )
  }

  renderTopicChips = () => {
    const subject = this.state.selectedSubject
    const vl = this.state.selectedVL

    if (!subject && !vl) {
      return null
    }

    return (
      <div className="data-explorer-selected-topics-container">
        <div className="data-explorer-selected-text">Selected topics:</div>
        {this.renderTopicChip(subject)}
        {this.renderTopicChip(vl)}
      </div>
    )
  }

  renderDataExplorerContent = () => {
    if (!this.state.selectedSubject && !this.state.selectedVL) {
      return this.renderIntroMessage()
    }

    return (
      <div className="data-explorer-result-container">
        {this.renderTopicChips()}
        {this.renderDataPreview()}
        {/* {this.renderVLSubjectList()} */}
        {/* {this.renderQuerySuggestions()} */}
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
          ref={(r) => (this.dataExplorerPage = r)}
          className="data-explorer-page-container"
          data-test="data-explorer-tab"
        >
          <DataExplorerInput
            ref={(r) => (this.inputRef = r)}
            authentication={this.props.authentication}
            inputPlaceholder={this.props.inputPlaceholder}
            onSelection={this.onInputSelection}
          />
          {this.renderDataExplorerContent()}
        </div>
        <ReactTooltip
          className="react-autoql-tooltip"
          id="explore-queries-tooltips"
          delayShow={800}
          effect="solid"
        />
      </ErrorBoundary>
    )
  }
}
