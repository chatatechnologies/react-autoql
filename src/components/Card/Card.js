import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Card.scss'

export default class Cascader extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_ID = uuid()

    this.state = {
      isCollapsed: props.defaultCollapsed,
    }
  }

  static propTypes = {
    title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    defaultCollapsed: PropTypes.bool,
  }

  static defaultProps = {
    title: null,
    subtitle: null,
    defaultCollapsed: false,
  }

  componentWillUnmount = () => {
    clearTimeout(this.collapseTimer)
  }

  toggleCollapse = () => {
    if (this.contentRef) {
      let contentHeight = this.contentRef.offsetHeight
      if (this.state.isCollapsed) {
        if (this.collapseTimer) {
          clearTimeout(this.collapseTimer)
          this.contentRef.style.visibility = 'hidden'
          this.contentRef.style.position = 'absolute'
        }

        // ---------- set max height without transition ------------
        this.contentRef.style.maxHeight = 'unset'
        contentHeight = this.contentRef.offsetHeight
        this.contentRef.style.maxHeight = 0
        // ---------------------------------------------------------

        this.contentRef.style.position = 'relative'
        this.contentRef.style.visibility = 'visible'
        setTimeout(() => {
          this.contentRef.style.maxHeight = `${contentHeight}px`
        }, 0)
      } else {
        clearTimeout(this.collapseTimer)
        this.contentRef.style.maxHeight = 'unset'
        this.contentRef.style.maxHeight = `${contentHeight}px`

        setTimeout(() => {
          this.contentRef.style.maxHeight = 0
        }, 0)

        // Unset max height after animation is complete
        this.collapseTimer = setTimeout(() => {
          this.contentRef.style.visibility = 'hidden'
          this.contentRef.style.position = 'absolute'
        }, 300)
      }
    }

    this.setState({
      isCollapsed: !this.state.isCollapsed,
    })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-card
          ${this.state.isCollapsed ? ' collapsed' : ''}
          ${this.props.className ? this.props.className : ''}`}
          style={this.props.style}
        >
          <div
            className="react-autoql-card-title"
            onClick={this.toggleCollapse}
          >
            <div>{this.props.title}</div>
            <Icon type={this.state.isCollapsed ? 'caret-left' : 'caret-down'} />
          </div>
          <div
            ref={(r) => (this.contentRef = r)}
            className="react-autoql-card-content"
          >
            {!!this.props.subtitle && (
              <div className="react-autoql-card-subtitle">
                {this.props.subtitle}
              </div>
            )}
            <div className="react-autoql-card-user-content">
              {this.props.children}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
