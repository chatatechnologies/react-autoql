import React from 'react'
import { shallow, mount } from 'enzyme'

import {
  findByTestAttr,
  checkProps,
  currentEventLoopEnd,
} from '../../../test/testUtils'
import { DataMessenger } from '../..'
import responseTestCases from '../../../test/responseTestCases'
import * as queryService from '../../js/queryService'
import sampleTopicsResponse from '../../../test/sampleTopicsResponse.json'

queryService.fetchTopics = jest.fn().mockResolvedValue(sampleTopicsResponse)
const defaultProps = DataMessenger.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<DataMessenger {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with only token prop', () => {
    const wrapper = shallow(
      <DataMessenger authentication={{ token: 'token' }} />
    )
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
    test('nullify width if placement is top', () => {
      const wrapper = setup({ placement: 'top', width: '200px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe(null)
    })
    test('nullify width if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', width: 600 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe(null)
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
    test('nullify height if placement is left', () => {
      const wrapper = setup({ placement: 'left', height: '200px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe(null)
    })
    test('nullify height if placement is right', () => {
      const wrapper = setup({ placement: 'right', height: 600 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe(null)
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
  const messengerComponent = mount(<DataMessenger />)
  const chatContent = findByTestAttr(
    messengerComponent,
    'data-messenger-chat-content'
  )
  const dmInstance = messengerComponent.instance()
  const chatContentInstance = chatContent.instance()
  jest.spyOn(chatContentInstance, 'addRequestMessage')
  var suggestionMessageOriginal

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
      suggestionMessageOriginal = findByTestAttr(
        messengerComponent,
        'suggestion-message-container'
      )

      expect(suggestionMessageOriginal.length).toBe(1)
    })
    describe('"None of these" click', () => {
      var noneOfTheseButton

      test('"None of these" button renders correctly', () => {
        noneOfTheseButton = findByTestAttr(
          messengerComponent,
          'suggestion-list-button'
        ).findWhere((node) => {
          return (
            node.name() &&
            node.type() === 'button' &&
            node.text() === 'None of these'
          )
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
        const suggestionMessage = findByTestAttr(
          messengerComponent,
          'suggestion-message-container'
        )
        expect(suggestionMessage.text()).toBe(suggestionMessageOriginal.text())
        messengerComponent.unmount()
      })
    })
  })
})

describe('Query topics flow', () => {
  const messengerComponent = mount(<DataMessenger defaultOpen />)
  const exploreQueriesInstance = messengerComponent
    .find('ExploreQueries')
    .instance()
  jest.spyOn(exploreQueriesInstance, 'animateQITextAndSubmit')
  var topicsMessage

  test('topics render if provided by endpoint', () => {
    messengerComponent.update()
    topicsMessage = findByTestAttr(
      messengerComponent,
      'topics-message-cascader-component'
    )
    expect(topicsMessage.exists()).toBe(true)
  })
  test('default active page is data-messenger', () => {
    expect(messengerComponent.state(['activePage'])).toBe('data-messenger')
  })
  test('explore queries opens on "see more" click', () => {
    const firstOption = findByTestAttr(topicsMessage, 'options-item-0-0')
    firstOption.simulate('click')
    messengerComponent.update()
    const seeMoreButton = findByTestAttr(messengerComponent, 'see-more-option')
    seeMoreButton.simulate('click')
    messengerComponent.update()
    expect(messengerComponent.state(['activePage'])).toBe('explore-queries')
  })
  test('explore queries input populates automatically on "see more" click', () => {
    expect(exploreQueriesInstance.animateQITextAndSubmit).toHaveBeenCalledWith(
      'Order Flow'
    )
  })
})
