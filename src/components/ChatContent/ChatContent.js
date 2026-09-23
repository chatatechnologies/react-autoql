import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _has from 'lodash.has'
import _isEqual from 'lodash.isequal'
import { isMobile } from 'react-device-detect'
import {
  REQUEST_CANCELLED_ERROR,
  UNAUTHENTICATED_ERROR,
  GENERAL_QUERY_ERROR,
  dataFormattingDefault,
} from 'autoql-fe-utils'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import { lang } from '../../js/Localization'
import { fetchSubjectListCached } from '../../js/subjectListService'
import { scrollTabIntoView } from '../../js/scrollTabIntoView'
import { isScreenSize, subscribeToScreenSize } from '../../js/breakpoints'
import { NEW_THREAD_TITLE, getUntitledTitle } from '../AgentMessenger/threadsReducer'

// Components
import { Icon } from '../Icon'
import { QueryInput } from '../QueryInput'
import { ChatMessage } from '../ChatMessage'
import { FilterLockPopover } from '../FilterLockPopover'
import { CustomScrollbars } from '../CustomScrollbars'
import { ConfirmPopover } from '../ConfirmPopover'
import { ThreadSwitcher } from '../ThreadSwitcher'
import { LoadingDots } from '../LoadingDots'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { Tooltip } from '../Tooltip'

// Styles
import './ChatContent.scss'

const TOOLBAR_OFFSET = 90 // Offset in pixels to account for toolbar at the top

// How long after the last wheel event a thread scroll is still considered "in
// progress". Long enough to bridge the gaps between wheel events in one flick,
// short enough that a deliberate pause hands the wheel back to the table.
const THREAD_WHEEL_IDLE_MS = 250

// Scrollers nested inside a message that would otherwise capture the wheel.
const NESTED_SCROLLER_SELECTOR = '.tabulator-tableholder, .react-autoql-custom-scrollbars'

// Px per line, for browsers that report wheel deltas in lines rather than pixels.
const WHEEL_LINE_HEIGHT = 16

// Trackpad momentum decays, so a delta that grows instead means the user pushed
// again - a new gesture. Small tolerance so wheel jitter doesn't read as a push.
const NEW_GESTURE_DELTA_TOLERANCE = 1

// Same ceiling the Data Agent puts on threads: past this the tab bar is all scroll
// and no context.
const MAX_SESSIONS = 8

export default class ChatContent extends React.Component {
  constructor(props) {
    super(props)

    this.TOOLTIP_ID = `react-autoql-chat-content-tooltip-${uuid()}`
    this.messageRefs = {}
    this.csvProgressLog = {}
    this.keepLoading = false
    this.scrollTimeout = null
    this.lastScrollMessageId = null
    this.lastScrollTime = 0

    // Sessions: when enableSessions is set, this instance becomes a "host" — it
    // renders the tab bar and one ChatContent per session (each with
    // isSessionTab, so they render a normal single thread). A session is a whole
    // ChatContent instance rather than a swapped-out message array so that
    // switching tabs keeps every response's own state (table config, chart type,
    // expanded rows) intact — only the active tab is laid out.
    this.sessionRefs = {}

    // Not isSessionHost()/createSessionObject() — those are class properties, so
    // reading props directly here keeps this independent of field-init order.
    const isSessionHost = !!props.enableSessions && !props.isSessionTab
    const initialSession = isSessionHost ? { id: uuid(), title: NEW_THREAD_TITLE } : null

    this.state = {
      sessions: initialSession ? [initialSession] : [],
      activeSessionId: initialSession?.id ?? null,
      messages: [],
      subjects: [],
      isQueryRunning: false,
      isDrilldownRunning: false,
      isInputDisabled: false,
      isGeneratingSummary: false,
      isAtBottom: true,
      // Filter lock (see ownsFilterLock). lockedFilters/hasFilters are populated
      // by onFilterChange once FilterLockPopover fetches on mount.
      isFilterLockMenuOpen: false,
      lockedFilters: [],
      hasFilters: false,
      // Whether lockedFilters has been filled in by a fetch yet. Until it has,
      // a mounting popover has to fetch; after it has, it is seeded from here
      // instead (see renderFilterLockPopover).
      hasFetchedFilters: false,
      // Phone-sized screens swap the session strip for a dropdown. Deliberately
      // the screen and not the drawer width: a narrow drawer on a desktop still
      // has a pointer, hover and a real scrollbar, which is what the strip needs.
      isSmallScreen: isScreenSize('sm'),
    }
  }

