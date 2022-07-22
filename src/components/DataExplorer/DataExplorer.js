import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import ReactTooltip from 'react-tooltip'

import { authenticationType } from '../../props/types'
import DataExplorerInput from './DataExplorerInput'
import { LoadingDots } from '../LoadingDots'
import { Spinner } from '../Spinner'
import { Icon } from '../Icon'

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
    inputPlaceholder: 'Find a subject...',
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps) => {
    // if (this.props.shouldRender && !prevProps.shouldRender) {
    //   this.inputRef?.focusInput()
    // }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onInputSelection = (listItem) => {
    console.log('just selected this list item:', listItem)
    if (listItem?.type === 'subject') {
      this.setState({
        selectedSubject: listItem.name,
      })
    } else if (listItem?.type === 'VL') {
      this.setState({
        selectedVL: listItem.name,
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

  renderSubjectChip = (value) => {
    if (!value) {
      return null
    }
    return <div>{value}</div>
  }

  renderSubjectChips = () => {
    const subject = this.state.selectedSubject
    const vl = this.state.selectedVL
    return (
      <div>
        {this.renderSubjectChip(subject)}
        {this.renderSubjectChip(vl)}
      </div>
    )
  }

  renderDataExplorerContent = () => {
    if (!this.state.selectedSubject && !this.state.selectedVL) {
      return this.renderIntroMessage()
    }

    return (
      <div className="data-explorer-result-container">
        {this.renderSubjectChips()}
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
