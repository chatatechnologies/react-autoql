import React from 'react'
import { shallow } from 'enzyme'
import ChatContent from './ChatContent'
import { QueryInput } from '../QueryInput'
import { SessionTabs } from '../SessionTabs'

// Prevent react-tooltip from scheduling MutationObservers during tests
jest.mock('react-tooltip', () => ({ Tooltip: () => null, __esModule: true }))

// Sessions never hit the network, but a plain thread fetches its subject list on
// mount — stub it so these tests don't reach out.
jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchSubjectList: () => Promise.resolve([]),
}))

const requiredProps = {
  authentication: { token: 'token', apiKey: 'key', domain: 'domain' },
  autoQLConfig: {},
  enableVoiceRecord: false,
  maxMessages: 20,
  inputPlaceholder: 'Type your queries here',
  enableDynamicCharting: true,
  autoChartAggregations: true,
  enableFilterLocking: false,
  onErrorCallback: () => {},
  onSuccessAlert: () => {},
}

// Shallow, not dived: the wrapper has to stay on the ChatContent instance so
// the session tests can drive its methods and read its state. The whole element
// tree it returns (ErrorBoundary and everything under it) is still findable.
const setup = (props = {}) => shallow(<ChatContent {...requiredProps} {...props} />)

// The strip itself is SessionTabs' business (and its own test's); what ChatContent
// owns is the list of sessions it hands over, so these read that rather than the
// rendered chips.
const getTabBar = (wrapper) => wrapper.find(SessionTabs)
const getTabs = (wrapper) => getTabBar(wrapper).prop('items')
const getTitles = (wrapper) => getTabs(wrapper).map((tab) => tab.title)
const getThreads = (wrapper) => wrapper.find(ChatContent)

describe('sessions disabled (default)', () => {
  test('renders a single thread with no tab bar', () => {
    const wrapper = setup()
    expect(wrapper.find(SessionTabs).exists()).toBe(false)
    expect(getThreads(wrapper).exists()).toBe(false)
    expect(wrapper.find('.chat-content-wrapper').exists()).toBe(true)
  })

  test('sends no session id with typed queries', () => {
    const wrapper = setup()
    expect(wrapper.find(QueryInput).prop('querySessionId')).toBeUndefined()
  })
})

