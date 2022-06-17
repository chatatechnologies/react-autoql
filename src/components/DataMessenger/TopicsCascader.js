import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _has from 'lodash.has'
import _isEmpty from 'lodash.isempty'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { lang } from '../../js/Localization'
import { Icon } from '../Icon'
import { Cascader } from '../Cascader'

export default class TopicsCascader extends React.Component {
  constructor(props) {
    super(props)

    if (Array.isArray(props.topics)) {
      this.topics = props.topics.map((topic) => {
        return {
          label: topic.name,
          value: uuid(),
          children: topic.queries.map((query) => ({
            label: query.query,
            value: uuid(),
          })),
        }
      })
    }

    this.state = {}
  }

  static propTypes = {
    topics: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    enableExploreQueriesTab: PropTypes.bool.isRequired,
    onTopicClick: PropTypes.func.isRequired,
    onExploreQueriesClick: PropTypes.func.isRequired,
  }

  static defaultProps = {}

  render = () => {
    if (!Array.isArray(this.topics)) {
      return null
    }

    return (
      <ErrorBoundary>
        <div>
          {lang.introPrompt}
          <br />
          <div className="topics-container">
            <Cascader
              options={this.topics}
              onFinalOptionClick={(option) => {
                this.props.onTopicClick({
                  query: option.label,
                  source: 'welcome_prompt',
                })
              }}
              showSeeMoreButton={this.props.enableExploreQueriesTab}
              onSeeMoreClick={
                // (label) => this.runTopicInExporeQueries(label)
                (label) => this.props.onExploreQueriesClick(label)
              }
            />
          </div>
          {this.props.enableExploreQueriesTab && (
            <div>
              {lang.use}{' '}
              <span
                className="intro-qi-link"
                onClick={this.props.onExploreQueriesClick}
              >
                <Icon type="light-bulb" style={{ marginRight: '-3px' }} />{' '}
                {lang.exploreQueries}
              </span>{' '}
              {lang.explorePrompt}
            </div>
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
