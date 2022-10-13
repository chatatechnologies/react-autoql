import React from 'react'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import InfiniteScroll from 'react-infinite-scroller'
import { v4 as uuid } from 'uuid'

import { CustomScrollbars } from '../CustomScrollbars'

import './InfiniteScroll.scss'

export default class InfiniteScrollAutoQL extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.scrollComponent = React.createRef()
  }

  render = () => {
    const { scrollbarProps = {}, className, ...props } = this.props

    return (
      <ErrorBoundary>
        <div className='react-autoql-infinite-scroll-container'>
          <CustomScrollbars {...scrollbarProps} ref={this.scrollComponent}>
            <InfiniteScroll
              {...props}
              className={`react-autoql-infinite-scroll ${className || ''}`}
              getScrollParent={() => this.scrollComponent?.current?.getView()}
            >
              {this.props.children}
            </InfiniteScroll>
          </CustomScrollbars>
        </div>
      </ErrorBoundary>
    )
  }
}
