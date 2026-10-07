import React from 'react'
import { mount } from 'enzyme'

import DataTruncatedNotice from './DataTruncatedNotice'

const setup = (props = {}) => mount(<DataTruncatedNotice {...props} />)

describe('DataTruncatedNotice', () => {
  describe('banner', () => {
    // Deliberately no total: nothing in the response counts the rows, so any total
    // shown here would be a number nobody measured.
    test('names how much is shown, and claims no total', () => {
      const wrapper = setup({ variant: 'banner', previewRowCount: 10 })

      expect(wrapper.text()).toContain('first 10 rows')
      // No "10 of 4,512" phrasing - there is no second number to put there.
      expect(wrapper.text()).not.toMatch(/\d+ of \d/)
    })

    // Both variants say the same thing about the same answer, and which one a message
    // gets is decided by nothing but the view it is on - so a restore button that
    // changes shape between them reads as a different control.
    test('drops the button outline, and so does the card', () => {
      const bannerButton = setup({ variant: 'banner' }).find('button.react-autoql-data-truncated-restore')
      const cardButton = setup({ variant: 'card' }).find('button.react-autoql-data-truncated-restore')

      expect(bannerButton.hasClass('btn-no-border')).toBe(true)
      expect(cardButton.hasClass('btn-no-border')).toBe(true)
    })

    test('offers the data back', () => {
      const onRestore = jest.fn()
      const wrapper = setup({ variant: 'banner', onRestore })

      wrapper.find('button.react-autoql-data-truncated-restore').simulate('click')

      expect(onRestore).toHaveBeenCalled()
    })
  })

  describe('card', () => {
    const cardIcon = (wrapper) => wrapper.find('span.react-autoql-data-truncated-card-icon')

    test('says the data is gone rather than drawing anything', () => {
      const wrapper = setup({ variant: 'card', displayType: 'column' })

      expect(wrapper.find('.react-autoql-data-truncated-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Chart data was cleared to save memory')
    })

    // The card stands in for a pivot table too, and calling that a chart would name a
    // view the user was never looking at.
    test('names the pivot table rather than a chart when that is what it replaced', () => {
      const wrapper = setup({ variant: 'card', displayType: 'pivot_table' })

      expect(wrapper.text()).toContain('Pivot table data was cleared to save memory')
      expect(cardIcon(wrapper).hasClass('react-autoql-icon-pivot-table')).toBe(true)
    })

    // The display type is `column`; the icon is `column-chart`. Passing the first where
    // the second belongs renders an empty span and says nothing about it, which is how
    // the card went iconless for every chart type.
    test('translates the display type into an icon name', () => {
      const wrapper = setup({ variant: 'card', displayType: 'stacked_bar' })

      expect(cardIcon(wrapper).hasClass('react-autoql-icon-stacked-bar-chart')).toBe(true)
      expect(cardIcon(wrapper).find('svg').exists()).toBe(true)
    })

    test('falls back to a chart icon when the display type is unknown', () => {
      const wrapper = setup({ variant: 'card', displayType: undefined })

      expect(cardIcon(wrapper).hasClass('react-autoql-icon-column-chart')).toBe(true)
      expect(cardIcon(wrapper).find('svg').exists()).toBe(true)
    })
  })

  // The shared Button renders its own spinner in place of the icon and marks itself
  // disabled with a class, so that is what "restoring" looks like here.
  test('while restoring, shows the spinner and disables itself', () => {
    const wrapper = setup({ isRestoring: true })
    const button = wrapper.find('button.react-autoql-data-truncated-restore')

    expect(button.hasClass('disabled')).toBe(true)
    expect(wrapper.find('[data-test="react-autoql-btn-loading"]').exists()).toBe(true)
  })

  // It has to look like every other control in the messenger, not a bespoke one.
  test('uses the shared button rather than a hand-rolled one', () => {
    const wrapper = setup()
    const button = wrapper.find('button.react-autoql-data-truncated-restore')

    expect(button.hasClass('react-autoql-btn')).toBe(true)
    expect(button.hasClass('react-autoql-btn-medium')).toBe(true)
  })

  test('a failed restore is reported next to the control, which becomes a retry', () => {
    const wrapper = setup({ error: 'Data could not be loaded.' })

    expect(wrapper.find('.react-autoql-data-truncated-error').text()).toBe('Data could not be loaded.')
    // Announced: the button's label changing to "Try again" is not, on its own.
    expect(wrapper.find('.react-autoql-data-truncated-error').prop('role')).toBe('alert')
    expect(wrapper.text()).toContain('Try again')
    expect(wrapper.text()).not.toContain('Restore data')
  })
})
