import React, { Fragment } from 'react'

import styles from './Spinner.css'

function LoadingDots () {
  return (
    <Fragment>
      <style>{`${styles}`}</style>
      <div className="spinner-loader"></div>
    </Fragment>
  )
}

export default LoadingDots
