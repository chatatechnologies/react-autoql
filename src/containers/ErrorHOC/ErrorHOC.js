import React from 'react'
import PropTypes from 'prop-types'

export default class ErrorBoundary extends React.Component {
  static propTypes = {
    message: PropTypes.string,
  }

  static defaultProps = {
    message: null,
  }

  state = {
    hasError: false,
  }

  componentDidCatch = (error, info) => {
    // Display fallback UI
    this.setState({ hasError: true })
    console.error(error)
    console.error(info)
  }

  getErrorMessage = () => {
    if (this.props.message && typeof this.props.message === 'string') {
      return this.props.message
    }

    return null
  }

  render = () => {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <div data-test="error-container">{this.getErrorMessage()}</div>
    }
    return this.props.children
  }
}
