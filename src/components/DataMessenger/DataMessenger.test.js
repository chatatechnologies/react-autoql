import React from 'react'
import { shallow, mount } from 'enzyme'
import { findByTestAttr, checkProps } from '../../../test/testUtils'
import { DataMessenger } from './DataMessenger'
import responseTestCases from '../../../test/responseTestCases'

// Prevent react-tooltip from scheduling MutationObservers during tests
jest.mock('react-tooltip', () => ({ Tooltip: () => null, __esModule: true }))

const defaultProps = DataMessenger.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<DataMessenger {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with only token prop', () => {
    const wrapper = shallow(<DataMessenger authentication={{ token: 'token' }} />)
    expect(wrapper.exists()).toBe(true)
  })
  test('renders correctly with default props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
})
describe('props', () => {
  test('does not throw warning with expected props', () => {
    checkProps(DataMessenger, defaultProps)
  })
  describe('showMask', () => {
    test('showMask false does not show mask on drawer open', () => {
      const html = mount(<DataMessenger showMask={false} />)
      const mask = html.find('.drawer-mask')
      expect(mask.exists()).toBe(false)
    })
  })
  describe('placement', () => {
    test('renders correctly with left placement', () => {
      const wrapper = setup({ placement: 'left' })
      expect(wrapper.exists()).toBe(true)
    })
    test('renders correctly with top placement', () => {
      const wrapper = setup({ placement: 'top' })
      expect(wrapper.exists()).toBe(true)
    })
    test('renders correctly with bottom placement', () => {
      const wrapper = setup({ placement: 'bottom' })
      expect(wrapper.exists()).toBe(true)
    })
  })
  describe('width', () => {
    test('100vw width if placement is top', () => {
      const wrapper = setup({ placement: 'top', width: '200px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe('100vw')
    })
    test('100vw width if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', width: 600 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe('100vw')
    })
    test('width is applied if placement is right', () => {
      const wrapper = setup({ placement: 'right', width: '500px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe('500px')
    })
    test('width is applied if placement is left', () => {
      const wrapper = setup({ placement: 'left', width: 300 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe(300)
    })
  })
  describe('height', () => {
    test('100vh height if placement is left', () => {
      const wrapper = setup({ placement: 'left', height: '200px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe('100vh')
    })
    test('100vh height if placement is right', () => {
      const wrapper = setup({ placement: 'right', height: 600 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe('100vh')
    })
    test('height is applied if placement is top', () => {
      const wrapper = setup({ placement: 'top', height: '500px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe('500px')
    })
    test('height is applied if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', height: 300 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe(300)
    })
  })
})

describe('Suggestion query response flow', () => {
  let messengerComponent
  let chatContent
  let dmInstance
  let chatContentInstance
  let suggestionMessageOriginal

  // Stub network calls that may run on mount to avoid async errors
  const originalFetch = global.fetch
  beforeAll(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    messengerComponent = mount(<DataMessenger />)
    chatContent = findByTestAttr(messengerComponent, 'data-messenger-chat-content')
    dmInstance = messengerComponent.instance()
    chatContentInstance = chatContent.instance()
    jest.spyOn(chatContentInstance, 'addRequestMessage')
  })

  afterAll(() => {
    try {
      if (messengerComponent && typeof messengerComponent.unmount === 'function') {
        messengerComponent.unmount()
      }
    } catch (e) {
      // swallow unmount errors in CI environment
    }
    jest.restoreAllMocks()
    global.fetch = originalFetch
  })

  describe('handle click', () => {
    test('drawer renders closed by default', () => {
      expect(dmInstance.isOpen()).toBe(false)
    })
    test('drawer opens on handle click', () => {
      const handle = findByTestAttr(messengerComponent, 'data-messenger-handle')
      handle.simulate('click')
      expect(dmInstance.isOpen()).toBe(true)
    })
  })
  describe('add suggestion message', () => {
    test('suggestion message renders correctly', () => {
      chatContentInstance.addResponseMessage({
        response: responseTestCases[5],
        query: 'test query',
      })

      messengerComponent.update()
      suggestionMessageOriginal = findByTestAttr(messengerComponent, 'suggestion-message-container')

      expect(suggestionMessageOriginal.length).toBe(1)
    })
    describe('"None of these" click', () => {
      var noneOfTheseButton

      test('"None of these" button renders correctly', () => {
        noneOfTheseButton = findByTestAttr(messengerComponent, 'suggestion-list-button').findWhere((node) => {
          return node.name() && node.type() === 'button' && node.text() === 'None of these'
        })
        expect(noneOfTheseButton.length).toBe(1)
      })
      test('"None of these" click called addRequestMessage', async () => {
        noneOfTheseButton.simulate('click')
        expect(chatContentInstance.addRequestMessage).toHaveBeenCalledTimes(1)
      })
      test('"None of these" click added request message', () => {
        const lastChatMessage = messengerComponent.find('ChatMessage').last()
        const lastChatMessageProps = lastChatMessage.instance().props
        expect(lastChatMessageProps.isResponse).toBe(false)
        expect(lastChatMessageProps.content).toBe('None of these')
      })
      test('"None of these" click did not change original QueryOutput content', () => {
        messengerComponent.update()
        const suggestionMessage = findByTestAttr(messengerComponent, 'suggestion-message-container')
        expect(suggestionMessage.text()).toBe(suggestionMessageOriginal.text())
        messengerComponent.unmount()
      })
    })
  })
})
