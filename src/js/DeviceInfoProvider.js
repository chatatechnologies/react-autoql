import React from 'react'
import { isMobile, isMobileLandscape } from './breakpoints'

export default class DeviceInfoProvider extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isMobile: isMobile(),
      isLandscape: isMobileLandscape(),
    }

    this.handleResize = this.handleResize.bind(this)
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('orientationchange', this.handleResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('orientationchange', this.handleResize)
  }

  handleResize() {
    this.setState({
      isMobile: isMobile(),
      isLandscape: isMobileLandscape(),
    })
  }

  render() {
    return React.Children.map(this.props.children, (child) => {
      return React.cloneElement(child, { deviceInfo: this.state })
    })
  }
}
