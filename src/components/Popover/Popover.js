import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { Popover, ArrowContainer } from 'react-tiny-popover'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './Popover.scss'

class PopoverWithoutRef extends React.Component {
  static propTypes = {
    padding: PropTypes.number,
    reposition: PropTypes.bool,
    showArrow: PropTypes.bool,
    contentLocation: PropTypes.func,
    stopClickPropagation: PropTypes.bool,
    onClickOutside: PropTypes.func,
  }

  static defaultProps = {
    padding: 10,
    reposition: true,
    showArrow: false,
    contentLocation: undefined,
    stopClickPropagation: true,
    onClickOutside: () => {},
  }

  renderContent = (params = {}) => {
    this.popoverRect = params?.popoverRect
    this.childRect = params?.childRect
    this.position = params?.position

    const content = (
      <div className={`popover-container-content ${this.props.contentClassName ?? ''}`}>
        {typeof this.props.content === 'function' ? this.props.content(params) : this.props.content}
      </div>
    )

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
          <div className='popover-arrow-container-content'>{content}</div>
        </ArrowContainer>
      )
    }

    return content
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    if (!this.renderContent()) {
      return null
    }

    return (
      <ErrorBoundary>
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
            if (isMobile) {
              // If user clicks on modals with a higher z-index as the modal underneath, the onClickOutside function doesn't work properly
              // This block is for an extra check if the cursor is within the x-y planar bounds of the popover container
              const x = e?.clientX
              const y = e?.clientY
              if (this.popoverRect?.top !== undefined) {
                if (
                  y < this.popoverRect.top ||
                  y > this.popoverRect.bottom ||
                  x < this.popoverRect.left ||
                  x > this.popoverRect.right
                ) {
                  if (this.props.stopClickPropagation) {
                    e.stopPropagation()
                    e.preventDefault()
                  }
                  this.props.onClickOutside(e)
                }
              }
            } else {
              this.props.onClickOutside(e)
            }
          }}
          parentElement={isMobile ? undefined : this.props.parentElement ?? undefined}
          boundaryElement={isMobile ? undefined : this.props.boundaryElement ?? undefined}
          positions={this.props.positions}
          align={this.props.align}
          reposition={this.props.reposition}
          padding={this.props.padding}
          boundaryInset={this.props.boundaryInset}
          containerStyle={this.props.containerStyle}
          contentLocation={this.props.contentLocation}
        >
          {this.props.children}
        </Popover>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <PopoverWithoutRef innerRef={ref} {...props} />)
