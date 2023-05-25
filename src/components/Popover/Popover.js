import React from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { Popover } from 'react-tiny-popover'

import './Popover.scss'

class PopoverWithoutRef extends React.Component {
  static propTypes = {
    padding: PropTypes.number,
  }

  static defaultProps = {
    padding: 10,
  }

  render = () => {
    if (!this.props.children) {
      return null
    }

    return (
      <Popover
        id={this.props.id}
        containerClassName={`react-tiny-popover-container react-autoql-popover${isMobile ? '-mobile' : ''}`}
        isOpen={this.props.isOpen}
        content={this.props.content}
        ref={this.props.innerRef}
        onClickOutside={(e) => {
          e.stopPropagation()
          e.preventDefault()
          this.props.onClickOutside()
        }}
        parentElement={this.props.parentElement}
        boundaryElement={this.props.boundaryElement}
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
