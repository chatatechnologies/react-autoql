import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { Popover, ArrowContainer } from 'react-tiny-popover'

import './Popover.scss'

class PopoverWithoutRef extends React.Component {
  static propTypes = {
    padding: PropTypes.number,
    showArrow: PropTypes.bool,
  }

  static defaultProps = {
    padding: 10,
    showArrow: false,
  }

  renderContent = (params = {}) => {
    if (typeof this.props.content === 'function') {
      return this.props.content(params)
    }

    if (this.props.showArrow && !isMobile) {
      const { position, childRect, popoverRect } = params

      return (
        <ArrowContainer
          className='popover-arrow-container'
          arrowClassName='popover-arrow'
          position={position}
          childRect={childRect}
          popoverRect={popoverRect}
          arrowSize={10}
        >
          <div className='popover-arrow-container-content'>
            <div className={`popover-container-content ${this.props.contentClassName ?? ''}`}>{this.props.content}</div>
          </div>
        </ArrowContainer>
      )
    }

    return <div className={`popover-container-content ${this.props.contentClassName ?? ''}`}>{this.props.content}</div>
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <Popover
        id={this.props.id}
        containerClassName={`react-tiny-popover-container react-autoql-popover${isMobile ? '-mobile' : ''}
          ${this.props.containerClassName ?? ''}
          ${
            this.props.showArrow && typeof this.props.content !== 'function' && !isMobile
              ? 'popover-with-arrow-container'
              : ''
          }`}
        isOpen={this.props.isOpen}
        content={this.renderContent}
        ref={this.props.innerRef}
        onClickOutside={(e) => {
          e.stopPropagation()
          e.preventDefault()
          this.props.onClickOutside(e)
        }}
        parentElement={isMobile ? undefined : this.props.parentElement}
        boundaryElement={isMobile ? undefined : this.props.boundaryElement}
        positions={this.props.positions}
        align={this.props.align}
        reposition={true}
        padding={this.props.padding}
        boundaryInset={this.props.boundaryInset}
      >
        {this.props.children}
      </Popover>
    )
  }
}

export default React.forwardRef((props, ref) => <PopoverWithoutRef innerRef={ref} {...props} />)