describe('enableSessions', () => {
  test('starts with one New thread session and a thread for it', () => {
    const wrapper = setup({ enableSessions: true })
    const tabs = getTabs(wrapper)

    expect(tabs).toHaveLength(1)
    expect(tabs[0].title).toContain('New thread')

    const threads = getThreads(wrapper)
    expect(threads).toHaveLength(1)
    expect(threads.at(0).prop('isSessionTab')).toBe(true)
    // Sessions off on the child, otherwise it would render its own tab bar.
    expect(threads.at(0).prop('enableSessions')).toBe(false)
  })

  test('gives each session its own uuid', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    const ids = getThreads(wrapper).map((thread) => thread.prop('querySessionId'))
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  test('only the active session is laid out', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    // addSession activates the new tab.
    const threads = getThreads(wrapper)
    expect(threads.at(0).prop('isActivePage')).toBe(false)
    expect(threads.at(0).prop('shouldRender')).toBe(false)
    expect(threads.at(1).prop('isActivePage')).toBe(true)
    expect(threads.at(1).prop('shouldRender')).toBe(true)
  })

  test('the + button adds a tab and switches to it', () => {
    const wrapper = setup({ enableSessions: true })
    getTabBar(wrapper).prop('onNew')()
    wrapper.update()

    const tabs = getTabs(wrapper)
    expect(tabs).toHaveLength(2)
    expect(tabs[1].title).toContain('New thread 2')
    expect(getTabBar(wrapper).prop('activeId')).toBe(tabs[1].id)
  })

  test('stops at 8 tabs, the same ceiling the Data Agent puts on threads', () => {
    const wrapper = setup({ enableSessions: true })

    for (let i = 0; i < 10; i += 1) {
      wrapper.instance().addSession()
    }
    wrapper.update()

    expect(getTabs(wrapper)).toHaveLength(8)
    expect(getTabBar(wrapper).prop('canAddNew')).toBe(false)
  })

  test('clicking a tab activates it', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    const firstTabId = getTabs(wrapper)[0].id
    getTabBar(wrapper).prop('onSelect')(firstTabId)
    wrapper.update()

    expect(getTabBar(wrapper).prop('activeId')).toBe(firstTabId)
  })

  test('no close button on the last remaining session', () => {
    const wrapper = setup({ enableSessions: true })
    expect(getTabs(wrapper).map((tab) => tab.canClose)).toEqual([false])

    wrapper.instance().addSession()
    wrapper.update()
    expect(getTabs(wrapper).map((tab) => tab.canClose)).toEqual([true, true])
  })

  test('closing the active tab falls back to the one on its left', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    const firstSessionId = wrapper.state('sessions')[0].id
    getTabBar(wrapper).prop('onClose')(getTabs(wrapper)[1].id)
    wrapper.update()

    expect(getTabs(wrapper)).toHaveLength(1)
    expect(wrapper.state('activeSessionId')).toBe(firstSessionId)
  })

  test('closing an inactive tab leaves the active one alone', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    const activeSessionId = wrapper.state('activeSessionId')
    getTabBar(wrapper).prop('onClose')(getTabs(wrapper)[0].id)
    wrapper.update()

    expect(wrapper.state('activeSessionId')).toBe(activeSessionId)
  })

  test('a new tab takes the lowest new thread number no open tab is using', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.instance().addSession()
    wrapper.update()
    expect(getTitles(wrapper)).toEqual([
      expect.stringContaining('New thread'),
      expect.stringContaining('New thread 2'),
      expect.stringContaining('New thread 3'),
    ])

    // Close 2 and 3, then add one: it fills the 2 slot rather than becoming 4.
    const sessions = wrapper.state('sessions')
    wrapper.instance().closeSession(sessions[2].id)
    wrapper.instance().closeSession(sessions[1].id)
    wrapper.instance().addSession()
    wrapper.update()

    expect(getTitles(wrapper)).toEqual([expect.stringContaining('New thread'), expect.stringContaining('New thread 2')])
  })

  test('a tab the backend named frees its new thread number', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    // Name "New thread 2", so the number it was holding is up for grabs again.
    wrapper.instance().setSessionTitle(wrapper.state('sessions')[1].id, 'Sales by region')
    wrapper.instance().addSession()
    wrapper.update()

    expect(getTitles(wrapper)).toEqual([
      expect.stringContaining('New thread'),
      expect.stringContaining('Sales by region'),
      expect.stringContaining('New thread 2'),
    ])
  })

  test('reports content changes for the tab on screen, so the header can offer Clear', () => {
    const onContentChange = jest.fn()
    const wrapper = setup({ enableSessions: true, onContentChange })

    wrapper.instance().addSession()
    wrapper.update()
    const [firstSession, secondSession] = wrapper.state('sessions')

    // The tab on screen is the new, empty one - filling the other one changes
    // nothing the header can act on.
    wrapper.instance().setSessionHasContent(firstSession.id, true)
    wrapper.update()
    expect(onContentChange).not.toHaveBeenCalledWith(true)

    wrapper.instance().setSessionHasContent(secondSession.id, true)
    wrapper.update()
    expect(onContentChange).toHaveBeenLastCalledWith(true)

    // Switching to a tab with nothing in it takes the action away again.
    wrapper.instance().setSessionHasContent(secondSession.id, false)
    wrapper.update()
    expect(onContentChange).toHaveBeenLastCalledWith(false)
  })

  test('the first tab_display_name names the tab, later ones are ignored', () => {
    const wrapper = setup({ enableSessions: true })
    const sessionId = wrapper.state('sessions')[0].id

    wrapper.instance().setSessionTitle(sessionId, 'Sales by region')
    expect(wrapper.state('sessions')[0].title).toBe('Sales by region')

    wrapper.instance().setSessionTitle(sessionId, 'Something else entirely')
    expect(wrapper.state('sessions')[0].title).toBe('Sales by region')
  })

  test('clearing a session gives the tab a new id and title, not just empty messages', () => {
    const wrapper = setup({ enableSessions: true })
    const sessionId = wrapper.state('sessions')[0].id

    wrapper.instance().setSessionTitle(sessionId, 'Sales by region')
    wrapper.instance().clearMessages()
    wrapper.update()

    const [session] = wrapper.state('sessions')
    // A kept id would carry on the same backend conversation (AutoQL-Session-ID)
    // the next time the user asked something in the "cleared" tab.
    expect(session.id).not.toBe(sessionId)
    expect(session.title).toBe('New thread')
    expect(wrapper.state('activeSessionId')).toBe(session.id)
    expect(getTabs(wrapper)).toHaveLength(1)
  })

  test('clearing one session leaves the others alone', () => {
    const wrapper = setup({ enableSessions: true })
    wrapper.instance().addSession()
    wrapper.update()

    const [firstSession, secondSession] = wrapper.state('sessions')
    wrapper.instance().clearMessages()
    wrapper.update()

    const sessions = wrapper.state('sessions')
    expect(sessions).toHaveLength(2)
    expect(sessions[0].id).toBe(firstSession.id)
    expect(sessions[1].id).not.toBe(secondSession.id)
  })
})
