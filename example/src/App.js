import React, { Component, Fragment } from 'react'
import axios from 'axios'
import _ from 'lodash'
import {
  DataMessenger,
  QueryOutput,
  QueryInput,
  Dashboard,
  executeDashboard,
  unExecuteDashboard,
  NotificationIcon,
  NotificationFeed,
  DataAlerts,
  Icon as ChataIcon,
} from 'react-autoql'
import uuid from 'uuid'
import { sortable } from 'react-sortable'

import {
  Radio,
  Input,
  InputNumber,
  Switch,
  Button,
  Menu,
  Form,
  message,
  Modal,
  Spin,
  Select,
} from 'antd'

import {
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  MenuFoldOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons'

import SentimentAnalysisPage from './SentimentAnalysisPage'
import SpeechToTextPage from './SpeechToTextPage'

import 'antd/dist/antd.css'
import 'react-autoql/dist/autoql.esm.css'
import './index.css'

const getStoredProp = (name) => {
  if (getBaseUrl() === 'https://backend-staging.chata.io') {
    return localStorage.getItem(`staging-${name}`)
  }

  return localStorage.getItem(name)
}

const setStoredProp = (name, value) => {
  if (getBaseUrl() === 'https://backend-staging.chata.io') {
    localStorage.setItem(`staging-${name}`, value)
  }

  localStorage.setItem(name, value)
}

const isProd = () => {
  return window.location.href.includes('prod')
}

const getBaseUrl = () => {
  return window.location.href.includes('prod')
    ? 'https://backend.chata.io'
    : 'https://backend-staging.chata.io'
}

class Item extends React.Component {
  render() {
    return (
      <li
        style={{
          margin: '0 auto',
          width: '200px',
          listStyleType: 'none',
          padding: 0,
          cursor: 'pointer',
          border: '1px solid lightgray',
          borderRadius: '3px',
          paddingRight: '5px',
          marginBottom: '3px',
        }}
        {...this.props}
      >
        {this.props.children}
      </li>
    )
  }
}

const SortableItem = sortable(Item)

export default class App extends Component {
  authTimer = undefined

  state = {
    isQandA: false,
    maintenance: false,
    currentPage: 'drawer',
    isNewDashboardModalOpen: false,
    componentKey: uuid.v4(),
    isVisible: false,
    placement: 'right',
    showHandle: true,
    theme: 'light',
    response: null,
    showMask: true,
    shiftScreen: false,
    userDisplayName: 'Nikki',
    introMessage: undefined,
    enableAutocomplete: true,
    enableQueryInterpretation: true,
    enableFilterLocking: true,
    enableQueryValidation: true,
    enableQuerySuggestions: true,
    enableDrilldowns: true,
    enableExploreQueriesTab: true,
    enableNotificationsTab: true,
    enableNotifications: true,
    enableColumnVisibilityManager: true,
    enableVoiceRecord: true,
    enableSlackSharing: !isProd(),
    enableTeamsSharing: !isProd(),
    enableCSVDownload: false,
    dashboardTitleColor: 'rgb(72, 105, 142)',
    clearOnClose: false,
    height: 500,
    width: 550,
    title: 'Data Messenger',
    lightAccentColor: '#26a7df',
    darkAccentColor: '#26a7df',
    dashboardBackground: '#fafafa',
    maxMessages: 12,
    isEditing: false,
    debug: true,
    test: !isProd(),
    demo: getStoredProp('demo') === 'true',
    apiKey: getStoredProp('api-key') || '',
    domain: getStoredProp('domain-url') || '',
    projectId: getStoredProp('customer-id') || '',
    themeCode: getStoredProp('theme-code') || '',
    displayName: getStoredProp('user-id') || '',
    currencyCode: 'USD',
    languageCode: 'en-US',
    currencyDecimals: undefined,
    quantityDecimals: undefined,
    fontFamily: 'sans-serif',
    runDashboardAutomatically: false,
    // comparisonDisplay: true, // hang onto for now: See QueryOutput line 1250-1255 for details
    chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
    monthFormat: 'MMM YYYY',
    dayFormat: 'll',
    dashboardTiles: [],
    activeDashboardId: undefined,
    enableDynamicCharting: true,
    defaultTab: 'data-messenger',
    autoChartAggregations: true,
  }

  componentDidMount = () => {
    this.testAuthentication()
      .then(() => {
        this.fetchDashboards()
        this.fetchTopics()
      })
      .catch(() => {
        this.logoutUser()
      })
  }

  componentWillUnmount = () => {
    if (this.authTimer) {
      clearTimeout(this.authTimer)
    }
  }

  getAuthProp = () => {
    if (this.state.isQandA) {
      return {
        isQandA: true,
        projectID: this.state.projectId,
        apiKey: this.state.apiKey,
      }
    }

    return {
      token: getStoredProp('jwtToken'),
      apiKey: this.state.apiKey,
      domain: this.state.domain,
    }
  }

  getAutoQLConfigProp = () => {
    return {
      enableQueryValidation: this.state.enableQueryValidation,
      enableAutocomplete: this.state.enableAutocomplete,
      enableQueryInterpretation: this.state.enableQueryInterpretation,
      enableFilterLocking: this.state.enableFilterLocking,
      enableDrilldowns: this.state.enableDrilldowns,
      enableColumnVisibilityManager: this.state.enableColumnVisibilityManager,
      enableQuerySuggestions: this.state.enableQuerySuggestions,
      enableNotifications: this.state.enableNotifications,
      enableSlackSharing: this.state.enableSlackSharing,
      enableTeamsSharing: this.state.enableTeamsSharing,
      debug: this.state.debug,
      test: this.state.test,
      enableCSVDownload: this.state.enableCSVDownload,
    }
  }

  getDataFormattingProp = () => {
    return {
      currencyCode: this.state.currencyCode,
      languageCode: this.state.languageCode,
      currencyDecimals: this.state.currencyDecimals,
      quantityDecimals: this.state.quantityDecimals,
      // hang onto for now. See QueryOutput line 1250-1255 for details
      // comparisonDisplay: this.state.comparisonDisplay ? 'PERCENT' : 'RATIO',
      monthYearFormat: this.state.monthFormat,
      dayMonthYearFormat: this.state.dayFormat,
    }
  }

  getThemeConfigProp = () => {
    let lightAccentColor = this.state.lightAccentColor
    let darkAccentColor = this.state.darkAccentColor
    let chartColors = [...this.state.chartColors]
    let dashboardTitleColor = this.state.dashboardTitleColor
    let dashboardBackground = this.state.dashboardBackground

    if (this.state.isQandA && this.state.uiOverlay) {
      switch (this.state.projectId) {
        case 'eq_bank':
          lightAccentColor = '#C53392'
          darkAccentColor = '#C53392'
          break
        case 'radisson':
          lightAccentColor = '#565759'
          darkAccentColor = '#565759'
          break
        case 'texas':
          lightAccentColor = '#4e0101'
          darkAccentColor = '#4e0101'
          break
        case 'stifel':
          lightAccentColor = '#003057'
          darkAccentColor = '#003057'
          break
        case 'city_of_calgary':
          lightAccentColor = '#C7102E'
          darkAccentColor = '#C7102E'
          break
        case 'wyndham':
          lightAccentColor = '#005088'
          darkAccentColor = '#005088'
          break
        case 'uceed':
          lightAccentColor = '#FFCD00'
          darkAccentColor = '#FFCD00'
          break
        case 'deeleeo':
          lightAccentColor = '#FE7B44'
          darkAccentColor = '#FE7B44'
          break
        case 'opm':
          lightAccentColor = '#669900'
          darkAccentColor = '#669900'
          break
        case 'us_army':
          lightAccentColor = '#FEC325'
          darkAccentColor = '#FEC325'
          break
        case 'brp':
          lightAccentColor = '#FFC300'
          darkAccentColor = '#FFC300'
          break
        case 'chata':
          lightAccentColor = '#26A7Df'
          darkAccentColor = '#26A7Df'
          break
        default:
          lightAccentColor = '#26A7Df'
          darkAccentColor = '#26A7Df'
      }
    }

    return {
      theme: this.state.theme,
      accentColor:
        this.state.theme === 'light' ? lightAccentColor : darkAccentColor,
      fontFamily: this.state.fontFamily,
      chartColors: chartColors,
      titleColor: dashboardTitleColor,
      dashboardBackground: dashboardBackground,
    }
  }

  fetchNotificationData = (notificationId) => {
    const url = `${getBaseUrl()}/api/v1/rule-notifications/${notificationId}?key=${
      this.state.apiKey
    }`
    const token = getStoredProp('jwtToken')

    const config = {}
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
        'Integrator-Domain': this.state.domain,
      }
    }

    if (!this.state.apiKey || !this.state.domain) {
      return Promise.reject({ error: 'Unauthenticated' })
    }

    return axios
      .get(url, config)
      .then((response) => {
        if (response.data && typeof response.data === 'string') {
          return Promise.reject({ error: 'Parse error' })
        }
        if (
          !response ||
          !response.data ||
          !response.data.query_result ||
          !response.data.query_result.data ||
          response.data.query_result.data.display_type !== 'data'
        ) {
          return Promise.reject()
        }
        return Promise.resolve(response.data.query_result)
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  }

  testAuthentication = () => {
    const url = `${this.state.domain}/autoql/api/v1/query/related-queries?key=${this.state.apiKey}&search=test`
    const token = getStoredProp('jwtToken')

    const config = {}
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
      }
    }

    if (!this.state.apiKey || !this.state.domain) {
      this.setState({
        isAuthenticated: false,
        activeIntegrator: undefined,
        componentKey: uuid.v4(),
      })
      return Promise.reject()
    }

    return axios
      .get(url, config)
      .then(() => {
        this.setState({
          isAuthenticated: true,
          activeIntegrator: this.getActiveIntegrator(),
          componentKey: uuid.v4(),
        })
        return Promise.resolve()
      })
      .catch((error) => {
        this.setState({
          isAuthenticated: false,
          activeIntegrator: undefined,
          componentKey: uuid.v4(),
        })
        return Promise.reject(error)
      })
  }

  fetchTopics = async () => {
    this.setState({ isFetchingTopics: true })

    try {
      const jwtToken = getStoredProp('jwtToken')
      if (jwtToken) {
        const baseUrl = getBaseUrl()

        const url = `${baseUrl}/api/v1/topics?key=${this.state.apiKey}&project_id=${this.state.projectId}`
        const topicsResponse = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Integrator-Domain': this.state.domain,
          },
        })

        this.setState({
          componentKey: uuid.v4(),
          topics: topicsResponse.data.items,
          topicsError: false,
          isFetchingTopics: false,
        })
      }
    } catch (error) {
      console.error(error)
      this.setState({
        componentKey: uuid.v4(),
        topics: undefined,
        topicsError: true,
        isFetchingTopics: false,
      })
    }
  }

  fetchDashboards = async () => {
    this.setState({
      isFetchingDashboard: true,
    })

    try {
      const jwtToken = getStoredProp('jwtToken')
      if (jwtToken) {
        const baseUrl = getBaseUrl()

        const url = `${baseUrl}/api/v1/dashboards?key=${this.state.apiKey}&project_id=${this.state.projectId}`
        const dashboardResponse = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Integrator-Domain': this.state.domain,
          },
        })

        let dashboardTiles
        let activeDashboardId
        let dashboardsList = []
        if (_.get(dashboardResponse, 'data.items.length')) {
          dashboardsList = _.sortBy(
            dashboardResponse.data.items,
            (dashboard) => {
              return new Date(dashboard.created_at)
            }
          )
          dashboardTiles = _.get(dashboardsList, '[0].data')
          activeDashboardId = _.get(dashboardsList, '[0].id')
        }

        this.setState({
          dashboardsList,
          dashboardTiles,
          dashboardError: false,
          isFetchingDashboard: false,
          activeDashboardId,
        })
      }
    } catch (error) {
      console.error(error)
      this.setState({
        dashboardsList: undefined,
        dashboardTiles: [],
        dashboardError: true,
        isFetchingDashboard: false,
        activeDashboardId: null,
      })
    }
  }

  getJWT = async (loginToken) => {
    try {
      if (!loginToken) {
        throw new Error('Invalid Login Token')
      }

      const baseUrl = getBaseUrl()
      let url = `${baseUrl}/api/v1/jwt?display_name=${this.state.displayName}&project_id=${this.state.projectId}`

      // Use login token to get JWT token
      const jwtResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${loginToken}`,
        },
      })

      // Put jwt token into storage
      const jwtToken = jwtResponse.data
      setStoredProp('jwtToken', jwtToken)

      if (this.authTimer) {
        clearTimeout(this.authTimer)
      }
      this.authTimer = setTimeout(() => {
        this.setState({
          isAuthenticated: false,
        })
      }, 2.16e7)

      return this.testAuthentication()
        .then(() => {
          this.setState({
            isAuthenticated: true,
            isAuthenticating: false,
            componentKey: uuid.v4(),
            activeIntegrator: this.getActiveIntegrator(),
          })

          return Promise.resolve()
        })
        .catch(() => {
          this.setState({
            isAuthenticated: false,
            isAuthenticating: false,
            activeIntegrator: undefined,
          })

          return Promise.reject()
        })
    } catch (error) {
      this.setState({ isAuthenticating: false })
    }
  }

  onLogin = async () => {
    if (this.state.isQandA) {
      message.success('Login Sucessful!', 0.8)
      this.fetchTopics()
    } else {
      try {
        this.setState({
          isAuthenticating: true,
        })
        const baseUrl = getBaseUrl()

        // Login to get login token
        const loginFormData = new FormData()
        loginFormData.append('username', this.state.email)
        loginFormData.append('password', this.state.password)
        const loginResponse = await axios.post(
          `${baseUrl}/api/v1/login`,
          loginFormData,
          {
            headers: {
              // 'Access-Control-Allow-Origin': '*'
            },
          }
        )

        // Put login token in local storage
        const loginToken = loginResponse.data
        setStoredProp('loginToken', loginToken)

        await this.getJWT(loginToken)

        message.success('Login Sucessful!', 0.8)
        this.fetchDashboards()
        this.fetchTopics()
      } catch (error) {
        console.error(error)
        // Clear tokens
        setStoredProp('loginToken', null)
        setStoredProp('jwtToken', null)
        this.setState({
          isAuthenticated: false,
          isAuthenticating: false,
          activeIntegrator: null,
          componentKey: uuid.v4(),
        })

        // Dont fetch dashboard if authentication failed...
        message.error('Invalid Credentials')
      }
    }
  }

  getActiveIntegrator = () => {
    const { domain } = this.state

    if (domain.includes('accounting-demo')) {
      return 'demo'
    }

    return undefined
  }

  createRadioInputGroup = (title, propName, propValues = [], reload) => {
    return (
      <div>
        <h4>{title}</h4>
        {reload && <h6>(Must click 'Reload Data Messenger' to apply this)</h6>}
        <Radio.Group
          defaultValue={this.state[propName]}
          onChange={(e) => this.setState({ [propName]: e.target.value })}
          buttonStyle="solid"
        >
          {propValues.map((propValue) => {
            return (
              <Radio.Button value={propValue} key={`${propName}-${propValue}`}>
                {propValue.toString()}
              </Radio.Button>
            )
          })}
        </Radio.Group>
      </div>
    )
  }

  createBooleanRadioGroup = (title, propName, propValues = []) => {
    return (
      <div>
        <h4>{title}</h4>
        <Switch
          defaultChecked={this.state[propName]}
          checked={this.state[propName] === true}
          onChange={(e) => {
            this.setState({ [propName]: e })
            setStoredProp(propName, e)
          }}
        />
      </div>
    )
  }

  onSortChartColors = (items) => {
    this.setState({
      items: items,
    })
  }

  onError = (error) => {
    if (error && error.message && this.state.isAuthenticated) {
      message.error(`${error.message}`)
    }
  }

  onSuccess = (alertText) => {
    if (alertText) {
      message.success(alertText)
    }
  }

  reloadDataMessenger = () => {
    this.setState({ componentKey: uuid.v4() })
  }

  createDashboard = async () => {
    this.setState({
      isSavingDashboard: true,
    })

    try {
      const data = {
        username: this.state.username,
        project_id: this.state.projectId,
        name: this.state.dashboardNameInput,
      }

      const baseUrl = getBaseUrl()

      const url = `${baseUrl}/api/v1/dashboards?key=${this.state.apiKey}`

      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
          'Integrator-Domain': this.state.domain,
        },
      })

      const newDashboardsList = [...this.state.dashboardsList, response.data]

      this.setState({
        dashboardsList: newDashboardsList,
        dashboardTiles: response.data.data,
        activeDashboardId: response.data.id,
        isSavingDashboard: false,
        isEditing: true,
        isNewDashboardModalOpen: false,
        dashboardNameInput: undefined,
      })
    } catch (error) {
      message.error(error.message)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true,
      })
    }
  }

  deleteDashboard = async () => {
    this.setState({
      isDeletingDashboard: true,
    })

    try {
      const baseUrl = getBaseUrl()
      const url = `${baseUrl}/api/v1/dashboards/${this.state.activeDashboardId}?key=${this.state.apiKey}&project_id=${this.state.projectId}`

      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
          'Integrator-Domain': this.state.domain,
        },
      })

      const newDashboardsList = this.state.dashboardsList.filter(
        (dashboard) => dashboard.id !== this.state.activeDashboardId
      )
      const newActiveDashboardId = newDashboardsList[0]
        ? newDashboardsList[0].id
        : undefined
      const newDashboardTiles = newDashboardsList[0]
        ? newDashboardsList[0].data
        : undefined

      this.setState({
        dashboardsList: newDashboardsList,
        activeDashboardId: newActiveDashboardId,
        dashboardTiles: newDashboardTiles,
        isDeletingDashboard: false,
        isEditing: false,
      })
    } catch (error) {
      console.error(error)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true,
      })
    }
  }

  saveDashboard = async () => {
    this.setState({
      isSavingDashboard: true,
    })

    try {
      const index = this.state.dashboardsList.findIndex(
        (dashboard) => dashboard.id === this.state.activeDashboardId
      )
      const activeDashboard = this.state.dashboardsList[index]

      const data = {
        username: this.state.username,
        name: activeDashboard.name,
        data: this.state.dashboardTiles.map((tile) => {
          return {
            ...tile,
            queryResponse: undefined,
            secondQueryResponse: undefined,
          }
        }),
      }

      const baseUrl = getBaseUrl()

      const url = `${baseUrl}/api/v1/dashboards/${this.state.activeDashboardId}?key=${this.state.apiKey}`

      await axios.put(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
          'Integrator-Domain': this.state.domain,
        },
      })

      const newDashboardsList = _.cloneDeep(this.state.dashboardsList)
      newDashboardsList[index].data = this.state.dashboardTiles.map((tile) => {
        return {
          ...tile,
          queryResponse: undefined,
          secondQueryResponse: undefined,
        }
      })

      this.setState({
        isSavingDashboard: false,
        dashboardsList: newDashboardsList,
        isEditing: false,
      })
    } catch (error) {
      console.error(error)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true,
      })
    }
  }

  resetDashboard = () => {
    try {
      if (this.state.dashboardTiles) {
        const newDashboardTiles = this.state.dashboardTiles.map((tile) => {
          return {
            ...tile,
            queryResponse: undefined,
            secondQueryResponse: undefined,
          }
        })

        this.setState({ dashboardTiles: newDashboardTiles })
      }
    } catch (error) {
      console.error(error)
    }
  }

  renderChartColorsList = () => {
    const { chartColors } = this.state
    var listItems = chartColors.map((item, i) => {
      return (
        <SortableItem
          key={i}
          onSortItems={this.onSortChartColors}
          items={chartColors}
          sortId={i}
        >
          {item}
          <CloseOutlined
            style={{ float: 'right', cursor: 'pointer', marginTop: '3px' }}
            onClick={() => {
              const newChartColors = this.state.chartColors.filter(
                (color) => color !== item
              )
              this.setState({ chartColors: newChartColors })
            }}
          />
        </SortableItem>
      )
    })

    return (
      <div>
        <ul
          style={{ padding: 0, marginBottom: '3px' }}
          className="sortable-list"
        >
          {listItems}
        </ul>
        <Input
          placeholder="New Color"
          value={this.state.newColorInput}
          onChange={(e) => this.setState({ newColorInput: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const newChartColors = [...this.state.chartColors, e.target.value]
              this.setState({ chartColors: newChartColors, newColorInput: '' })
            }
          }}
        />
      </div>
    )
  }

  logoutUser = () => {
    this.setState({
      isAuthenticated: false,
      dashboardTiles: undefined,
    })
    setStoredProp('loginToken', undefined)
    setStoredProp('jwtToken', undefined)
    message.success('Successfully logged out')
  }

  renderAuthenticationForm = () => {
    const layout = {
      labelCol: { span: 8 },
      wrapperCol: { span: 16 },
    }
    const tailLayout = {
      wrapperCol: { offset: 8, span: 16 },
    }

    return (
      <Fragment>
        <Form
          {...layout}
          initialValues={{
            projectId: this.state.projectId,
            displayName: this.state.displayName,
            apiKey: this.state.apiKey,
            domain: this.state.domain,
          }}
          style={{ marginTop: '20px' }}
          onFinish={this.onLogin}
          onFinishFailed={(errorInfo) => console.log('Failed:', errorInfo)}
        >
          <Form.Item
            label="Project ID"
            name="projectId"
            rules={[
              { required: true, message: 'Please enter your project ID' },
            ]}
          >
            <Input
              name="customer-id"
              onChange={(e) => {
                this.setState({ projectId: e.target.value })
              }}
              onBlur={(e) => setStoredProp('customer-id', e.target.value)}
              value={this.state.projectId}
              // autoComplete="on"
            />
          </Form.Item>
          {!this.state.isQandA && (
            <Form.Item
              label="User Email"
              name="displayName"
              rules={[{ required: true, message: 'Please enter your email' }]}
            >
              <Input
                name="user-id"
                onChange={(e) => {
                  this.setState({ displayName: e.target.value })
                }}
                onBlur={(e) => setStoredProp('user-id', e.target.value)}
                value={this.state.displayName}
                // autoComplete="on"
              />
            </Form.Item>
          )}
          <Form.Item
            label="API key"
            name="apiKey"
            rules={[{ required: true, message: 'Please enter your API key' }]}
          >
            <Input
              name="api-key"
              onChange={(e) => {
                this.setState({ apiKey: e.target.value })
              }}
              onBlur={(e) => setStoredProp('api-key', e.target.value)}
              value={this.state.apiKey}
              // autoComplete="on"
            />
          </Form.Item>
          {!this.state.isQandA && (
            <>
              <Form.Item
                label="Domain URL"
                name="domain"
                rules={[
                  { required: true, message: 'Please enter your domain URL' },
                ]}
              >
                <Input
                  name="domain-url"
                  onChange={(e) => {
                    this.setState({ domain: e.target.value })
                  }}
                  onBlur={(e) => setStoredProp('domain-url', e.target.value)}
                  value={this.state.domain}
                  // autoComplete="on"
                />
              </Form.Item>
              <Form.Item
                label="Username"
                name="username"
                rules={[
                  { required: true, message: 'Please enter your username' },
                ]}
              >
                <Input
                  onChange={(e) => {
                    this.setState({ email: e.target.value })
                  }}
                  value={this.state.email}
                  // autoComplete="on"
                />
              </Form.Item>
              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: 'Please enter your password' },
                ]}
              >
                <Input
                  type="password"
                  onChange={(e) => {
                    this.setState({ password: e.target.value })
                  }}
                  value={this.state.password}
                  // autoComplete="on"
                />
              </Form.Item>
            </>
          )}
          <Form.Item {...tailLayout}>
            <Button
              type="primary"
              htmlType="submit"
              loading={this.state.isAuthenticating}
            >
              Authenticate
            </Button>
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button type="default" onClick={this.logoutUser}>
              Log Out
            </Button>
          </Form.Item>
        </Form>
      </Fragment>
    )
  }

  renderPropOptions = () => {
    return (
      <div>
        <h1>Authentication</h1>
        <Switch
          checkedChildren="Q&amp;A ON"
          unCheckedChildren="Q&amp;A OFF"
          onChange={(checked) => {
            this.setState({ isQandA: checked }, () => {
              this.setState({
                isAuthenticated: false,
                dashboardTiles: undefined,
              })
              setStoredProp('loginToken', undefined)
              setStoredProp('jwtToken', undefined)
              this.reloadDataMessenger()
            })
          }}
        />
        {this.renderAuthenticationForm()}
        {this.createBooleanRadioGroup('Show UI Overlay', 'uiOverlay', [
          true,
          false,
        ])}
        <h1>Customize Widgets</h1>
        <Button
          onClick={this.reloadDataMessenger}
          style={{ marginRight: '10px' }}
          icon={<ReloadOutlined />}
        >
          Reload Data Messenger
        </Button>
        <Button
          onClick={() => this.setState({ isVisible: true })}
          type="primary"
          icon={<MenuFoldOutlined />}
        >
          Open Data Messenger
        </Button>
        <h2>AutoQL API Configuration Options</h2>
        {this.createBooleanRadioGroup(
          'Enable Autocomplete',
          'enableAutocomplete',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Filter Locking',
          'enableFilterLocking',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Query Interpretation',
          'enableQueryInterpretation',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Query Validation',
          'enableQueryValidation',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Query Suggestions',
          'enableQuerySuggestions',
          [true, false]
        )}
        {this.createBooleanRadioGroup('Enable Drilldowns', 'enableDrilldowns', [
          true,
          false,
        ])}
        {this.createBooleanRadioGroup(
          'Enable Column Visibility Editor',
          'enableColumnVisibilityManager',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Notifications',
          'enableNotifications',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Slack Sharing',
          'enableSlackSharing',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable MS Teams Sharing',
          'enableTeamsSharing',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable CSV Download',
          'enableCSVDownload',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Debug Mode - Show copy to SQL button in message toolbar',
          'debug',
          [true, false]
        )}
        {!isProd() &&
          this.createBooleanRadioGroup(
            'Test Mode (Provides extra logging on the server side)',
            'test',
            [true, false]
          )}
        <h2>UI Configuration Options</h2>
        {this.createBooleanRadioGroup(
          'Show Data Messenger Button',
          'showHandle',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Shift Screen on Open/Close',
          'shiftScreen',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Darken Background Behind Data Messenger',
          'showMask',
          [true, false]
        )}
        {this.createRadioInputGroup('Theme', 'theme', ['light', 'dark'])}
        {this.createRadioInputGroup('Data Messenger Placement', 'placement', [
          'top',
          'bottom',
          'left',
          'right',
        ])}
        {this.createRadioInputGroup(
          'Default Tab',
          'defaultTab',
          ['data-messenger', 'explore-queries'],
          true
        )}
        {this.createBooleanRadioGroup(
          'Auto-Chart Aggregation queries',
          'autoChartAggregations',
          [true, false]
        )}
        <h4>Currency Code</h4>
        <Input
          type="text"
          onBlur={(e) => {
            this.setState({ currencyCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.currencyCode}
        />
        <h4>Language Code</h4>
        <Input
          type="text"
          onBlur={(e) => {
            this.setState({ languageCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.languageCode}
        />
        <h4>Format for Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href="https://devhints.io/moment" target="_blank" rel="noopener noreferrer">
            View the cheat sheet
          </a>
        </h6>
        <Input
          type="text"
          onBlur={(e) => {
            this.setState({ monthFormat: e.target.value })
          }}
          defaultValue={this.state.monthFormat}
        />
        <h4>Format for Day, Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href="https://devhints.io/moment" target="_blank"  rel="noopener noreferrer">
            View the cheat sheet
          </a>
        </h6>

        <Input
          type="text"
          onBlur={(e) => {
            this.setState({ dayFormat: e.target.value })
          }}
          defaultValue={this.state.dayFormat}
        />
        <h4>Number of Decimals for Currency Values</h4>
        <InputNumber
          type="number"
          onChange={(e) => {
            this.setState({ currencyDecimals: e })
          }}
          value={this.state.currencyDecimals}
        />
        <h4>Number of Decimals for Quantity Values</h4>
        <InputNumber
          type="number"
          onChange={(e) => {
            this.setState({ quantityDecimals: e })
          }}
          value={this.state.quantityDecimals}
        />
        <h4>User Display Name</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ userDisplayName: e.target.value })
          }}
          value={this.state.userDisplayName}
        />
        <h4>Intro Message</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ introMessage: e.target.value })
          }}
          value={this.state.introMessage}
        />
        <h4>Query Input Placeholder</h4>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ inputPlaceholder: e.target.value })
          }}
          value={this.state.inputPlaceholder}
        />
        {this.createBooleanRadioGroup(
          'Clear All Messages on Close',
          'clearOnClose',
          [true, false]
        )}
        <h4>Height</h4>
        <h5>Only for top/bottom placement</h5>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <InputNumber
          // type="number"
          onChange={(e) => {
            this.setState({ height: e })
          }}
          value={this.state.height}
        />
        <h4>Width</h4>
        <h5>Only for left/right placement</h5>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <InputNumber
          type="number"
          onChange={(e) => {
            this.setState({ width: e })
          }}
          value={this.state.width}
        />
        <h4>Title</h4>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ title: e.target.value })
          }}
          value={this.state.title}
        />
        <h4>Font Family</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ fontFamily: e.target.value })
          }}
          value={this.state.fontFamily}
        />
        <h4>Chart Colors</h4>
        <h5>
          This is an array of colors used for the charts. If the data scale is
          larger than the color array, it will repeat the colors. Any solid
          color formats are accepted. Hit "enter" to add a color.
        </h5>
        {this.renderChartColorsList()}
        {this.createBooleanRadioGroup(
          'Enable Dynamic Charting',
          'enableDynamicCharting',
          [true, false]
        )}
        <h4>Dashboard Title Color</h4>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ dashboardTitleColor: e.target.value })
          }}
          value={this.state.dashboardTitleColor}
        />
        <h4>Dashboard Background Color</h4>
        <Input
          type="text"
          onChange={(e) => {
            this.setState({ dashboardBackground: e.target.value })
          }}
          value={this.state.dashboardBackground}
        />
        <h4>Light Theme Accent Color</h4>
        <h5>
          For production version, the user will just choose "accentColor" and it
          <br />
          will be applied to whatever theme. If not provided, the default color
          <br />
          will be used
        </h5>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type="color"
          onChange={(e) => {
            this.setState({ lightAccentColor: e.target.value })
          }}
          value={this.state.lightAccentColor}
        />
        <h4>Dark Theme Accent Color</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type="color"
          onChange={(e) => {
            this.setState({ darkAccentColor: e.target.value })
          }}
          value={this.state.darkAccentColor}
        />
        <h4>Maximum Number of Messages</h4>
        <InputNumber
          type="number"
          onChange={(e) => {
            this.setState({ maxMessages: e })
          }}
          value={this.state.maxMessages}
        />
        {this.createBooleanRadioGroup(
          'Enable Explore Queries Tab',
          'enableExploreQueriesTab',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Notifications Tab',
          'enableNotificationsTab',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Speech to Text',
          'enableVoiceRecord',
          [true, false]
        )}
      </div>
    )
  }

  renderDataMessenger = () => {
    return (
      <DataMessenger
        className={`${this.state.activeIntegrator}`}
        authentication={this.getAuthProp()}
        autoQLConfig={this.getAutoQLConfigProp()}
        dataFormatting={this.getDataFormattingProp()}
        themeConfig={this.getThemeConfigProp()}
        key={this.state.componentKey}
        AutoAEId={this.state.componentKey}
        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }
        onMaskClick={() => this.setState({ isVisible: false })}
        showHandle={this.state.showHandle}
        placement={
          this.state.currentPage === 'drawer' ||
          this.state.currentPage === 'dashboard' ||
          this.state.currentPage === 'speech'
            ? this.state.placement
            : 'bottom'
        }
        userDisplayName={this.state.userDisplayName}
        introMessage={this.state.introMessage}
        showMask={this.state.showMask}
        shiftScreen={this.state.shiftScreen}
        enableVoiceRecord={this.state.enableVoiceRecord}
        clearOnClose={this.state.clearOnClose}
        width={this.state.width}
        height={this.state.height}
        title={this.state.title}
        maxMessages={this.state.maxMessages}
        enableExploreQueriesTab={this.state.enableExploreQueriesTab}
        enableNotificationsTab={this.state.enableNotificationsTab}
        onErrorCallback={this.onError}
        onSuccessAlert={this.onSuccess}
        inputPlaceholder={this.state.inputPlaceholder}
        queryQuickStartTopics={this.state.topics}
        inputStyles
        handleStyles={{ right: '25px' }}
        enableDynamicCharting={this.state.enableDynamicCharting}
        onNotificationExpandCallback={this.fetchNotificationContent}
        onNotificationCollapseCallback={() => {
          this.setState({ currentNotificationContent: null })
        }}
        activeNotificationData={this.state.activeNotificationContent}
        defaultTab={this.state.defaultTab}
        autoChartAggregations={this.state.autoChartAggregations}
      />
    )
  }

  renderDataMessengerPage = () => {
    return <div className="test-page-container">{this.renderPropOptions()}</div>
  }

  renderQueryInputPage = () => {
    return (
      <div>
        <QueryInput
          authentication={this.getAuthProp()}
          autoQLConfig={this.getAutoQLConfigProp()}
          dataFormatting={this.getDataFormattingProp()}
          themeConfig={this.getThemeConfigProp()}
          ref={(r) => (this.queryInputRef = r)}
          autoCompletePlacement="below"
          onSubmit={() => this.setState({ response: null })}
          onResponseCallback={(response) => {
            this.setState({ response })
          }}
          showChataIcon
          showLoadingDots
        />
        {this.state.response && (
          <div
            style={{
              // height: 'auto',
              // minHeight: '100px',
              height: 'calc(100vh - 120px)',
              overflow: 'hidden',
              padding: '20px',
              paddingTop: '0',
              fontFamily: 'Helvetica, Arial, Sans-Serif', // Text, tables, and charts will inherit font
              color: '#565656', // Text, tables, and charts will inherit text color
            }}
          >
            <QueryOutput
              authentication={this.getAuthProp()}
              themeConfig={this.getThemeConfigProp()}
              queryInputRef={this.queryInputRef}
              queryResponse={this.state.response}
            />
          </div>
        )}
      </div>
    )
  }

  handleDashboardSelect = (value) => {
    if (value === 'new-dashboard') {
      this.setState({ isNewDashboardModalOpen: true })
    } else {
      const newDashboard = this.state.dashboardsList.find(
        (dashboard) => dashboard.id === value
      )

      this.setState({
        activeDashboardId: value,
        dashboardTiles: newDashboard.data,
      })
    }
  }

  renderConfirmDeleteDashboardModal = () => {
    return Modal.confirm({
      icon: <ExclamationCircleOutlined />,
      okText: 'Delete Dashboard',
      okType: 'danger',
      onOk: this.deleteDashboard,
      okButtonProps: { ghost: true },
      onCancel: () => this.setState({ isDeleteDashboardModalVisible: false }),
      title: 'Are you sure you want to delete this Dashboard?',
    })
  }

  renderDashboardPage = () => {
    if (this.state.isFetchingDashboard) {
      return <Spin />
    }

    return (
      <div
        className="dashboard-container"
        style={{
          width: '100%',
          height: 'auto',
          minHeight: 'calc(100vh - 185px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {this.renderNewDashboardModal()}
        {this.state.activeDashboardId ? (
          <Fragment>
            <div
              className="dashboard-toolbar-container"
              style={{
                textAlign: 'center',
                background: this.state.dashboardBackground,
                padding: '10px',
              }}
            >
              <div>
                <Select
                  style={{ minWidth: '200px' }}
                  onChange={this.handleDashboardSelect}
                  value={this.state.activeDashboardId}
                >
                  {this.state.dashboardsList &&
                    this.state.dashboardsList.map((dashboard) => {
                      return (
                        <Select.Option
                          value={dashboard.id}
                          key={`dashboard-option-${dashboard.id}`}
                        >
                          {dashboard.name}
                        </Select.Option>
                      )
                    })}
                  <Select.Option value="new-dashboard">
                    <PlusOutlined /> New Dashboard
                  </Select.Option>
                </Select>
              </div>
              <Button
                onClick={() =>
                  this.setState({ isEditing: !this.state.isEditing })
                }
                icon={
                  this.state.isEditing ? <StopOutlined /> : <EditOutlined />
                }
              >
                {this.state.isEditing ? 'Cancel' : 'Edit'}
              </Button>
              <Button
                onClick={() => executeDashboard(this.dashboardRef)}
                icon={<PlayCircleOutlined />}
                style={{ marginLeft: '10px' }}
              >
                Execute
              </Button>
              <Button
                onClick={() => unExecuteDashboard(this.dashboardRef)}
                icon={<PlayCircleOutlined />}
                style={{ marginLeft: '10px' }}
              >
                Un-Execute
              </Button>
              <Button
                onClick={() => console.log(this.state.dashboardTiles)}
                style={{ marginLeft: '10px' }}
              >
                Log Current Tile State
              </Button>

              <br />
              {this.state.isEditing && (
                <Button
                  onClick={() =>
                    this.dashboardRef && this.dashboardRef.addTile()
                  }
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Add Tile
                </Button>
              )}
              {this.state.isEditing && (
                <Button
                  onClick={() => this.dashboardRef && this.dashboardRef.undo()}
                  type="primary"
                  icon={<RollbackOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Undo
                </Button>
              )}
              {this.state.isEditing && (
                <Button
                  onClick={this.saveDashboard}
                  loading={this.state.isSavingDashboard}
                  type="primary"
                  icon={<SaveOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Save Dashboard
                </Button>
              )}
              {
                // Keep this out for now, we risk people deleting important test dashboards
                //   this.state.isEditing && (
                //   <Button
                //     onClick={this.renderConfirmDeleteDashboardModal}
                //     loading={this.state.isDeletingDashboard}
                //     type="danger"
                //     ghost
                //     icon={<DeleteOutlined />}
                //     style={{ marginLeft: '10px' }}
                //   >
                //     Delete Dashboard
                //   </Button>
                // )
              }
            </div>

            <Dashboard
              ref={(ref) => (this.dashboardRef = ref)}
              authentication={this.getAuthProp()}
              autoQLConfig={this.getAutoQLConfigProp()}
              dataFormatting={this.getDataFormattingProp()}
              themeConfig={this.getThemeConfigProp()}
              isEditing={this.state.isEditing}
              startEditingCallback={() => this.setState({ isEditing: true })}
              executeOnMount={this.state.runDashboardAutomatically}
              executeOnStopEditing={this.state.runDashboardAutomatically}
              enableDynamicCharting={this.state.enableDynamicCharting}
              tiles={this.state.dashboardTiles}
              notExecutedText='Hit "Execute" to run this dashboard'
              onErrorCallback={this.onError}
              onSuccessCallback={this.onSuccess}
              autoChartAggregations={this.state.autoChartAggregations}
              onChange={(newTiles) => {
                this.setState({ dashboardTiles: newTiles })
              }}
            />
          </Fragment>
        ) : (
          <div style={{ marginTop: '100px', textAlign: 'center' }}>
            <Button
              type="primary"
              onClick={() => this.setState({ isNewDashboardModalOpen: true })}
            >
              Create a new Dashboard
            </Button>
          </div>
        )}
      </div>
    )
  }

  renderNavMenu = () => {
    return (
      <Menu
        onClick={({ key }) => {
          this.setState({ currentPage: key })
          this.resetDashboard()
          if (key === 'notifications' && this.notificationBadgeRef) {
            this.notificationBadgeRef.resetCount()
          }
        }}
        selectedKeys={[this.state.currentPage]}
        mode="horizontal"
      >
        <Menu.Item key="drawer">
          <ChataIcon type="react-autoql-bubbles-outlined" />
          Data Messenger
        </Menu.Item>

        {this.state.isAuthenticated && !this.state.isQandA && (
          <Menu.Item key="dashboard">
            <ChataIcon type="dashboard" /> Dashboard
          </Menu.Item>
        )}
        {/* Comment out for now
        {this.state.isAuthenticated && (
          <Menu.Item key="chatbar">QueryInput / QueryOutput</Menu.Item>
        )} */}
        {!this.state.isQandA && <Menu.Item key="reviews">Reviews</Menu.Item>}

        {!this.state.isQandA && (
          <Menu.Item key="speech">Speech Training</Menu.Item>
        )}
        {this.state.isAuthenticated &&
          this.state.enableNotifications &&
          !this.state.isQandA && (
            <Menu.Item key="settings">Data Alerts Manager</Menu.Item>
          )}
        {this.state.isAuthenticated &&
          this.state.enableNotifications &&
          !this.state.isQandA && (
            <Menu.Item key="notifications">
              <NotificationIcon
                ref={(r) => (this.notificationBadgeRef = r)}
                authentication={this.getAuthProp()}
                themeConfig={this.getThemeConfigProp()}
                clearCountOnClick={false}
                style={{ fontSize: '18px' }}
                onNewNotification={() => {
                  // If a new notification is detected, refresh the list
                  if (
                    this.notificationListRef &&
                    this.state.currentPage === 'notifications'
                  ) {
                    this.notificationListRef.refreshNotifications()
                  }
                }}
                onErrorCallback={this.onError}
              />
            </Menu.Item>
          )}
      </Menu>
    )
  }

  renderNewDashboardModal = () => {
    return (
      <Modal
        themeConfig={this.getThemeConfigProp()}
        visible={this.state.isNewDashboardModalOpen}
        confirmLoading={this.state.isSavingDashboard}
        onOk={this.createDashboard}
        okText="Create Dashboard"
        okButtonProps={{ disabled: !this.state.dashboardNameInput }}
        onCancel={() => this.setState({ isNewDashboardModalOpen: false })}
        title="New Dashboard"
      >
        <Input
          placeholder="Dashboard Name"
          value={this.state.dashboardNameInput}
          onChange={(e) =>
            this.setState({ dashboardNameInput: e.target.value })
          }
          onPressEnter={this.createDashboard}
        />
      </Modal>
    )
  }

  fetchNotificationContent = (notification) => {
    this.setState({
      activeNotificationContent: null,
      isFetchingNotificationContent: true,
    })

    // this.executeQuery(notification.query)
    this.fetchNotificationData(notification.id)
      .then((response) => {
        this.setState({
          activeNotificationContent: response,
          isFetchingNotificationContent: false,
        })
      })
      .catch((error) => {
        this.setState({
          activeNotificationContent: {
            error: 'Unable to find data.',
          },
          isFetchingNotificationContent: false,
        })
      })
    // .finally(response => {
    //   this.setState({
    //     activeNotificationContent: response,
    //     isFetchingNotificationContent: false
    //   })
    // })
  }

  renderNotificationContent = (notification) => {
    if (this.state.isFetchingNotificationContent) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
          }}
        >
          <Spin />
        </div>
      )
    } else if (!this.state.activeNotificationContent) {
      return 'No data available'
    } else if (this.state.activeNotificationContent.error) {
      return this.state.activeNotificationContent.error
    }

    return (
      <QueryOutput
        authentication={this.getAuthProp()}
        themeConfig={this.getThemeConfigProp()}
        queryResponse={this.state.activeNotificationContent}
        displayType="table"
      />
    )
  }

  renderNotificationsPage = () => {
    return (
      <div
        style={{
          height: 'calc(100vh - 48px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto',
        }}
      >
        <NotificationFeed
          ref={(ref) => (this.notificationListRef = ref)}
          authentication={this.getAuthProp()}
          themeConfig={this.getThemeConfigProp()}
          onExpandCallback={this.fetchNotificationContent}
          autoChartAggregations={this.state.autoChartAggregations}
          showCreateAlertBtn={true}
          onCollapseCallback={() => {
            this.setState({ currentNotificationContent: null })
          }}
          activeNotificationData={this.state.activeNotificationContent}
          onErrorCallback={this.onError}
          onSuccessCallback={this.onSuccess}
        />
      </div>
    )
  }

  renderSettingsPage = () => {
    return (
      <div
        style={{
          height: 'calc(100vh - 48px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto',
        }}
      >
        <DataAlerts
          authentication={this.getAuthProp()}
          themeConfig={this.getThemeConfigProp()}
          onErrorCallback={this.onError}
          showCreateAlertBtn
        />
      </div>
    )
  }

  renderUIOverlay = () => {
    if (this.state.isQandA && this.state.uiOverlay)
      switch (this.state.projectId) {
        case 'eq_bank':
          return <div className="ui-overlay theme-radisson" />
        case 'radisson':
          return <div className="ui-overlay theme-radisson" />
        case 'texas':
          return <div className="ui-overlay theme-texas" />
        case 'stifel':
          return <div className="ui-overlay theme-stifel" />
        case 'city_of_calgary':
          return <div className="ui-overlay theme-city-of-calgary" />
        case 'wyndham':
          return <div className="ui-overlay theme-wyndham" />
        case 'uceed':
          return <div className="ui-overlay theme-uceed" />
        case 'deeleeo':
          return <div className="ui-overlay theme-deeleeo" />
        case 'opm':
          return <div className="ui-overlay theme-opm" />
        case 'us_army':
          return <div className="ui-overlay theme-us-army" />
        case 'brp':
          return <div className="ui-overlay theme-brp" />
        case 'chata':
          return <div className="ui-overlay theme-chata" />
        default:
          return <div />
      }

    if (!this.state.isAuthenticated) {
      return null
    }

    // Only render overlay if drawer is active and prop is enabled
    if (!this.state.uiOverlay || this.state.currentPage !== 'drawer') {
      return null
    }

    // Accounting demo
    if (this.state.activeIntegrator === 'demo') {
      return <div className="ui-overlay demo" />
    }
  }

  renderMaintenancePage = () => (
    <div
      style={{
        margin: '0 auto',
        width: '300px',
        textAlign: 'center',
        paddingTop: '111px',
      }}
    >
      <ToolOutlined style={{ fontSize: '75px', marginBottom: '20px' }} />
      <br />
      <div style={{ fontSize: '25px' }}>
        We're undergoing a bit of scheduled maintenance.
      </div>
      <hr style={{ margin: '25px 0px' }} />
      <div>
        Sorry for the inconvenience. We will be back up and running as soon as
        possible.
      </div>
    </div>
  )

  render = () => {
    if (this.state.maintenance) {
      return this.renderMaintenancePage()
    }

    const { currentPage } = this.state

    let pageToRender = null
    switch (currentPage) {
      case 'drawer': {
        pageToRender = this.renderDataMessengerPage()
        break
      }
      case 'chatbar': {
        pageToRender = this.renderQueryInputPage()
        break
      }
      case 'reviews': {
        pageToRender = <SentimentAnalysisPage />
        break
      }
      case 'speech': {
        pageToRender = (
          <SpeechToTextPage
            authentication={this.getAuthProp()}
            themeConfig={this.getThemeConfigProp()}
            userEmail={this.state.displayName}
            projectID={this.state.projectId}
          />
        )
        break
      }
      case 'dashboard': {
        pageToRender = this.renderDashboardPage()
        break
      }
      case 'notifications': {
        pageToRender = this.renderNotificationsPage()
        break
      }
      case 'settings': {
        pageToRender = this.renderSettingsPage()
        break
      }
      default: {
        break
      }
    }

    return (
      <div>
        {this.renderUIOverlay()}
        {this.renderNavMenu()}
        {this.renderDataMessenger()}
        {pageToRender}
      </div>
    )
  }
}
