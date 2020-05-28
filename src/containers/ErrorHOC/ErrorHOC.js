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
    // You can also log the error to an error \reporting service
    // logErrorToMyService(error, info)
  }

  getErrorMessage = () => {
    try {
      if (this.props.message && typeof this.props.message === 'string') {
        return this.props.message
      }

      return null
    } catch (error) {
      return null
    }
  }

  render = () => {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.getErrorMessage()
    }
    return this.props.children
  }
}
