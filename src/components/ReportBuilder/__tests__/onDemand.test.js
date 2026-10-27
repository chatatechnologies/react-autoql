import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// ReportBuilder and Reports as the package exports them fetch their code the first time one is shown. Here that
// code is a stand-in, which can fail to arrive.
const mockFetch = { failures: 0 }
jest.mock('../onDemandCode', () => {
  if (mockFetch.failures > 0) {
    mockFetch.failures -= 1
    throw new Error('The file couldn’t be fetched')
  }
  const mockReact = require('react')
  class Reports extends mockReact.Component {
    flushAll() {
      return Promise.resolve([true])
    }

    render() {
      return mockReact.createElement('div', { 'data-test': 'real-reports' }, this.props.className)
    }
  }
  const ReportBuilder = (props) => mockReact.createElement('div', { 'data-test': 'real-builder' }, props.report.title)
  return { Reports, ReportBuilder }
})

// A fresh copy of the loader each time, which hasn't the code yet.
const onDemand = () => {
  let module
  jest.isolateModules(() => {
    module = require('../onDemand')
  })
  return module
}

beforeEach(() => {
  mockFetch.failures = 0
})

describe('the builder and workspace, fetched when first shown', () => {
  // First: once fetched, the code stays fetched for the rest of the file.
  it('say when the code couldn’t be fetched, and fetch it again when asked', async () => {
    mockFetch.failures = 1
    const onErrorCallback = jest.fn()
    const { ReportBuilder } = onDemand()
    render(<ReportBuilder report={{ title: 'Q3 review' }} onErrorCallback={onErrorCallback} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This report couldn’t be opened.')
    expect(onErrorCallback).toHaveBeenCalledWith(expect.any(Error))

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('real-builder')).toHaveTextContent('Q3 review')
  })

  it('say they’re loading until the code is in, then pass their props and ref on', async () => {
    const { Reports } = onDemand()
    const ref = React.createRef()
    render(<Reports ref={ref} className='mine' />)
    expect(screen.getByText('Loading reports…')).toBeInTheDocument()
    expect(ref.current).toBeNull()

    expect(await screen.findByTestId('real-reports')).toHaveTextContent('mine')
    expect(screen.queryByText('Loading reports…')).not.toBeInTheDocument()
    await expect(ref.current.flushAll()).resolves.toEqual([true])
  })

  it('draw at once once the code is in', async () => {
    const { Reports, ReportBuilder } = onDemand()
    render(<Reports />)
    await screen.findByTestId('real-reports')
    render(<ReportBuilder report={{ title: 'Q3 review' }} />)
    expect(screen.getByTestId('real-builder')).toHaveTextContent('Q3 review')
  })
})