  static propTypes = {
    authentication: authenticationType.isRequired,
    autoQLConfig: autoQLConfigType.isRequired,
    dataFormatting: dataFormattingType,
    enableVoiceRecord: PropTypes.bool.isRequired,
    maxMessages: PropTypes.number.isRequired,
    inputPlaceholder: PropTypes.string.isRequired,
    enableDynamicCharting: PropTypes.bool.isRequired,
    autoChartAggregations: PropTypes.bool.isRequired,
    enableFilterLocking: PropTypes.bool.isRequired,
    // Forces the filter-lock control on when `autoQLConfig.enableFilterLocking`
    // is not set. The lock normally follows that config flag — this is for a
    // consumer that wants the control without it.
    showFilterLockButton: PropTypes.bool,
    // Tooltip for the filter-lock button (e.g. the filter category the data uses,
    // like "Household"). Defaults to the generic "Manage Filters".
    filterLockButtonLabel: PropTypes.string,
    // Called with the full lock list whenever it changes, for a parent that
    // holds this thread and needs to reflect the lock state (see DataMessenger).
    onFilterLockChange: PropTypes.func,
    onErrorCallback: PropTypes.func.isRequired,
    onSuccessAlert: PropTypes.func.isRequired,
    onRTValueLabelClick: PropTypes.func,
    disableMaxMessageHeight: PropTypes.bool,
    dataPageSize: PropTypes.number,
    sessionId: PropTypes.string,
    isResizing: PropTypes.bool,
    source: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), PropTypes.string]),
    scope: PropTypes.string,
    shouldRender: PropTypes.bool,
    // Whether this page occupies layout. Separate from shouldRender, which gates re-renders: a closed
    // DM keeps its active page laid out (so Tabulator keeps its measurements) while updates stay off.
    // Defaults to shouldRender when not provided.
    isActivePage: PropTypes.bool,
    hideChatBarAfterInitialResponse: PropTypes.bool,
    executeQuery: PropTypes.func,
    enableMagicWand: PropTypes.bool,
    showMagicWandQuoteButton: PropTypes.bool,
    enableBillingGate: PropTypes.bool,
    onQuotaExceeded: PropTypes.func,
    enableFollowOnQuery: PropTypes.bool,
    // Headline and supporting line for the centred message shown while the
    // thread has no messages. Fall back to the defaults in Localization.
    emptyStateTitle: PropTypes.node,
    emptyStateSubtitle: PropTypes.node,
    // When false, no message offers the "Delete data response" button. For
    // integrators whose chat is a durable record rather than a scratchpad —
    // removing an answer from the thread is meaningless there, and the button
    // is the only destructive control in the toolbar. Default true.
    enableMessageDelete: PropTypes.bool,
    // When true, the chat is split into user sessions: a tab bar across the top
    // with a close button per tab and a "+" to start a new one. Each session
    // gets its own UUID, sent to the query endpoint with the queries the user
    // types (see QueryInput's querySessionId). Default false — no tabs, no
    // session UUID, and no session header on any request.
    enableSessions: PropTypes.bool,
    // Internal. Set on the per-session children a session host renders, so they
    // render a plain single thread instead of recursing into another tab bar.
    isSessionTab: PropTypes.bool,
    // The session a thread belongs to. Set by the host on its children; a
    // consumer can also pass its own id when it manages sessions itself.
    querySessionId: PropTypes.string,
    // Internal. How a session tab reports the tab_display_name from a query
    // response back to its host.
    onSessionTitleChange: PropTypes.func,
    // Internal. The host's filter lock, handed to the visible session only: it is
    // one element with one ref and one set of locked filters, so mounting a copy in
    // every tab would have them fighting over it. Tabs never render their own.
    filterLockElement: PropTypes.node,
    // Internal. How a session tab tells its host it now has (or no longer has)
    // messages of its own, which decides whether its close button shows when it
    // is the only tab.
    onSessionContentChange: PropTypes.func,
    // Called with whether there is a conversation to clear — for a session host,
    // in whichever tab is on screen. The Data Messenger uses it to show its
    // header's "Clear conversation" button only when it has something to do.
    onContentChange: PropTypes.func,
    // A tooltip instance owned by the host to register against, so an embedded
    // ChatContent doesn't stand up a second one. Falls back to its own.
    tooltipID: PropTypes.string,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    disableMaxMessageHeight: false,
    isResizing: false,
    dataPageSize: undefined,
    source: null,
    scope: undefined,
    onRTValueLabelClick: undefined,
    shouldRender: true,
    isActivePage: undefined,
    hideChatBarAfterInitialResponse: false,
    executeQuery: () => {},
    enableMagicWand: false,
    showMagicWandQuoteButton: false,
    enableBillingGate: false,
    onQuotaExceeded: undefined,
    enableFollowOnQuery: false,
    emptyStateTitle: undefined,
    emptyStateSubtitle: undefined,
    showFilterLockButton: false,
    filterLockButtonLabel: undefined,
    enableMessageDelete: true,
    enableSessions: false,
    isSessionTab: false,
    querySessionId: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true

    // Before the host's early return below: the host is the one that renders the
    // tab bar, so it is the only one that cares about this.
    this.unsubscribeFromScreenSize = subscribeToScreenSize('sm', (isSmallScreen) => {
      if (this._isMounted) {
        this.setState({ isSmallScreen })
      }
    })

    // A session host has no thread of its own — its children do the work.
    if (this.isSessionHost()) {
      return
    }

    //disable input focus for mobile, as ios keyboard has bug
    if (this.props.shouldRender && !isMobile) {
      this.focusInput()
    }

    this.fetchAllSubjects()
    this.setupScrollListener()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.isSessionHost()) {
      // enableSessions turned on after mount - an integrator whose flag resolves
      // after the first render, or the example app's toggle. Only the constructor
      // seeds a session, so without this the host renders a tab strip with no
      // thread under it and no input, and every ref call (clearMessages,
      // animateInputTextAndSubmit) reaches nothing.
      if (!this.state.sessions.length) {
        const session = this.createSessionObject([])
        this.setState({ sessions: [session], activeSessionId: session.id })
      }

      // Reveal the selected tab: a session opened while the strip is already full
      // would otherwise land off the right edge with nothing to say it exists.
      if (
        prevState.activeSessionId !== this.state.activeSessionId ||
        prevState.sessions.length !== this.state.sessions.length
      ) {
        this.scrollActiveSessionTabIntoView()
      }

      this.notifyContentChange()

      return
    }

    // The other direction: this was a host on mount, so it took the early return
    // in componentDidMount and never set up the thread it now renders itself.
    if (!!prevProps.enableSessions && !prevProps.isSessionTab) {
      this.fetchAllSubjects()
      this.setupScrollListener()
    }

    //disable input focus for mobile, as ios keyboard has bug
    if (this.props.shouldRender && !prevProps.shouldRender && !isMobile) {
      this.focusInput()
    }

    // Coming back on screen (the drawer opened, or this session tab was selected):
    // the composer may have moved while this thread wasn't the one publishing.
    if (this.props.shouldRender && !prevProps.shouldRender) {
      this.publishComposerMetrics()
    }

    // The thread went off screen (the drawer closed, or another page took over)
    // with the lock menu open — it would otherwise be waiting there on the way back.
    if (!this.props.shouldRender && prevProps.shouldRender && this.state.isFilterLockMenuOpen) {
      this.closeFilterLockMenu()
    }

    if (!_isEqual(this.props.authentication, prevProps.authentication)) {
      this.fetchAllSubjects()
    }

    // Tell the session host when this tab stops (or goes back to) being empty, so
    // it can show or hide the close button on a lone tab.
    if (this.props.onSessionContentChange && prevState.messages !== this.state.messages) {
      const hadContent = !!prevState.messages?.length
      const hasContent = !!this.state.messages?.length

      if (hadContent !== hasContent) {
        this.props.onSessionContentChange(hasContent)
      }
    }

    this.notifyContentChange()

    // Check if a new message was added (user request or system response) and scroll to it
    if (this.state.messages.length > prevState.messages.length) {
      const newMessages = this.state.messages.slice(prevState.messages.length)
      // Scroll to the last new message (whether it's a user request or system response)
      const lastNewMessage = newMessages[newMessages.length - 1]
      if (lastNewMessage) {
        // Clear any pending scrolls
        if (this.scrollTimeout) {
          clearTimeout(this.scrollTimeout)
          this.scrollTimeout = null
        }

        // Request messages don't have animations, so scroll immediately
        // Response messages need delay for CSS animation to complete
        if (!lastNewMessage.isResponse) {
          // Scroll immediately for request messages
          requestAnimationFrame(() => {
            this.scrollToMessageTop(lastNewMessage.id)
          })
        } else {
          // Use requestAnimationFrame to ensure DOM is ready, then wait for animation (500ms)
          requestAnimationFrame(() => {
            // Wait for CSS animation to complete (0.5s) plus small buffer for DOM to settle
            this.scrollTimeout = setTimeout(() => {
              this.scrollToMessageTop(lastNewMessage.id)
              this.scrollTimeout = null
            }, 550)
          })
        }
      }
    }

    // The thinking indicator appears without a message being added, so the
    // block above never fires for it.
    if (this.isThinkingState(this.state) && !this.isThinkingState(prevState)) {
      this.scrollThinkingIndicatorIntoView()
    }

    // Setup scroll listener if not already set up
    if (this.messengerScrollComponent && !this.handleScroll) {
      this.setupScrollListener()
    }

    this.messengerScrollComponent?.update()
    // Check scroll position after update
    setTimeout(() => this.checkIfAtBottom(), 0)
  }

  componentWillUnmount = () => {
    this._isMounted = false

    if (this.cancelTabScroll) {
      this.cancelTabScroll()
    }

    this.unsubscribeFromScreenSize?.()

    clearTimeout(this.feedbackTimeout)
    clearTimeout(this.responseDelayTimeout)
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = null
    }
    this.removeScrollListener()
    this.composerObserver?.disconnect()
    this.composerObserver = undefined
    window.removeEventListener('resize', this.publishComposerMetrics)
    window.removeEventListener('orientationchange', this.publishComposerMetrics)
    window.visualViewport?.removeEventListener('resize', this.publishComposerMetrics)
  }

  // Where the composer starts, in viewport coordinates, published for the mobile
  // filter-lock sheet: it is portalled to the body (react-tiny-popover drops
  // parentElement on mobile) and pinned to the top of the screen, so its own
  // percentage height resolves against the document rather than against whatever
  // the chat occupies. The composer's top edge is the measurement that actually
  // says where the sheet has to stop, whatever sits around the thread and however
  // tall the optional Quick Topics row makes the composer.
  publishComposerMetrics = () => {
    const element = this.composerRef

    // Background session tabs measure the same composer as the visible one, so let
    // whichever is on screen own the value rather than fighting over it. Not gated
    // on _isMounted: a ref callback runs before componentDidMount, and the first
    // measurement is the one that matters.
    if (!element || this.props.shouldRender === false) {
      return
    }

    const top = element.getBoundingClientRect?.().top

    if (typeof top === 'number') {
      document.documentElement.style.setProperty('--react-autoql-composer-top', `${Math.round(top)}px`)
    }
  }

  setComposerRef = (element) => {
    this.composerRef = element

    this.composerObserver?.disconnect()
    this.composerObserver = undefined

    if (!element) {
      return
    }

    this.publishComposerMetrics()

    if (typeof ResizeObserver !== 'undefined') {
      this.composerObserver = new ResizeObserver(this.publishComposerMetrics)
      this.composerObserver.observe(element)
    }

    // A ResizeObserver fires when the composer's own box changes; the on-screen
    // keyboard and a rotation move it without resizing it.
    window.addEventListener('resize', this.publishComposerMetrics)
    window.addEventListener('orientationchange', this.publishComposerMetrics)
    window.visualViewport?.addEventListener('resize', this.publishComposerMetrics)
  }

  // ---- Sessions ----
  // Only the host (enableSessions, and not itself a session tab) runs any of
  // this. Everything below is a no-op for a plain thread.
  isSessionHost = () => {
    return !!this.props.enableSessions && !this.props.isSessionTab
  }

  createSessionObject = (sessions) => {
    // Placeholder title, numbered the way the Data Agent numbers threads: plain
    // "New thread" unless that name is taken, then the lowest free suffix. Once a
    // query in the session comes back with a tab_display_name, setSessionTitle
    // replaces it.
    return { id: uuid(), title: getUntitledTitle(sessions.map((session) => session.title)) }
  }

  scrollActiveSessionTabIntoView = () => {
    const list = this.sessionTabListRef
    const tab = list?.querySelector('.react-autoql-chat-session-tab.active')

    if (!list || !tab) {
      return
    }

    if (this.cancelTabScroll) {
      this.cancelTabScroll()
    }

    this.cancelTabScroll = scrollTabIntoView(list, tab)
  }

  getActiveSessionRef = () => {
    return this.sessionRefs[this.state.activeSessionId]
  }

  // Updater form here and in the two below: double-clicking "+" or closing two
  // tabs in one batch has to see the sessions the previous update produced, not
  // the ones from the render it started in.
  addSession = () => {
    this.setState((state) => {
      if (state.sessions.length >= MAX_SESSIONS) {
        return null
      }

      const session = this.createSessionObject(state.sessions)
      return { sessions: [...state.sessions, session], activeSessionId: session.id }
    })
  }

  setActiveSession = (sessionId) => {
    if (sessionId === this.state.activeSessionId) {
      return
    }

    this.setState({ activeSessionId: sessionId }, () => {
      // The tab that just became visible has been mounted all along, so its own
      // mount-time focus already happened; focus it again on the way in.
      !isMobile && this.getActiveSessionRef()?.focusInput()
    })
  }

  closeSession = (sessionId) => {
    this.setState(
      (state) => {
        const { sessions, activeSessionId } = state

        const closingIndex = sessions.findIndex((session) => session.id === sessionId)
        if (closingIndex === -1) {
          return null
        }

        const remainingSessions = sessions.filter((session) => session.id !== sessionId)

        // Closing the last tab starts a fresh one rather than leaving the page with
        // nothing, the same way the Data Agent's threads behave. The new id remounts
        // the thread, so its messages and session go with it.
        if (!remainingSessions.length) {
          const session = this.createSessionObject(remainingSessions)
          return { sessions: [session], activeSessionId: session.id }
        }

        let newActiveSessionId = activeSessionId
        if (sessionId === activeSessionId) {
          // Fall back to the tab on the left, or the first one if we closed the leftmost.
          newActiveSessionId = remainingSessions[Math.max(0, closingIndex - 1)]?.id
        }

        return { sessions: remainingSessions, activeSessionId: newActiveSessionId }
      },
      () => {
        !isMobile && this.getActiveSessionRef()?.focusInput()
      },
    )
  }

  // Every tab at once, replaced by one empty tab - the same end state as closing
  // them one by one, without the tab bar reshuffling under the cursor each time.
  // Confirmed before it runs: nothing here is recoverable.
  closeAllSessions = () => {
    this.sessionRefs = {}

    // No updater form, unlike the closes above: this doesn't read the sessions it
    // replaces, so there is nothing for a batched update to get stale.
    const session = this.createSessionObject([])

    this.setState({ sessions: [session], activeSessionId: session.id }, () => {
      !isMobile && this.getActiveSessionRef()?.focusInput()
    })
  }

  // First title wins, for the life of the tab. The backend derives the name
  // from the session's queries, so it can come back different on a later query —
  // but a tab renaming itself out from under the user as they keep asking
  // questions is worse than a name that only fits the first thing they asked.
  setSessionTitle = (sessionId, title) => {
    if (!title) {
      return
    }

    this.setState((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session || session.isTitled) {
        return null
      }

      return {
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title, isTitled: true } : s)),
      }
    })
  }

  // Whether the session has anything in it beyond the intro message. Closing the
  // last tab resets it, so on an empty one there is nothing to reset and the tab
  // bar hides the close button rather than offering a no-op.
  setSessionHasContent = (sessionId, hasContent) => {
    this.setState((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session || !!session.hasContent === hasContent) {
        return null
      }

      return {
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, hasContent } : s)),
      }
    })
  }

  fetchAllSubjects = () => {
    // Cached: with sessions on, one of these runs per tab with the same answer.
    fetchSubjectListCached(this.props.authentication)
      .then((subjects) => {
        if (this._isMounted) {
          if (subjects?.length) {
            const filteredSubjects = subjects.filter((subj) => !subj.isAggSeed())
            this.setState({ subjects: filteredSubjects })
          }
        }
      })
      .catch((error) => console.error(error))
  }

  focusInput = () => {
    if (this.isSessionHost()) {
      this.getActiveSessionRef()?.focusInput()
      return
    }

    if (this.queryInputRef?._isMounted) {
      this.queryInputRef.focus()
    }
  }

  scrollToBottom = () => {
    this.messengerScrollComponent?.scrollToBottom()
  }

  setupScrollListener = () => {
    // Don't set up if already set up
    if (this.handleScroll) return

    const container = this.messengerScrollComponent?.getContainer()
    if (container) {
      this.handleScroll = () => {
        this.checkIfAtBottom()
      }
      container.addEventListener('scroll', this.handleScroll)

      // PerfectScrollbar binds its own wheel handler to the container and applies
      // the delta itself, so a listener on the container would scroll on top of it
      // (PS registers first at mount, and stopPropagation doesn't reach a listener
      // on the same element). Capture on the ancestor runs before anything on the
      // container, so stopPropagation below keeps the delta from being applied twice.
      // passive: false — handleThreadWheel needs to be able to preventDefault.
      this.wheelListenerTarget = container.parentElement ?? container
      this.wheelListenerTarget.addEventListener('wheel', this.handleThreadWheel, { passive: false, capture: true })

      // Initial check
      this.checkIfAtBottom()
    }
  }

  removeScrollListener = () => {
    const container = this.messengerScrollComponent?.getContainer()
    if (container && this.handleScroll) {
      container.removeEventListener('scroll', this.handleScroll)
    }

    if (this.wheelListenerTarget) {
      this.wheelListenerTarget.removeEventListener('wheel', this.handleThreadWheel, { capture: true })
      this.wheelListenerTarget = undefined
    }
  }

  // Scrolling the thread past a table used to stop dead: the wheel event lands on
  // whatever is under the cursor, so the table's own scroller swallowed it
  // mid-flick. Once a scroll gesture is underway, keep it on the thread and let
  // the table have the wheel again only after the gesture has actually stopped.
  //
  // Runs in capture phase on the container's parent (see addScrollListener), so it
  // sees the event before PerfectScrollbar and before the table, and the browser
  // still applies the default scroll after dispatch — preventDefault here cancels it.
  handleThreadWheel = (e) => {
    const container = this.messengerScrollComponent?.getContainer()
    if (!container || !e.deltaY) {
      return
    }

    // Capture on the parent also sees wheel events on the container's siblings.
    if (e.target !== container && !container.contains(e.target)) {
      return
    }

    const now = Date.now()
    const isMidGesture = now - (this.lastThreadWheelTime ?? 0) < THREAD_WHEEL_IDLE_MS

    // The thread's own scroller carries .react-autoql-custom-scrollbars too, so
    // "nested" means a match that is strictly inside the container, not the
    // container itself.
    const nested = e.target?.closest?.(NESTED_SCROLLER_SELECTOR)
    const isOverNestedScroller = !!nested && nested !== container && container.contains(nested)

    // Not over a nested scroller: an ordinary thread scroll, just record it.
    if (!isOverNestedScroller) {
      this.lastThreadWheelTime = now
      this.lastThreadWheelDelta = Math.abs(e.deltaY)
      return
    }

    // Cursor started on the table with the thread at rest — the user means to
    // scroll the table, so leave it alone.
    if (!isMidGesture) {
      return
    }

    // Mid-gesture, but the delta grew: momentum only ever decays, so this is a
    // fresh push over the table. Without this the hijack below feeds itself -
    // every stolen event extends the gesture, so flicking repeatedly over a
    // table never hands the wheel back and the table looks stuck.
    if (Math.abs(e.deltaY) > (this.lastThreadWheelDelta ?? 0) + NEW_GESTURE_DELTA_TOLERANCE) {
      this.lastThreadWheelTime = 0
      this.lastThreadWheelDelta = 0
      return
    }

    // At the thread's own edge, let the event through so the table can take over
    // rather than swallowing the scroll entirely.
    const atTop = container.scrollTop <= 0
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      return
    }

    // deltaY is only in pixels when deltaMode is DOM_DELTA_PIXEL. Firefox commonly
    // reports lines instead, which would scroll a few pixels per flick.
    const scale = e.deltaMode === 1 ? WHEEL_LINE_HEIGHT : e.deltaMode === 2 ? container.clientHeight : 1

    e.preventDefault()
    // We own this delta now — keep PerfectScrollbar and the table from applying it again.
    e.stopPropagation()
    container.scrollTop += e.deltaY * scale
    this.lastThreadWheelTime = now
    this.lastThreadWheelDelta = Math.abs(e.deltaY)
  }

  checkIfAtBottom = () => {
    const container = this.messengerScrollComponent?.getContainer()
    if (!container) return

    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold

    if (this.state.isAtBottom !== isAtBottom) {
      this.setState({ isAtBottom })
    }
  }

  smoothScrollToBottom = () => {
    const container = this.messengerScrollComponent?.getContainer()
    if (!container) return

    const maxScrollTop = container.scrollHeight - container.clientHeight
    const startScrollTop = container.scrollTop
    const distance = maxScrollTop - startScrollTop
    const duration = 300 // ms
    const startTime = performance.now()

    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)

      const currentScrollTop = startScrollTop + distance * easeOut
      container.scrollTop = currentScrollTop

      // Update scrollbars during animation
      this.messengerScrollComponent?.update()

      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      } else {
        // Final update after animation completes
        container.scrollTop = maxScrollTop
        this.messengerScrollComponent?.update()
        this.checkIfAtBottom()
      }
    }

    requestAnimationFrame(animateScroll)
  }

  scrollToMessageFit = (messageId) => {
    // Debounce: if we just scrolled to this message recently, skip
    const now = Date.now()
    if (this.lastScrollMessageId === messageId && now - this.lastScrollTime < 500) {
      return
    }

    // Clear any pending scrolls
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = null
    }

    const container = this.messengerScrollComponent?.getContainer()
    if (!container) {
      this.scrollToBottom()
      return
    }

    // Try to find the element, with retries if needed
    const attemptScroll = (retries = 10) => {
      // Find the message element by ID
      const messageElement = document.getElementById(`message-${messageId}`)
      if (!messageElement) {
        if (retries > 0) {
          // Retry after a short delay
          setTimeout(() => attemptScroll(retries - 1), 100)
          return
        }
        // Fallback to bottom if message element not found after retries
        this.scrollToBottom()
        return
      }

      // Use getBoundingClientRect to get accurate positions
      const containerRect = container.getBoundingClientRect()
      const messageRect = messageElement.getBoundingClientRect()

      const containerHeight = container.clientHeight
      const messageHeight = messageRect.height

      // Calculate message positions relative to container
      const messageTopOffset = messageRect.top - containerRect.top
      const messageBottomOffset = messageRect.bottom - containerRect.bottom

      // Find the scrollable content container to calculate absolute position
      const scrollContent = container.querySelector('.chat-content-container')
      if (!scrollContent) {
        this.scrollToBottom()
        return
      }

      // Calculate the absolute position of the message within the scrollable content
      let messageAbsoluteTop = 0
      let element = messageElement
      while (element && element !== scrollContent) {
        messageAbsoluteTop += element.offsetTop
        element = element.offsetParent
      }

      // If message is bigger than screen, align top with top (with toolbar offset)
      if (messageHeight > containerHeight) {
        // Scroll so message top is TOOLBAR_OFFSET above container top
        const targetScrollTop = messageAbsoluteTop - TOOLBAR_OFFSET
        container.scrollTop = targetScrollTop
        this.messengerScrollComponent?.update()
        return
      }

      // Message is smaller than screen - fit it in viewport
      // Check if message top is above the desired position (TOOLBAR_OFFSET above container top)
      const desiredTopPosition = TOOLBAR_OFFSET

      if (messageTopOffset < desiredTopPosition) {
        // Scroll so message top is TOOLBAR_OFFSET above container top
        const targetScrollTop = messageAbsoluteTop - TOOLBAR_OFFSET
        container.scrollTop = targetScrollTop
        this.messengerScrollComponent?.update()
        return
      }

      // If bottom is below screen, scroll up to align bottom with bottom
      if (messageBottomOffset > 0) {
        // Calculate absolute bottom position
        const messageAbsoluteBottom = messageAbsoluteTop + messageHeight
        // Scroll so message bottom aligns with container bottom
        const targetScrollTop = messageAbsoluteBottom - containerHeight
        container.scrollTop = targetScrollTop
        this.messengerScrollComponent?.update()
        this.lastScrollMessageId = messageId
        this.lastScrollTime = Date.now()
        return
      }

      // Message is already fully visible, no need to scroll
      this.lastScrollMessageId = messageId
      this.lastScrollTime = Date.now()
    }

    // Start attempting to scroll
    attemptScroll()
  }

  scrollToMessageTop = (messageId) => {
    // Debounce: if we just scrolled to this message recently, skip
    const now = Date.now()
    if (this.lastScrollMessageId === messageId && now - this.lastScrollTime < 500) {
      return
    }

    // Clear any pending scrolls
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = null
    }

    const container = this.messengerScrollComponent?.getContainer()
    if (!container) {
      return
    }

    // Try to find the element, with retries if needed
    const attemptScroll = (retries = 3) => {
      // Find the message element by ID
      const messageElement = document.getElementById(`message-${messageId}`)
      if (!messageElement) {
        if (retries > 0) {
          // Retry after a short delay
          setTimeout(() => attemptScroll(retries - 1), 50)
          return
        }
        return
      }

      // Find the scrollable content container to calculate absolute position
      const scrollContent = container.querySelector('.chat-content-container')
      if (!scrollContent) {
        return
      }

      // Calculate the absolute position of the message within the scrollable content
      let messageAbsoluteTop = 0
      let element = messageElement
      while (element && element !== scrollContent) {
        messageAbsoluteTop += element.offsetTop
        element = element.offsetParent
      }

      // Calculate target scroll: align message top with container top (minus toolbar offset)
      // If this would scroll past the bottom, cap at the max scroll position
      const maxScrollTop = container.scrollHeight - container.clientHeight
      const targetScrollTop = Math.min(maxScrollTop, Math.max(0, messageAbsoluteTop - TOOLBAR_OFFSET))

      // Scroll to align message top with container top (with toolbar offset)
      // If message is small, this will naturally scroll as far as possible (toward bottom)
      const startScrollTop = container.scrollTop
      const distance = targetScrollTop - startScrollTop
      const duration = 300 // ms
      const startTime = performance.now()

      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3)

        const currentScrollTop = startScrollTop + distance * easeOut
        container.scrollTop = currentScrollTop

        // Update scrollbars during animation
        this.messengerScrollComponent?.update()

        if (progress < 1) {
          requestAnimationFrame(animateScroll)
        } else {
          // Final update after animation completes
          container.scrollTop = targetScrollTop
          this.messengerScrollComponent?.update()
          this.checkIfAtBottom()
        }
      }

      requestAnimationFrame(animateScroll)

      this.lastScrollMessageId = messageId
      this.lastScrollTime = Date.now()
    }

    // Start attempting to scroll
    requestAnimationFrame(() => {
      attemptScroll()
    })
  }
  onCSVDownloadProgress = ({ id, progress }) => {
    this.csvProgressLog[id] = progress
    if (this.messageRefs[id] && this.messageRefs[id]?._isMounted) {
      this.messageRefs[id].setState({
        csvDownloadProgress: progress,
      })
    }
  }

  // Stops the progress message's spinner when its export fails, so it doesn't
  // sit at "Fetching your file" forever next to the error message.
  onCSVDownloadError = ({ id }) => {
    delete this.csvProgressLog[id]
    if (this.messageRefs[id]?._isMounted) {
      this.messageRefs[id].setState({ csvDownloadFailed: true })
    }
  }

  // Whether there is a conversation to clear right now — for a host, in the tab
  // that's on screen. Reported up so the drawer header can show its "Clear
  // conversation" button only when it would do something.
  notifyContentChange = () => {
    if (!this.props.onContentChange) {
      return
    }

    const hasContent = this.isSessionHost()
      ? !!this.state.sessions.find((session) => session.id === this.state.activeSessionId)?.hasContent
      : !!this.state.messages?.length

    if (hasContent !== this.lastReportedHasContent) {
      this.lastReportedHasContent = hasContent
      this.props.onContentChange(hasContent)
    }
  }

  clearMessages = () => {
    if (this.isSessionHost()) {
      // Empty the tab first, which also cancels whatever it has in flight...
      this.getActiveSessionRef()?.clearMessages()

      // ...then replace the session object itself. Emptying the messages alone
      // leaves the tab on the same querySessionId (AutoQL-Session-ID) and its
      // first-wins title, so the next question would carry on the conversation the
      // user just cleared - on the backend, and under the old project after a
      // project switch. A new id also remounts the thread, the way closeSession
      // already starts the last tab over.
      this.setState((state) => {
        const index = state.sessions.findIndex((session) => session.id === state.activeSessionId)

        if (index === -1) {
          return null
        }

        const session = this.createSessionObject(state.sessions.filter((s) => s.id !== state.activeSessionId))
        const sessions = [...state.sessions]
        sessions[index] = session

        return { sessions, activeSessionId: session.id }
      })

      return
    }

    this.queryInputRef?.cancelQuery()
    if (this._isMounted) {
      this.setState({
        messages: [],
        isClearingAllMessages: true,
      })
    }
  }

  animateInputTextAndSubmit = (...params) => {
    if (this.isSessionHost()) {
      this.getActiveSessionRef()?.animateInputTextAndSubmit(...params)
      return
    }

    if (this.queryInputRef?._isMounted) {
      this.queryInputRef?.animateInputTextAndSubmit(...params)
    }
  }

  onNoneOfTheseClick = (queryMessageID) => {
    this.addRequestMessage('None of these', queryMessageID)
    this.setState({ isQueryRunning: true })

    clearTimeout(this.feedbackTimeout)
    this.feedbackTimeout = setTimeout(() => {
      if (this._isMounted) {
        clearTimeout(this.responseDelayTimeout)
        this.setState({ isQueryRunning: false, isInputDisabled: false })
        this.addResponseMessage({
          content: (
            <div className='feedback-message'>
              Thank you for your feedback!
              <br />
              To continue, try asking another query.
            </div>
          ),
          queryMessageID,
        })
      }
    }, 1000)
  }

  onDrilldownStart = () => {
    if (this.state.isDrilldownRunning) {
      // Drilldown is already running. Tell onDrilldownEnd to not remove the loading dots
      this.keepLoading = true
    }

    this.setState({ isDrilldownRunning: true, isInputDisabled: true })
  }

  onDrilldownEnd = ({ response, error, originalQueryID, drilldownFilters } = {}) => {
    if (this._isMounted) {
      if (this.keepLoading) {
        this.keepLoading = false
      } else {
        clearTimeout(this.responseDelayTimeout)
        this.setState({ isDrilldownRunning: false, isInputDisabled: false })

        if (response) {
          this.addResponseMessage({ response, originalQueryID, drilldownFilters })
        } else if (error) {
          this.addResponseMessage({
            content: error,
          })
        }
      }
    }
  }

  getIsSuggestionResponse = (response) => {
    return !!response?.data?.data?.items
  }

  deleteMessage = (id) => {
    const { messages } = this.state
    const messageIndex = messages.findIndex((message) => id === message.id)
    const message = messages[messageIndex]

    let messagesToDelete = [id]
    if (message?.queryMessageID) {
      messagesToDelete = messages?.filter((m) => m.queryMessageID === message.queryMessageID).map((m) => m.id)
    }

    const newMessages = messages.filter((message) => !messagesToDelete.includes(message.id))
    this.setState({ messages: newMessages })
  }

  addMessage = (message) => {
    this.addMessages([message])
  }

  addMessages = (newMessages) => {
    const { messages } = this.state
    let updatedMessages = [...messages]

    // Update existing messages or add new ones
    newMessages.forEach((newMessage) => {
      const existingIndex = updatedMessages.findIndex((msg) => msg.id === newMessage.id)
      if (existingIndex >= 0) {
        // Update existing message
        updatedMessages[existingIndex] = newMessage
      } else {
        // Add new message
        updatedMessages.push(newMessage)
      }
    })

    if (updatedMessages.length > this.props.maxMessages) {
      updatedMessages = updatedMessages.slice(-this.props.maxMessages)
    }

    if (this._isMounted) {
      this.setState({
        messages: updatedMessages,
      })
    }
  }

  addRequestMessage = (text, queryMessageID) => {
    this.addMessage(
      this.createMessage({
        content: text,
        isResponse: false,
        queryMessageID,
      }),
    )
  }

  addResponseMessage = (params = {}) => {
    let message
    params.isResponse = true

    if (params?.response?.error === 'Unauthenticated') {
      message = this.createErrorMessage(UNAUTHENTICATED_ERROR)
    } else if (params?.response?.error === 'Parse error') {
      message = this.createErrorMessage(GENERAL_QUERY_ERROR)
    } else if (!params?.response && !params?.content) {
      message = this.createErrorMessage()
    } else {
      const appliedFilters = this.getAppliedFilters(params?.response)
      message = this.createMessage({
        ...params,
        appliedFilters,
      })
    }

    if (message) {
      this.addMessage(message)
    }
  }

  onInputSubmit = (query, id) => {
    this.addRequestMessage(query, id)
    this.setState({ isInputDisabled: true })
    this.responseDelayTimeout = setTimeout(() => {
      this.setState({ isQueryRunning: true })
    }, 600)
  }

  onResponse = (response, query, queryMessageID) => {
    if (this._isMounted) {
      this.setState({ isQueryRunning: false, isInputDisabled: false })

      // Names the session's tab off what was asked in it. Not returned by the
      // backend yet — until it is, tabs keep their "New thread" placeholder.
      // The host ignores everything after the first one it accepts.
      if (response?.data?.data?.tab_display_name) {
        this.props.onSessionTitleChange?.(response.data.data.tab_display_name)
      }

      if (response?.data?.message === REQUEST_CANCELLED_ERROR && this.state.isClearingAllMessages) {
        this.setState({
          isClearingAllMessages: false,
          isQueryRunning: false,
          isDrilldownRunning: false,
          isInputDisabled: false,
        })
        return
      }

      if (this.getIsSuggestionResponse(response)) {
        this.addResponseMessage({
          content: 'I want to make sure I understood your query. Did you mean:',
          queryMessageID,
        })
      }

      // Keep around in case we want to use authorization_url
      if (_has(response?.data?.data, 'authorization_url')) {
        this.addResponseMessage({
          content: (
            <span>
              Looks like you're trying to query a Microsoft Dynamics data source.
              <a href={response.data.data.authorization_url} target='_blank' rel='noreferrer'>
                Click here to authorize access then try querying again.
              </a>
            </span>
          ),
          queryMessageID,
        })
      } else {
        this.addResponseMessage({ response, query, queryMessageID })
      }

      clearTimeout(this.responseDelayTimeout)

      //disable input focus for mobile, as ios keyboard has bug
      !isMobile && this.focusInput()
    }
  }

  createMessage = (params = {}) => {
    const uniqueId = params.id || uuid()

    return {
      id: uniqueId,
      type: params.response?.data?.data?.display_type,
      ...params,
    }
  }

  createErrorMessage = (content, queryMessageID) => {
    return this.createMessage({
      content: content || GENERAL_QUERY_ERROR,
      isResponse: true,
      type: 'error',
      queryMessageID,
    })
  }

  getAppliedFilters = (response) => {
    try {
      let persistedFilters = response?.data?.data?.fe_req?.persistent_filter_locks
      let sessionFilters = response?.data?.data?.fe_req?.session_filter_locks

      if (!Array.isArray(persistedFilters)) {
        persistedFilters = []
      }
      if (!Array.isArray(sessionFilters)) {
        sessionFilters = []
      }

      return [...persistedFilters, ...sessionFilters]
    } catch (error) {
      return []
    }
  }

  // Takes a state object so componentDidUpdate can ask the same question of
  // prevState and spot the transition into thinking.
  isThinkingState = (state) => {
    return !!(state?.isQueryRunning || state?.isDrilldownRunning || state?.isGeneratingSummary)
  }

  isChataThinking = () => {
    return this.isThinkingState(this.state)
  }

  // The thinking indicator mounts on its own — 600ms after the request message
  // in onInputSubmit — so the scroll that followed that message ran against
  // content this element wasn't part of yet. Adding it grows the thread with
  // nothing repositioning the view, which leaves it below the fold on any
  // conversation long enough to scroll. Nudge it back into frame, but only when
  // it is genuinely cut off, so an already-visible indicator doesn't jump.
  scrollThinkingIndicatorIntoView = () => {
    requestAnimationFrame(() => {
      const container = this.messengerScrollComponent?.getContainer()
      if (!container || !this.isChataThinking()) {
        return
      }

      const indicator = container.querySelector('.chat-content-thinking-indicator')
      if (!indicator) {
        return
      }

      // The watermark bar is painted over the foot of the scroll container, so
      // the last stretch of it isn't really visible.
      const bottomBar = this.chatContentRef?.querySelector('.chat-content-bottom-bar')
      const visibleBottom = container.getBoundingClientRect().bottom - (bottomBar?.getBoundingClientRect().height ?? 0)

      if (indicator.getBoundingClientRect().bottom > visibleBottom) {
        this.smoothScrollToBottom()
      }
    })
  }

  // ---- Filter lock ----
  // The thread owns the lock wherever it is rendered — standalone, or as the Data
  // Messenger's chat page. It sits at the head of the query input, it scopes the
  // queries this thread sends, and its locked filters feed this thread's
  // QueryInput, so there is nothing about it a parent is better placed to hold.
  //
  // A session tab is the one exception: its host renders one lock for the whole
  // strip and hands the element down, so the tabs share a single set of filters
  // instead of each fetching and holding its own.
  ownsFilterLock = () => {
    if (this.props.isSessionTab) {
      return false
    }

    // Deliberately NOT the top-level `enableFilterLocking` prop, even though it
    // is declared here: it predates this and standalone consumers pass it while
    // running their own lock and feeding this thread through `queryFilters`.
    // Counting it would swap their filters for ours and give them two lock
    // buttons. The Data Messenger's chat gets its lock from the config flag.
    return !!this.props.showFilterLockButton || !!this.props.autoQLConfig?.enableFilterLocking
  }

  // The lock for this thread's query input: the host's when this is a tab, its own
  // otherwise.
  getFilterLockElement = () => {
    if (this.props.isSessionTab) {
      return this.props.filterLockElement ?? null
    }

    return this.ownsFilterLock() ? this.renderFilterLockPopover() : null
  }

  openFilterLockMenu = () => {
    if (!this.state.isFilterLockMenuOpen) {
      this.setState({ isFilterLockMenuOpen: true })
    }
  }

  closeFilterLockMenu = () => {
    if (this.state.isFilterLockMenuOpen) {
      this.setState({ isFilterLockMenuOpen: false })
    }
  }

  // Clicking a value label in a response inserts it as a locked filter. Only
  // wired when this thread owns the lock; the consumer's callback still fires
  // either way.
  onRTValueLabelClick = (text) => {
    this.props.onRTValueLabelClick?.(text)
    this.setState({ isFilterLockMenuOpen: true }, () => {
      this.filterLockRef?.insertFilter(text)
    })
  }

  onFilterChange = (allFilters) => {
    // FilterLockPopover emits the full lock list (session + persistent) on mount
    // and on edits. BOTH kinds scope the current query's results — the persist
    // flag only governs lifetime (persistent locks are saved server-side and
    // refetched next session; session locks last only this session), not whether
    // a lock applies now. So forward every lock to QueryInput's queryFilters.
    const lockedFilters = allFilters ?? []
    this.setState({ lockedFilters, hasFilters: !!lockedFilters.length, hasFetchedFilters: true })

    // Mirror it up so a parent holding this thread (the Data Messenger, whose
    // ref is what integrators read) can reflect the lock state without owning
    // the popover.
    this.props.onFilterLockChange?.(lockedFilters)
  }

  // A plain-text summary of what the next query is scoped to, grouped by the
  // category each value came from and split by include/exclude. Text rather than
  // HTML so a filter value — which is user data — can never inject markup; the
  // newlines render because the tooltip class sets white-space: pre-line.
  getFilterSummary = () => {
    const filters = this.state.lockedFilters ?? []

    if (!filters.length) {
      return undefined
    }

    const groups = []
    filters.forEach((filter) => {
      const category = filter.show_message || 'Filter'
      const isExcluded = filter.filter_type === 'exclude'
      let group = groups.find((g) => g.category === category && g.isExcluded === isExcluded)

      if (!group) {
        group = { category, isExcluded, values: [] }
        groups.push(group)
      }

      group.values.push(filter.value)
    })

    const MAX_VALUES_PER_GROUP = 4
    const lines = groups.map(({ category, isExcluded, values }) => {
      const shown = values.slice(0, MAX_VALUES_PER_GROUP)
      const remaining = values.length - shown.length
      const suffix = remaining > 0 ? `, +${remaining} more` : ''
      return `${category}${isExcluded ? ' (excluded)' : ''}: ${shown.join(', ')}${suffix}`
    })

    return [lang.filterSummaryTooltipTitle, ...lines].join('\n')
  }

  renderFilterLockPopover = () => {
    const filterSummary = this.getFilterSummary()

    return (
      <FilterLockPopover
        ref={(r) => (this.filterLockRef = r)}
        authentication={this.props.authentication}
        isOpen={this.state.isFilterLockMenuOpen}
        onChange={this.onFilterChange}
        onClose={this.closeFilterLockMenu}
        // With sessions on, the popover is rendered into whichever tab is on
        // screen, so switching tabs unmounts and remounts it. A remount that
        // refetched would come back with persisted locks only, silently dropping
        // every session-scoped lock (those live in the popover's own state, not
        // in the filter-locking API). Seed it from what we already hold instead.
        seedFilters={this.state.hasFetchedFilters ? this.state.lockedFilters : undefined}
        parentElement={this.chatContentRef}
        // The menu takes its width from the boundary, which keeps it inside a panel
        // as narrow as the Data Messenger drawer. On a full-page thread that would
        // stretch it across the screen, so .filter-lock-popover caps it in CSS.
        boundaryElement={this.chatContentRef}
        // Match the other tooltip consumers in this render: when a consumer
        // passes its own tooltipID we do NOT mount our <Tooltip> (see render),
        // so hardcoding TOOLTIP_ID here would aim the popover's tooltips at an
        // unmounted target and they'd silently never show.
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
        // Toolbar sits just above the bottom composer — open the menu upward,
        // into the thread area, away from the input.
        positions={['top', 'bottom', 'left', 'right']}
        align='start'
        // No pointer arrow, and sit flush above the pill (padding 0) so the menu
        // covers the empty-state logo/title band instead of leaving them peeking
        // out below it.
        showArrow={false}
        padding={0}
      >
        {/* The same control the Data Messenger puts at the head of its input pill,
            rather than a labelled pill on a row of its own above the composer: it
            scopes the next query, so it belongs where you read it before typing —
            and a standalone ChatContent on a phone has no room for an extra row. */}
        <button
          className={`react-autoql-input-filter-lock-btn${this.state.isFilterLockMenuOpen ? ' is-open' : ''}${
            this.state.hasFilters ? ' has-filters' : ''
          }${isMobile ? ' mobile' : ''}`}
          // With filters on, the tooltip says what they are and says it straight
          // away — the badge alone tells you something is filtered but not what,
          // and that is the thing you want to check before asking a question.
          data-tooltip-content={filterSummary ?? this.props.filterLockButtonLabel ?? lang.openFilterLocking}
          data-tooltip-delay-show={filterSummary ? 0 : undefined}
          data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
          onClick={this.state.isFilterLockMenuOpen ? this.closeFilterLockMenu : this.openFilterLockMenu}
        >
          <span className='react-autoql-filter-lock-icon-container'>
            <Icon type='filter' />
            {this.state.hasFilters ? <div className='react-autoql-filter-lock-icon-badge' /> : null}
          </span>
        </button>
      </FilterLockPopover>
    )
  }

  setGeneratingSummary = (isGenerating) => {
    if (this._isMounted) {
      this.setState({ isGeneratingSummary: isGenerating })
    }
  }

  isLaidOut = () => {
    return this.props.isActivePage ?? this.props.shouldRender
  }

  shouldHideQueryInputComponent = () => {
    const { hideChatBarAfterInitialResponse } = this.props
    const { messages } = this.state

    if (hideChatBarAfterInitialResponse && messages.length > 0) {
      return true
    }
    return !this.isLaidOut()
  }
  onMessageResize = (messageId) => {
    if (!this.messengerScrollComponent) {
      return
    }

    this.messengerScrollComponent.update()
    // Don't scroll on resize - let the initial scroll handle positioning
    // This prevents multiple conflicting scrolls
  }

  // On a phone the strip becomes a dropdown: about one and a half tabs fit at that
  // width, and with no hover and a hidden scrollbar nothing on screen says the
  // other chats exist. Same chips and track, stacked instead of scrolled.
  renderSessionSwitcher = () => {
    const { sessions, activeSessionId } = this.state

    return (
      <ThreadSwitcher
        items={sessions.map((session) => ({
          id: session.id,
          title: session.title,
          // Stays on the last tab, which closing resets rather than removes - but
          // not while that tab is still empty, where the reset would look like the
          // click did nothing.
          canClose: sessions.length > 1 || session.hasContent,
          closeLabel: `Close ${session.title}`,
        }))}
        activeId={activeSessionId}
        onSelect={this.setActiveSession}
        onClose={this.closeSession}
        onNew={this.addSession}
        onCloseAll={this.closeAllSessions}
        canAddNew={sessions.length < MAX_SESSIONS}
        newLabel='New chat'
        closeAllLabel='Close all chats'
        confirmTitle={`Close all ${sessions.length} chats?`}
        confirmText='Your conversations will be cleared and a new chat will be started.'
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
      />
    )
  }

  renderSessionTabs = () => {
    const { sessions, activeSessionId } = this.state
    const tooltipID = this.props.tooltipID ?? this.TOOLTIP_ID

    if (this.state.isSmallScreen) {
      return this.renderSessionSwitcher()
    }

    return (
      <div className='react-autoql-chat-session-tabs'>
        <div className='react-autoql-chat-session-tab-list' role='tablist' ref={(r) => (this.sessionTabListRef = r)}>
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId

            return (
              <div
                key={session.id}
                className={`react-autoql-chat-session-tab ${isActive ? 'active' : ''}`}
                role='tab'
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => this.setActiveSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    this.setActiveSession(session.id)
                  }
                }}
              >
                <span className='react-autoql-chat-session-tab-dot' aria-hidden='true' />
                <span className='react-autoql-chat-session-tab-title' title={session.title}>
                  {session.title}
                </span>
                {/* Stays on the last tab, which closing resets rather than removes -
                    but not while that tab is still empty, where the reset would
                    look like the click did nothing. */}
                {(sessions.length > 1 || session.hasContent) && (
                  <span
                    className='react-autoql-chat-session-tab-close'
                    role='button'
                    aria-label={`Close ${session.title}`}
                    // Without this the click bubbles to the tab and activates
                    // the tab we're about to unmount.
                    onClick={(e) => {
                      e.stopPropagation()
                      this.closeSession(session.id)
                    }}
                    data-tooltip-content='Close chat'
                    data-tooltip-id={tooltipID}
                  >
                    <Icon type='close' />
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {/* Only once there are several: with a single tab this is the close button
            already on the tab itself, under a name that promises more. */}
        {sessions.length > 1 && (
          <ConfirmPopover
            className='react-autoql-chat-session-close-all-wrapper'
            popoverParentElement={this.chatSessionsRef}
            title={`Close all ${sessions.length} chats?`}
            text='Your conversations will be cleared and a new chat will be started.'
            confirmText='Close all'
            backText='Cancel'
            danger
            onConfirm={this.closeAllSessions}
            positions={['bottom', 'left', 'top', 'right']}
            align='end'
            tooltipID={tooltipID}
          >
            <button
              className='react-autoql-chat-session-tab-close-all'
              aria-label='Close all chats'
              data-tooltip-content='Close all chats'
              data-tooltip-id={tooltipID}
            >
              <Icon type='close-circle' />
            </button>
          </ConfirmPopover>
        )}
        <button
          className='react-autoql-chat-session-tab-new'
          onClick={this.addSession}
          disabled={sessions.length >= MAX_SESSIONS}
          aria-label='New chat'
          data-tooltip-content='New chat'
          data-tooltip-id={tooltipID}
        >
          <Icon type='plus' />
        </button>
      </div>
    )
  }

  // Session host: the tab bar, plus one ChatContent per session. Every session
  // stays mounted so its responses keep their state; only the active one is
  // laid out and allowed to re-render.
  renderSessions = () => {
    const isLaidOut = this.isLaidOut()

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-chat-sessions ${isLaidOut ? '' : 'react-autoql-content-hidden'}`}
          ref={(r) => (this.chatSessionsRef = r)}
          // The threads hide themselves the same way when they aren't laid out,
          // but the tab bar is the host's own — it has to go too.
          style={isLaidOut ? undefined : { visibility: 'hidden', opacity: '0', display: 'none' }}
        >
          {this.renderSessionTabs()}
          <div className='react-autoql-chat-sessions-content'>
            {this.state.sessions.map((session) => {
              const isActiveSession = session.id === this.state.activeSessionId

              return (
                <ChatContent
                  {...this.props}
                  key={session.id}
                  // React calls this with null as the tab unmounts, which is where a
                  // closed session's ref is dropped - doing it from closeSession
                  // instead would be undone by that detach.
                  ref={(r) => {
                    if (r) {
                      this.sessionRefs[session.id] = r
                    } else {
                      delete this.sessionRefs[session.id]
                    }
                  }}
                  isSessionTab={true}
                  enableSessions={false}
                  querySessionId={session.id}
                  // Only the host reports content up to the drawer header, and it
                  // reports the active tab's state. A tab inheriting this from the
                  // spread would clobber that with its own, background or not.
                  onContentChange={undefined}
                  onSessionTitleChange={(title) => this.setSessionTitle(session.id, title)}
                  onSessionContentChange={(hasContent) => this.setSessionHasContent(session.id, hasContent)}
                  // One lock for the strip: the host holds the filters and the
                  // element, and only the tab on screen mounts it.
                  filterLockElement={isActiveSession && this.ownsFilterLock() ? this.renderFilterLockPopover() : null}
                  queryFilters={this.ownsFilterLock() ? this.state.lockedFilters : this.props.queryFilters}
                  onRTValueLabelClick={
                    this.ownsFilterLock() ? this.onRTValueLabelClick : this.props.onRTValueLabelClick
                  }
                  shouldRender={this.props.shouldRender && isActiveSession}
                  isActivePage={isLaidOut && isActiveSession}
                />
              )
            })}
          </div>
        </div>
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} positionStrategy='fixed' />}
      </ErrorBoundary>
    )
  }

  render = () => {
    if (this.isSessionHost()) {
      return this.renderSessions()
    }

    const { messages } = this.state
    const isEmpty = messages.length === 0 && !this.isChataThinking()

    let chatMessageVisibility
    let chatMessageOpacity
    let chatMessageDisplay
    let queryInputVisibility
    let queryInputOpacity
    let queryInputDisplay

    const hideQueryInput = this.shouldHideQueryInputComponent()
    const isLaidOut = this.isLaidOut()

    if (!isLaidOut) {
      chatMessageVisibility = 'hidden'
      chatMessageOpacity = '0'
      chatMessageDisplay = 'none'
      queryInputVisibility = 'hidden'
      queryInputOpacity = '0'
      queryInputDisplay = 'none'
    } else if (hideQueryInput) {
      queryInputVisibility = 'hidden'
      queryInputOpacity = '0'
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.chatContentRef = r)}
          className={`chat-content-wrapper ${isLaidOut ? '' : 'react-autoql-content-hidden'}`}
          style={{ visibility: chatMessageVisibility, opacity: chatMessageOpacity, display: chatMessageDisplay }}
        >
          <div
            className={`chat-content-scroll-container
              ${this.props.enableQueryInputTopics === false ? 'no-topics' : ''}
              ${isMobile ? 'mobile-padding' : ''}`}
          >
            <CustomScrollbars
              ref={(r) => (this.messengerScrollComponent = r)}
              className='chat-content-scrollbars-container'
              suppressScrollX
            >
              <div className='chat-content-container'>
                {messages.map((message) => {
                  return (
                    <ChatMessage
                      key={message.id}
                      id={message.id}
                      ref={(r) => (this.messageRefs[message.id] = r)}
                      authentication={this.props.authentication}
                      autoQLConfig={this.props.autoQLConfig}
                      isCSVProgressMessage={message.isCSVProgressMessage}
                      initialCSVDownloadProgress={this.csvProgressLog[message.id]}
                      onCSVDownloadProgress={this.onCSVDownloadProgress}
                      onCSVDownloadError={this.onCSVDownloadError}
                      queryId={message.queryId}
                      queryText={message.query}
                      originalQueryID={message.originalQueryID}
                      queryMessageID={message.queryMessageID}
                      isDataMessengerOpen={this.props.isDataMessengerOpen}
                      isActive={this.state.activeMessageId === message.id}
                      addMessageToDM={this.addResponseMessage}
                      onDrilldownStart={this.onDrilldownStart}
                      onDrilldownEnd={this.onDrilldownEnd}
                      isResponse={message.isResponse}
                      isChataThinking={this.isChataThinking()}
                      onSuggestionClick={this.animateInputTextAndSubmit}
                      setGeneratingSummary={this.setGeneratingSummary}
                      customToolbarOptions={this.props.customToolbarOptions}
                      content={message.content}
                      scrollToBottom={this.scrollToBottom}
                      scrollToMessageTop={this.scrollToMessageTop}
                      scrollToMessageFit={this.scrollToMessageFit}
                      dataFormatting={this.props.dataFormatting}
                      response={message.response}
                      type={message.type}
                      drilldownFilters={message.drilldownFilters}
                      summaryResponseData={message.summaryResponseData}
                      focusPromptUsed={message.focusPromptUsed}
                      onErrorCallback={this.props.onErrorCallback}
                      enableCyclicalDates={this.props.enableCyclicalDates}
                      onSuccessAlert={this.props.onSuccessAlert}
                      deleteMessageCallback={this.deleteMessage}
                      enableMessageDelete={this.props.enableMessageDelete}
                      createDataAlertCallback={this.props.createDataAlertCallback}
                      scrollContainerRef={this.messengerScrollComponent}
                      isResizing={this.props.isResizing}
                      enableDynamicCharting={this.props.enableDynamicCharting}
                      onNoneOfTheseClick={this.onNoneOfTheseClick}
                      autoChartAggregations={this.props.autoChartAggregations}
                      onRTValueLabelClick={
                        this.ownsFilterLock() ? this.onRTValueLabelClick : this.props.onRTValueLabelClick
                      }
                      appliedFilters={message.appliedFilters}
                      disableMaxHeight={this.props.disableMaxMessageHeight}
                      queryRequestData={message.queryRequestData}
                      popoverParentElement={this.chatContentRef}
                      isVisibleInDOM={isLaidOut}
                      dataPageSize={this.props.dataPageSize}
                      shouldRender={this.props.shouldRender}
                      source={this.props.source}
                      scope={this.props.scope}
                      tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
                      chartTooltipID={this.props.chartTooltipID}
                      subjects={this.state.subjects}
                      onMessageResize={this.onMessageResize}
                      enableCustomColumns={this.props.enableCustomColumns}
                      disableAggregationMenu={this.props.disableAggregationMenu}
                      allowCustomColumnsOnDrilldown={this.props.allowCustomColumnsOnDrilldown}
                      preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
                      enableMagicWand={this.props.enableMagicWand}
                      showMagicWandQuoteButton={this.props.showMagicWandQuoteButton}
                      enableBillingGate={this.props.enableBillingGate}
                      onQuotaExceeded={this.props.onQuotaExceeded}
                      enableFollowOnQuery={this.props.enableFollowOnQuery}
                    />
                  )
                })}
                {this.isChataThinking() && (
                  <div className='chat-content-thinking-indicator'>
                    <div className='chat-content-thinking-avatar' aria-hidden='true'>
                      <Icon type='react-autoql-logo' />
                    </div>
                    <LoadingDots />
                  </div>
                )}
              </div>
            </CustomScrollbars>
            {isEmpty && (
              <div className='chat-content-empty-state'>
                <Icon type='react-autoql-logo' className='chat-content-empty-state-logo' />
                <h3 className='chat-content-empty-state-title'>{this.props.emptyStateTitle ?? lang.emptyStateTitle}</h3>
                <p className='chat-content-empty-state-subtitle'>
                  {this.props.emptyStateSubtitle ?? lang.emptyStateSubtitle}
                </p>
              </div>
            )}
            {!this.state.isAtBottom && (
              <button
                className='scroll-to-bottom-button'
                onClick={this.smoothScrollToBottom}
                aria-label='Scroll to bottom'
              >
                <Icon type='caret-down' />
              </button>
            )}
            <div className='chat-content-bottom-bar'>
              {/* Kept as a flex spacer so the watermark stays centred */}
              <div className='bottom-bar-left' />
              <div className='watermark'>
                <Icon type='react-autoql-bubbles-outlined' />
                {lang.run}
              </div>
              <div className='bottom-bar-right' />
            </div>
          </div>
          <div
            ref={this.setComposerRef}
            style={{ visibility: queryInputVisibility, opacity: queryInputOpacity, display: queryInputDisplay }}
            className={`chat-bar-container ${!hideQueryInput ? '' : 'react-autoql-content-hidden'}`}
          >
            <QueryInput
              ref={(r) => (this.queryInputRef = r)}
              className='chat-drawer-chat-bar'
              authentication={this.props.authentication}
              autoQLConfig={this.props.autoQLConfig}
              onSubmit={this.onInputSubmit}
              onResponseCallback={this.onResponse}
              addResponseMessage={this.addResponseMessage}
              isDisabled={this.state.isInputDisabled}
              enableVoiceRecord={this.props.enableVoiceRecord}
              autoCompletePlacement='above'
              showChataIcon={false}
              placeholder={this.props.inputPlaceholder}
              onErrorCallback={this.props.onErrorCallback}
              source={this.props.source}
              scope={this.props.scope}
              queryFilters={this.ownsFilterLock() ? this.state.lockedFilters : this.props.queryFilters}
              sessionId={this.props.sessionId}
              querySessionId={this.props.querySessionId}
              dataPageSize={this.props.dataPageSize}
              isResizing={this.props.isResizing}
              shouldRender={this.props.shouldRender}
              tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
              executeQuery={this.props.executeQuery}
              enableQueryInputTopics={this.props.enableQueryInputTopics}
              // The filter lock sits at the head of the input pill. A consumer's own
              // left content wins — the Data Messenger passes its lock down this way,
              // and only one control fits there.
              leftContent={this.getFilterLockElement()}
              disableColumnSelection={this.props.disableColumnSelectionForDataExplorer}
            />
          </div>
        </div>
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} positionStrategy='fixed' />}
      </ErrorBoundary>
    )
  }
}
