import React from 'react'
import { render } from '@testing-library/react'
import { shallow } from 'enzyme'
import DataLimitWarning from './DataLimitWarning'

describe('DataLimitWarning', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const { container } = render(<DataLimitWarning />)
      expect(container.querySelector('.react-autoql-data-limit-warning')).toBeTruthy()
    })

    test('renders warning icon', () => {
      const { container } = render(<DataLimitWarning />)
      expect(container.querySelector('.react-autoql-icon')).toBeTruthy()
    })

    test('renders custom content string', () => {
      const { getByText } = render(<DataLimitWarning content='Custom warning message' />)
      expect(getByText('Custom warning message')).toBeTruthy()
    })

    test('applies custom className', () => {
      const { container } = render(<DataLimitWarning className='my-class' />)
      expect(container.querySelector('.my-class')).toBeTruthy()
    })

    test('sets custom tooltipContent on data attribute when provided', () => {
      const { container } = render(<DataLimitWarning tooltipContent='Custom tooltip' />)
      const el = container.querySelector('.react-autoql-data-limit-warning')
      expect(el.getAttribute('data-tooltip-html')).toBe('Custom tooltip')
    })

    test('sets tooltipID on data attribute when provided', () => {
      const { container } = render(<DataLimitWarning tooltipID='my-tooltip' />)
      const el = container.querySelector('.react-autoql-data-limit-warning')
      expect(el.getAttribute('data-tooltip-id')).toBe('my-tooltip')
    })

    test('default tooltip contains row limit formatted number', () => {
      const { container } = render(<DataLimitWarning rowLimit={1000} />)
      const el = container.querySelector('.react-autoql-data-limit-warning')
      expect(el.getAttribute('data-tooltip-html')).toContain('1,000')
    })
  })
})
