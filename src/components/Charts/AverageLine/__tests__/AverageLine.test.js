import React from 'react'
import { mount } from 'enzyme'
import { scaleBand, scaleLinear } from 'd3-scale'
import AverageLine from '../AverageLine'

describe('AverageLine', () => {
  const mockData = [
    ['Category A', 100],
    ['Category B', 200],
    ['Category C', 150],
    ['Category D', 300],
  ]

  const mockColumns = [
    { name: 'Category', type: 'STRING' },
    { name: 'Value', type: 'NUMBER' },
  ]

  const mockXScale = scaleBand().domain(['Category A', 'Category B', 'Category C', 'Category D']).range([0, 400])

  const mockYScale = scaleLinear().domain([0, 300]).range([300, 0])

  const defaultProps = {
    data: mockData,
    columns: mockColumns,
    numberColumnIndex: 1,
    visibleSeriesIndices: [1],
    xScale: mockXScale,
    yScale: mockYScale,
    width: 400,
    height: 300,
    isVisible: true,
    dataFormatting: {},
  }

  it('renders average line when visible', () => {
    const wrapper = mount(<AverageLine {...defaultProps} />)

    expect(wrapper.find('line')).toHaveLength(1)
    expect(wrapper.find('text')).toHaveLength(1)
    expect(wrapper.find('.average-line-container')).toHaveLength(1)
  })

  it('does not render when not visible', () => {
    const props = { ...defaultProps, isVisible: false }
    const wrapper = mount(<AverageLine {...props} />)

    expect(wrapper.find('line')).toHaveLength(0)
    expect(wrapper.find('text')).toHaveLength(0)
  })

  it('calculates correct average value', () => {
    const wrapper = mount(<AverageLine {...defaultProps} />)

    // Average of [100, 200, 150, 300] = 187.5
    const expectedAverage = 187.5
    const line = wrapper.find('line')

    expect(line.prop('y1')).toBe(mockYScale(expectedAverage))
    expect(line.prop('y2')).toBe(mockYScale(expectedAverage))
  })

  it('displays average value in label', () => {
    const wrapper = mount(<AverageLine {...defaultProps} />)

    const text = wrapper.find('text')
    expect(text.text()).toContain('Avg:')
    expect(text.text()).toContain('187.5')
  })

  it('handles empty data gracefully', () => {
    const props = { ...defaultProps, data: [] }
    const wrapper = mount(<AverageLine {...props} />)

    expect(wrapper.find('line')).toHaveLength(0)
    expect(wrapper.find('text')).toHaveLength(0)
  })

  it('handles invalid data gracefully', () => {
    const invalidData = [
      ['Category A', 'invalid'],
      ['Category B', null],
      ['Category C', undefined],
    ]

    const props = { ...defaultProps, data: invalidData }
    const wrapper = mount(<AverageLine {...props} />)

    expect(wrapper.find('line')).toHaveLength(0)
    expect(wrapper.find('text')).toHaveLength(0)
  })

  it('applies custom styling', () => {
    const props = {
      ...defaultProps,
      color: '#ff0000',
      strokeWidth: 3,
      strokeDasharray: '10,5',
    }

    const wrapper = mount(<AverageLine {...props} />)

    const line = wrapper.find('line')
    expect(line.prop('stroke')).toBe('#ff0000')
    expect(line.prop('strokeWidth')).toBe(3)
    expect(line.prop('strokeDasharray')).toBe('10,5')
  })

  it('calculates average across multiple series', () => {
    const multiSeriesData = [
      ['Category A', 100, 150],
      ['Category B', 200, 250],
      ['Category C', 150, 200],
      ['Category D', 300, 350],
    ]

    const multiSeriesColumns = [
      { name: 'Category', type: 'STRING' },
      { name: 'Series 1', type: 'NUMBER' },
      { name: 'Series 2', type: 'NUMBER' },
    ]

    const props = {
      ...defaultProps,
      data: multiSeriesData,
      columns: multiSeriesColumns,
      visibleSeriesIndices: [1, 2], // Both series
    }

    const wrapper = mount(<AverageLine {...props} />)

    // Average of all values: [100, 150, 200, 250, 150, 200, 300, 350] = 212.5
    const expectedAverage = 212.5
    const line = wrapper.find('line')

    expect(line.prop('y1')).toBe(mockYScale(expectedAverage))
    expect(line.prop('y2')).toBe(mockYScale(expectedAverage))
  })
})
