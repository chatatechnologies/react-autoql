import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './CollapsableSection.scss'

export default class CollapsableSection extends React.Component {
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
    isCollapsed: PropTypes.bool,
    onIsCollapsedChange: PropTypes.func,
  }

  static defaultProps = {
    title: null,
    subtitle: null,
    defaultCollapsed: false,
    isCollapsed: undefined,
    onIsCollapsedChange: () => { },
  }

  componentDidMount = () => {
    // Wait for animation to finish, then set card height
    this.initialCollapseTimer = setTimeout(() => {
      this.saveCurrentCardHeight()
      this.props.onIsCollapsedChange(this.props.isCollapsed)
    }, 400)
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.isCollapsed !== prevProps.isCollapsed) {
      const currentIsCollapsed = this.getIsCSSCollapsed()
      if (typeof currentIsCollapsed === 'boolean' && currentIsCollapsed !== this.props.isCollapsed) {
        this.setIsCollapsedCSS(this.props.isCollapsed)
        this.forceUpdate()
      }
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.collapseTimer)
    clearTimeout(this.initialCollapseTimer)
  }

  getIsCSSCollapsed = () => {
    if (this.contentRef?.style) {
      return this.contentRef.style.visibility === 'hidden'
    }

    return undefined
  }

  getIsCollapsed = () => {
    if (typeof this.props.isCollapsed === 'boolean') {
      return this.props.isCollapsed
    }

    return this.state.isCollapsed
  }

  handleClick = () => {
    this.setIsCollapsedCSS(!this.getIsCSSCollapsed())
  }

  saveCurrentCardHeight = () => {
    if (!this.contentRef) {
      return
    }

    const isCollapsed = this.getIsCollapsed()
    if (isCollapsed) {
      this.contentRef.style.maxHeight = '0px'
      this.contentRef.style.visibility = 'hidden'
      this.contentRef.style.position = 'absolute'
    } else {
      const contentHeight = this.contentRef.offsetHeight || 0
      this.contentRef.style.maxHeight = `${contentHeight}px`
      this.contentRef.style.position = 'relative'
      this.contentRef.style.visibility = 'visible'
    }
  }

  setIsCollapsedCSS = (isCollapsed) => {
    const isCSSCollapsed = this.getIsCSSCollapsed()
    const isValueDifferentFromCSS = (isCollapsed && isCSSCollapsed) || (!isCollapsed && !isCSSCollapsed)

    // If card is already collapsed, exit
    if (isValueDifferentFromCSS) {
      return
    }

    if (this.contentRef) {
      let contentHeight = this.contentRef.offsetHeight
      if (!isCollapsed) {
        if (this.collapseTimer) {
          clearTimeout(this.collapseTimer)
          this.contentRef.style.visibility = 'hidden'
          this.contentRef.style.position = 'absolute'
        }

        // ---------- set max height without transition ------------
        this.contentRef.style.maxHeight = 'unset'
        contentHeight = this.contentRef.offsetHeight
        this.contentRef.style.maxHeight = '0px'
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
          this.contentRef.style.maxHeight = '0px'
        }, 0)

        // Unset max height after animation is complete
        this.collapseTimer = setTimeout(() => {
          this.contentRef.style.visibility = 'hidden'
          this.contentRef.style.position = 'absolute'
        }, 300)
      }
    }

    this.props.onIsCollapsedChange(isCollapsed)
    this.setState({ isCollapsed })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-card
          ${this.getIsCollapsed() ? ' collapsed' : ''}
          ${this.props.className ? this.props.className : ''}`}
          style={this.props.style}
        >
          <div className='react-autoql-card-title' onClick={this.handleClick}>
            <div>{this.props.title}</div>
            <Icon type={this.getIsCollapsed() ? 'caret-left' : 'caret-down'} />
          </div>
          <div ref={(r) => (this.contentRef = r)} className='react-autoql-card-content'>
            {!!this.props.subtitle && <div className='react-autoql-card-subtitle'>{this.props.subtitle}</div>}
            <div className='react-autoql-card-user-content'>{this.props.children}</div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
