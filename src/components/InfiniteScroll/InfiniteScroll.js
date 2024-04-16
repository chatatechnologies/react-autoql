import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import InfiniteScroll from 'react-infinite-scroller'
import { v4 as uuid } from 'uuid'

import './InfiniteScroll.scss'

export default class InfiniteScrollAutoQL extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.scrollComponent = React.createRef()
  }

  static propTypes = {
    getScrollParent: PropTypes.func,
    contentHidden: PropTypes.bool,
  }

  static defaultProps = {
    getScrollParent: undefined,
    contentHidden: false,
  }

  componentDidUpdate = () => {
    this.scrollComponent?.current?.update()
  }

  updateScrollbars = (duration) => {
    this.scrollComponent?.current?.update(duration)
  }

  render = () => {
    const { scrollbarProps = {}, className, contentHidden, children, ...props } = this.props

    return (
      <ErrorBoundary>
        <div className='react-autoql-infinite-scroll-container'>
          <InfiniteScroll
            {...props}
            className={`react-autoql-infinite-scroll ${className || ''}`}
            getScrollParent={() => this.scrollComponent?.current?.getContainer()}
          >
            {children}
          </InfiniteScroll>
        </div>
      </ErrorBoundary>
    )
  }
}
