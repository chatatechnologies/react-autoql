import React from 'react'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Spinner.scss'

function Spinner(props) {
  return (
    <ErrorBoundary>
      <div className='spinner-loader' data-test='react-autoql-spinner' {...props}></div>
    </ErrorBoundary>
  )
}

export default Spinner
