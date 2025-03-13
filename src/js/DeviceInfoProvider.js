import React, { useState, useEffect } from 'react'
import { isMobile, isMobileLandscape } from './breakpoints'

const DeviceInfoProvider = ({ children }) => {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: isMobile(),
    isLandscape: isMobileLandscape(),
  })

  const handleResize = () => {
    setDeviceInfo({
      isMobile: isMobile(),
      isLandscape: isMobileLandscape(),
    })
  }

  useEffect(() => {
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  return React.Children.map(children, (child) => {
    return React.cloneElement(child, { deviceInfo })
  })
}

export default DeviceInfoProvider
