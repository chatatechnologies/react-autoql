import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import AgentMessage from '../AgentMessage'

// 40 rows: only the first ~30 are mounted, so the odd cell in the last row is off
// screen until a sort brings it to the top.
const rows = Array.from({ length: 40 }, (_, i) => [`Org ${String(i + 10)}`, i])
rows[39] = [{ id: 7, name: 'Acme' }, 39]

const message = {
  id: 'm1',
  role: 'agent',
  phase: 'data',
  items: [
    {
      id: 'm1-0',
      type: 'table',
      data: {
        columns: [
          { display_name: 'Organization', type: 'STRING' },
          { display_name: 'Count', type: 'QUANTITY' },
        ],
        rows,
      },
    },
    { id: 'm1-1', type: 'text', data: { text: 'Summary after the table' } },
  ],
}

describe('agent table sorting', () => {
  test('sorting a table whose cells include an object keeps the transcript on screen', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<AgentMessage message={message} enableTypewriter={false} />)

    fireEvent.click(screen.getByText('Organization'))

    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Summary after the table')).toBeInTheDocument()
    console.error.mockRestore()
  })
})

jest.mock('./index', () => {
  const actual = jest.requireActual('./index')
  const Boom = () => {
    throw new Error('boom')
  }
  return { ...actual, resolveRenderer: (type) => (type === 'boom' ? Boom : actual.resolveRenderer(type)) }
})

describe('agent item that fails to render', () => {
  test('shows an error in place of the item and keeps rendering the rest', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const broken = {
      ...message,
      items: [
        { id: 'b-0', type: 'boom', data: {} },
        { id: 'b-1', type: 'text', data: { text: 'Still here' } },
      ],
    }

    render(<AgentMessage message={broken} enableTypewriter={false} />)

    expect(screen.getByText("This part of the response couldn't be displayed.")).toBeInTheDocument()
    expect(screen.getByText('Still here')).toBeInTheDocument()
    console.error.mockRestore()
  })
})

describe('agent table scrolling', () => {
  // PerfectScrollbar hosts the transcript, and its own check for a scrollable child has
  // the wheel sign backwards: without this class a table at its top never scrolls down.
  // The real behaviour needs a browser; this guards the opt-out that fixes it.
  test('the table scroll container opts out of the host PerfectScrollbar wheel handling', () => {
    const { container } = render(<AgentMessage message={message} enableTypewriter={false} />)

    expect(container.querySelector('.simple-table-outer-container')).toHaveClass('ps__child--consume')
  })
})
