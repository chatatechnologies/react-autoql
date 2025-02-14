import React, { Component, Fragment } from 'react'
import axios from 'axios'
import { get, sortBy, isEqual, cloneDeep } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import {
  DataMessenger,
  QueryOutput,
  QueryInput,
  Dashboard,
  NotificationIcon,
  NotificationFeed,
  DataAlerts,
  Icon as ChataIcon,
  configureTheme,
  VizToolbar,
} from 'react-autoql'

import { sortable } from 'react-sortable'

import { Radio, Input, InputNumber, Switch, Button, Menu, Form, message, Modal, Spin, Select } from 'antd'

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
  return isProd() ? 'https://backend.chata.io' : 'https://backend-staging.chata.io'
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
        {this.props.item}
      </li>
    )
  }
}

const SortableItem = sortable(Item)

export default class App extends Component {
  authTimer = undefined

  state = {
    maintenance: false,
    currentPage: 'drawer',
    isNewDashboardModalOpen: false,
    componentKey: uuidv4(),
    placement: 'right',
    showHandle: true,
    theme: 'light',
    response: undefined,
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
    enableExploreQueriesTab: false,
    enableDataExplorerTab: true,
    enableNotificationsTab: true,
    enableNotifications: true,
    enableColumnVisibilityManager: true,
    enableVoiceRecord: true,
    enableCSVDownload: true,
    dashboardTitleColor: 'rgb(72, 105, 142)',
    clearOnClose: false,
    height: '100vh',
    width: 550,
    title: 'Data Messenger',
    accentTextColor: '#ffffff',
    lightAccentColor: '#26a7df',
    darkAccentColor: '#26a7df',
    maxMessages: 20,
    isEditing: false,
    debug: 'exclude',
    test: !isProd(),
    demo: getStoredProp('demo') === 'true',
    apiKey: getStoredProp('api-key') || '',
    domain: getStoredProp('domain-url') || '',
    dprKey: getStoredProp('dpr-key') || '',
    dprDomain: getStoredProp('dpr-domain') || '',
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
    this.setTheme()
    this.testAuthentication()
      .then(() => {
        this.fetchDashboards()
      })
      .catch(() => {
        this.logoutUser()
      })
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      !isEqual(this.state.chartColors !== prevState.chartColors) ||
      prevState.lightAccentColor !== this.state.lightAccentColor ||
      prevState.darkAccentColor !== this.state.darkAccentColor ||
      prevState.accentTextColor !== this.state.accentTextColor ||
      prevState.dashboardTitleColor !== this.state.dashboardTitleColor
    ) {
      this.setTheme()
    }
  }

  componentWillUnmount = () => {
    if (this.authTimer) {
      clearTimeout(this.authTimer)
    }
  }

  getAuthProp = () => {
    return {
      token: getStoredProp('jwtToken'),
      apiKey: this.state.apiKey,
      domain: this.state.domain,
      dprKey: this.state.dprKey,
      dprDomain: this.state.dprDomain,
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

  setTheme = () => {
    let lightAccentColor = this.state.lightAccentColor
    let darkAccentColor = this.state.darkAccentColor
    let accentTextColor = this.state.accentTextColor
    let chartColors = [...this.state.chartColors]
    let dashboardTitleColor = this.state.dashboardTitleColor

    const theme = {
      theme: this.state.theme,
      accentColor: this.state.theme === 'light' ? lightAccentColor : darkAccentColor,
      accentTextColor: accentTextColor,
      fontFamily: this.state.fontFamily,
      chartColors,
      dashboardTitleColor,
    }

    configureTheme(theme)

    if (!this.state.hasSetTheme) {
      this.setState({ hasSetTheme: true })
    }
  }

  testAuthentication = () => {
    const url = `${this.state.domain}/autoql/api/v1/query/validate?text=sales&key=${this.state.apiKey}`
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
        componentKey: uuidv4(),
      })
      return Promise.reject()
    }

    return axios
      .get(url, config)
      .then(() => {
        this.setState({
          isAuthenticated: true,
          activeIntegrator: this.getActiveIntegrator(),
          componentKey: uuidv4(),
        })
        return Promise.resolve()
      })
      .catch((error) => {
        this.setState({
          isAuthenticated: false,
          activeIntegrator: undefined,
          componentKey: uuidv4(),
        })
        return Promise.reject(error)
      })
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
        if (get(dashboardResponse, 'data.items.length')) {
          dashboardsList = sortBy(dashboardResponse.data.items, (dashboard) => {
            return new Date(dashboard.created_at)
          })
          dashboardTiles = get(dashboardsList, '[0].data')
          activeDashboardId = get(dashboardsList, '[0].id')
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
            componentKey: uuidv4(),
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
    try {
      this.setState({
        isAuthenticating: true,
      })
      const baseUrl = getBaseUrl()

      // Login to get login token
      const loginFormData = new FormData()
      loginFormData.append('username', this.state.email)
      loginFormData.append('password', this.state.password)
      const loginResponse = await axios.post(`${baseUrl}/api/v1/login`, loginFormData)

      // Put login token in local storage
      const loginToken = loginResponse.data
      setStoredProp('loginToken', loginToken)

      await this.getJWT(loginToken)

      message.success('Login Sucessful!', 0.8)
      this.fetchDashboards()
    } catch (error) {
      console.error(error)
      // Clear tokens
      setStoredProp('loginToken', null)
      setStoredProp('jwtToken', null)
      this.setState({
        isAuthenticated: false,
        isAuthenticating: false,
        activeIntegrator: null,
        componentKey: uuidv4(),
      })

      // Dont fetch dashboard if authentication failed...
      message.error('Invalid Credentials')
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
          buttonStyle='solid'
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
    this.setState({ componentKey: uuidv4() })
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
        (dashboard) => dashboard.id !== this.state.activeDashboardId,
      )
      const newActiveDashboardId = newDashboardsList[0] ? newDashboardsList[0].id : undefined
      const newDashboardTiles = newDashboardsList[0] ? newDashboardsList[0].data : undefined

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
      const index = this.state.dashboardsList.findIndex((dashboard) => dashboard.id === this.state.activeDashboardId)
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

      const newDashboardsList = cloneDeep(this.state.dashboardsList)
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
        <SortableItem key={i} onSortItems={this.onSortChartColors} items={chartColors} item={item} sortId={i}>
          {item}
          <CloseOutlined
            style={{ float: 'right', cursor: 'pointer', marginTop: '3px' }}
            onClick={() => {
              const newChartColors = this.state.chartColors.filter((color) => color !== item)
              this.setState({ chartColors: newChartColors })
            }}
          />
        </SortableItem>
      )
    })

    return (
      <div>
        <ul style={{ padding: 0, marginBottom: '3px' }} className='sortable-list'>
          {listItems}
        </ul>
        <Input
          placeholder='New Color'
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
      <>
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
          onFinishFailed={(errorInfo) => console.error('Failed:', errorInfo)}
        >
          <Form.Item
            label='Project ID'
            name='projectId'
            rules={[{ required: true, message: 'Please enter your project ID' }]}
          >
            <Input
              name='customer-id'
              onChange={(e) => {
                this.setState({ projectId: e.target.value })
              }}
              onBlur={(e) => setStoredProp('customer-id', e.target.value)}
              value={this.state.projectId}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='User Email'
            name='displayName'
            rules={[{ required: true, message: 'Please enter your email' }]}
          >
            <Input
              name='user-id'
              onChange={(e) => {
                this.setState({ displayName: e.target.value })
              }}
              onBlur={(e) => setStoredProp('user-id', e.target.value)}
              value={this.state.displayName}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item label='API key' name='apiKey' rules={[{ required: true, message: 'Please enter your API key' }]}>
            <Input
              name='api-key'
              onChange={(e) => {
                this.setState({ apiKey: e.target.value })
              }}
              onBlur={(e) => setStoredProp('api-key', e.target.value)}
              value={this.state.apiKey}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='Domain URL'
            name='domain'
            rules={[{ required: true, message: 'Please enter your domain URL' }]}
          >
            <Input
              name='domain-url'
              onChange={(e) => {
                this.setState({ domain: e.target.value })
              }}
              onBlur={(e) => setStoredProp('domain-url', e.target.value)}
              value={this.state.domain}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='Username'
            name='username'
            rules={[{ required: true, message: 'Please enter your username' }]}
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
            label='Password'
            name='password'
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input
              type='password'
              onChange={(e) => {
                this.setState({ password: e.target.value })
              }}
              value={this.state.password}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item label='DPR API key' name='dprKey'>
            <Input
              name='dpr-key'
              onChange={(e) => {
                this.setState({ dprKey: e.target.value })
              }}
              onBlur={(e) => setStoredProp('dpr-key', e.target.value)}
              value={this.state.dprKey}
            />
          </Form.Item>
          <Form.Item label='DPR Domain' name='dprDomain'>
            <Input
              name='dpr-domain'
              onChange={(e) => {
                this.setState({ dprDomain: e.target.value })
              }}
              onBlur={(e) => setStoredProp('dpr-domain', e.target.value)}
              value={this.state.dprDomain}
            />
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button type='primary' htmlType='submit' loading={this.state.isAuthenticating}>
              Authenticate
            </Button>
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button type='default' onClick={this.logoutUser}>
              Log Out
            </Button>
          </Form.Item>
        </Form>
      </>
    )
  }

  renderPropOptions = () => {
    return (
      <div>
        {!this.state.isAuthenticated ? <div style={{ color: 'red', fontSize: '16px' }}>Please authenticate</div> : null}
        <h1>Authentication</h1>
        {this.renderAuthenticationForm()}
        <h1>Customize Widgets</h1>
        <Button onClick={this.reloadDataMessenger} style={{ marginRight: '10px' }} icon={<ReloadOutlined />}>
          Reload Data Messenger
        </Button>
        <Button onClick={this.dmRef?.open} type='primary' icon={<MenuFoldOutlined />}>
          Open Data Messenger
        </Button>
        <h2>AutoQL API Configuration Options</h2>
        {this.createBooleanRadioGroup('Enable Autocomplete', 'enableAutocomplete', [true, false])}
        {this.createBooleanRadioGroup('Enable Filter Locking', 'enableFilterLocking', [true, false])}
        {this.createBooleanRadioGroup('Enable Query Interpretation', 'enableQueryInterpretation', [true, false])}
        {this.createBooleanRadioGroup('Enable Query Validation', 'enableQueryValidation', [true, false])}
        {this.createBooleanRadioGroup('Enable Query Suggestions', 'enableQuerySuggestions', [true, false])}
        {this.createBooleanRadioGroup('Enable Drilldowns', 'enableDrilldowns', [true, false])}
        {this.createBooleanRadioGroup('Enable Column Visibility Editor', 'enableColumnVisibilityManager', [
          true,
          false,
        ])}
        {this.createBooleanRadioGroup('Enable Notifications', 'enableNotifications', [true, false])}
        {this.createBooleanRadioGroup('Enable CSV Download', 'enableCSVDownload', [true, false])}
        {this.createBooleanRadioGroup('Debug Mode - Show copy to SQL button in message toolbar', 'debug', [
          'include',
          'exclude',
        ])}
        {!isProd() &&
          this.createBooleanRadioGroup('Test Mode (Provides extra logging on the server side)', 'test', [true, false])}
        <h2>UI Configuration Options</h2>
        {this.createBooleanRadioGroup('Show Data Messenger Button', 'showHandle', [true, false])}
        {this.createBooleanRadioGroup('Shift Screen on Open/Close', 'shiftScreen', [true, false])}
        {this.createBooleanRadioGroup('Darken Background Behind Data Messenger', 'showMask', [true, false])}
        {this.createRadioInputGroup('Theme', 'theme', ['light', 'dark'])}
        {this.createRadioInputGroup('Data Messenger Placement', 'placement', ['top', 'bottom', 'left', 'right'])}
        {this.createRadioInputGroup('Default Tab', 'defaultTab', ['data-messenger', 'explore-queries'], true)}
        {this.createBooleanRadioGroup('Auto-Chart Aggregation queries', 'autoChartAggregations', [true, false])}
        <h4>Currency Code</h4>
        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ currencyCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.currencyCode}
        />
        <h4>Language Code</h4>
        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ languageCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.languageCode}
        />
        <h4>Format for Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href='https://devhints.io/moment' target='_blank' rel='noopener noreferrer'>
            View the cheat sheet
          </a>
        </h6>
        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ monthFormat: e.target.value })
          }}
          defaultValue={this.state.monthFormat}
        />
        <h4>Format for Day, Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href='https://devhints.io/moment' target='_blank' rel='noopener noreferrer'>
            View the cheat sheet
          </a>
        </h6>

        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ dayFormat: e.target.value })
          }}
          defaultValue={this.state.dayFormat}
        />
        <h4>Number of Decimals for Currency Values</h4>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ currencyDecimals: e })
          }}
          value={this.state.currencyDecimals}
        />
        <h4>Number of Decimals for Quantity Values</h4>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ quantityDecimals: e })
          }}
          value={this.state.quantityDecimals}
        />
        <h4>User Display Name</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ userDisplayName: e.target.value })
          }}
          value={this.state.userDisplayName}
        />
        <h4>Intro Message</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ introMessage: e.target.value })
          }}
          value={this.state.introMessage}
        />
        <h4>Query Input Placeholder</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ inputPlaceholder: e.target.value })
          }}
          value={this.state.inputPlaceholder}
        />
        <h4>Query Input Value</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ inputValue: e.target.value })
          }}
          value={this.state.inputValue}
        />
        {this.createBooleanRadioGroup('Clear All Messages on Close', 'clearOnClose', [true, false])}
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
          type='number'
          onChange={(e) => {
            this.setState({ width: e })
          }}
          value={this.state.width}
        />
        <h4>Title</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ title: e.target.value })
          }}
          value={this.state.title}
        />
        <h4>Font Family</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ fontFamily: e.target.value })
          }}
          value={this.state.fontFamily}
        />
        <h4>Chart Colors</h4>
        <h5>
          This is an array of colors used for the charts. If the data scale is larger than the color array, it will
          repeat the colors. Any solid color formats are accepted. Hit "enter" to add a color.
        </h5>
        {this.renderChartColorsList()}
        {this.createBooleanRadioGroup('Enable Dynamic Charting', 'enableDynamicCharting', [true, false])}
        <h4>Dashboard Title Color</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ dashboardTitleColor: e.target.value })
          }}
          value={this.state.dashboardTitleColor}
        />
        <h4>Text/Icon Color</h4>
        <Input
          type='color'
          onChange={(e) => {
            this.setState({ accentTextColor: e.target.value })
          }}
          value={this.state.accentTextColor}
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
          type='color'
          onChange={(e) => {
            this.setState({ lightAccentColor: e.target.value })
          }}
          value={this.state.lightAccentColor}
        />
        <h4>Dark Theme Accent Color</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='color'
          onChange={(e) => {
            this.setState({ darkAccentColor: e.target.value })
          }}
          value={this.state.darkAccentColor}
        />
        <h4>Maximum Number of Messages</h4>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ maxMessages: e })
          }}
          value={this.state.maxMessages}
        />
        {this.createBooleanRadioGroup('Enable Explore Queries Tab', 'enableExploreQueriesTab', [true, false])}
        {this.createBooleanRadioGroup('Enable Data Explorer Tab', 'enableDataExplorerTab', [true, false])}
        {this.createBooleanRadioGroup('Enable Notifications Tab', 'enableNotificationsTab', [true, false])}
        {this.createBooleanRadioGroup('Enable Speech to Text', 'enableVoiceRecord', [true, false])}
      </div>
    )
  }

  renderDataMessenger = () => {
    return (
      <DataMessenger
        ref={(r) => (this.dmRef = r)}
        inputValue={this.state.inputValue}
        className={`${this.state.activeIntegrator}`}
        enableDPRTab={!!this.state.dprKey}
        authentication={this.getAuthProp()}
        autoQLConfig={this.getAutoQLConfigProp()}
        dataFormatting={this.getDataFormattingProp()}
        key={this.state.componentKey}
        AutoAEId={this.state.componentKey}
        maskClosable
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
        enableDataExplorerTab={this.state.enableDataExplorerTab}
        enableNotificationsTab={this.state.enableNotificationsTab}
        onErrorCallback={this.onError}
        onSuccessAlert={this.onSuccess}
        inputPlaceholder={this.state.inputPlaceholder}
        inputStyles
        handleStyles={{ right: '25px' }}
        enableDynamicCharting={this.state.enableDynamicCharting}
        defaultTab={this.state.defaultTab}
        autoChartAggregations={this.state.autoChartAggregations}
        enableQueryQuickStartTopics={true}
      />
    )
  }

  renderDataMessengerPage = () => {
    if (!this.state.hasSetTheme) {
      return null
    }

    return <div className='test-page-container'>{this.renderPropOptions()}</div>
  }

  renderQueryInputPage = () => {
    if (!this.state.hasSetTheme) {
      return null
    }

    return (
      <div>
        <QueryInput
          authentication={this.getAuthProp()}
          autoQLConfig={this.getAutoQLConfigProp()}
          dataFormatting={this.getDataFormattingProp()}
          ref={(r) => (this.queryInputRef = r)}
          autoCompletePlacement='below'
          clearQueryOnSubmit={false}
          onSubmit={() => this.setState({ response: null })}
          onResponseCallback={(response) => {
            this.setState({ response })
          }}
          showChataIcon
          showLoadingDots
        />
        <Button
          onClick={() => {
            if (this.queryOutputRef?.refreshLayout) {
              this.queryOutputRef.refreshLayout()
            }
          }}
        >
          Resize Chart
        </Button>
        <VizToolbar ref={(r) => (this.vizToolbarRef = r)} responseRef={this.queryOutputRef} />
        {this.state.response && (
          <div
            style={{
              height: 'calc(100vh - 140px)',
              overflow: 'hidden',
              fontFamily: 'Helvetica, Arial, Sans-Serif', // Text, tables, and charts will inherit font
              color: '#565656', // Text, tables, and charts will inherit text color
            }}
          >
            <QueryOutput
              ref={(r) => (this.queryOutputRef = r)}
              vizToolbarRef={this.vizToolbarRef}
              authentication={this.getAuthProp()}
              autoQLConfig={this.getAutoQLConfigProp()}
              dataFormatting={this.getDataFormattingProp()}
              queryInputRef={this.queryInputRef}
              queryResponse={this.state.response}
              initialDisplayType='table'
              autoChartAggregations={true}
              enableDynamicCharting={true}
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
      const newDashboard = this.state.dashboardsList.find((dashboard) => dashboard.id === value)

      this.setState({
        activeDashboardId: value,
        dashboardTiles: newDashboard.data,
      })
    }
  }

  handleTileChange = (newTiles) => {
    this.setState({ dashboardTiles: newTiles })
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

  setIsEditing = () => {
    this.setState({ isEditing: true })
  }

  openNewDashboardModal = () => this.setState({ isNewDashboardModalOpen: true })

  renderDashboardPage = () => {
    if (this.state.isFetchingDashboard || !this.state.hasSetTheme) {
      return <Spin />
    }

    return (
      <div
        className='dashboard-container'
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
          <>
            <div
              className='dashboard-toolbar-container'
              style={{
                textAlign: 'center',
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
                        <Select.Option value={dashboard.id} key={`dashboard-option-${dashboard.id}`}>
                          {dashboard.name}
                        </Select.Option>
                      )
                    })}
                  <Select.Option value='new-dashboard'>
                    <PlusOutlined /> New Dashboard
                  </Select.Option>
                </Select>
              </div>
              <Button
                onClick={() => this.setState({ isEditing: !this.state.isEditing })}
                icon={this.state.isEditing ? <StopOutlined /> : <EditOutlined />}
              >
                {this.state.isEditing ? 'Cancel' : 'Edit'}
              </Button>
              <Button
                onClick={() => this.dashboardRef?.executeDashboard()}
                icon={<PlayCircleOutlined />}
                style={{ marginLeft: '10px' }}
              >
                Execute
              </Button>
              <Button
                onClick={() => this.dashboardRef?.unExecuteDashboard()}
                icon={<PlayCircleOutlined />}
                style={{ marginLeft: '10px' }}
              >
                Un-Execute
              </Button>
              <br />
              {this.state.isEditing && (
                <Button
                  onClick={() => this.dashboardRef && this.dashboardRef.addTile()}
                  type='primary'
                  icon={<PlusOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Add Tile
                </Button>
              )}
              {this.state.isEditing && (
                <Button
                  onClick={() => this.dashboardRef && this.dashboardRef.undo()}
                  type='primary'
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
                  type='primary'
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
              key={this.state.activeDashboardId}
              authentication={this.getAuthProp()}
              autoQLConfig={this.getAutoQLConfigProp()}
              dataFormatting={this.getDataFormattingProp()}
              isEditing={this.state.isEditing}
              startEditingCallback={this.setIsEditing}
              executeOnMount={this.state.runDashboardAutomatically}
              executeOnStopEditing={this.state.runDashboardAutomatically}
              enableDynamicCharting={this.state.enableDynamicCharting}
              tiles={this.state.dashboardTiles}
              notExecutedText='Hit "Execute" to run this dashboard'
              onErrorCallback={this.onError}
              onSuccessCallback={this.onSuccess}
              autoChartAggregations={this.state.autoChartAggregations}
              onChange={this.handleTileChange}
            />
          </>
        ) : (
          <div style={{ marginTop: '100px', textAlign: 'center' }}>
            <Button type='primary' onClick={this.openNewDashboardModal}>
              Create a new Dashboard
            </Button>
          </div>
        )}
      </div>
    )
  }

  renderNavMenu = () => {
    const items = [
      {
        label: (
          <span>
            <ChataIcon type='react-autoql-bubbles-outlined' /> Data Messenger
          </span>
        ),
        key: 'drawer',
      },
    ]

    if (this.state.isAuthenticated) {
      items.push({
        label: (
          <span>
            <ChataIcon type='dashboard' /> Dashboard
          </span>
        ),
        key: 'dashboard',
      })
      items.push({ label: 'QueryInput / QueryOutput', key: 'chatbar' })

      if (this.state.enableNotifications) {
        items.push({ label: 'Data Alerts Manager', key: 'settings' })
        items.push({
          label: (
            <NotificationIcon
              ref={(r) => (this.notificationBadgeRef = r)}
              authentication={this.getAuthProp()}
              clearCountOnClick={false}
              style={{ fontSize: '18px' }}
              onNewNotification={() => {
                // If a new notification is detected, refresh the list
                if (this.notificationListRef && this.state.currentPage === 'notifications') {
                  this.notificationListRef.refreshNotifications()
                }
              }}
              onErrorCallback={this.onError}
            />
          ),
          key: 'notifications',
        })
      }
    }

    items.push({ label: 'Reviews', key: 'reviews' })
    items.push({ label: 'Speech Training', key: 'speech' })

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
        mode='horizontal'
        items={items}
      />
    )
  }

  renderNewDashboardModal = () => {
    return (
      <Modal
        open={this.state.isNewDashboardModalOpen}
        confirmLoading={this.state.isSavingDashboard}
        onOk={this.createDashboard}
        okText='Create Dashboard'
        okButtonProps={{ disabled: !this.state.dashboardNameInput }}
        onCancel={() => this.setState({ isNewDashboardModalOpen: false })}
        title='New Dashboard'
      >
        <Input
          placeholder='Dashboard Name'
          value={this.state.dashboardNameInput}
          onChange={(e) => this.setState({ dashboardNameInput: e.target.value })}
          onPressEnter={this.createDashboard}
        />
      </Modal>
    )
  }

  renderNotificationsPage = () => {
    if (!this.state.hasSetTheme) {
      return null
    }

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
          autoChartAggregations={this.state.autoChartAggregations}
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
          onErrorCallback={this.onError}
          onSuccessAlert={this.onSuccess}
        />
      </div>
    )
  }

  renderUIOverlay = () => {
    if (!this.state.isAuthenticated) {
      return null
    }

    // Only render overlay if drawer is active and prop is enabled
    if (!this.state.uiOverlay || this.state.currentPage !== 'drawer') {
      return null
    }

    // Accounting demo
    if (this.state.activeIntegrator === 'demo') {
      return <div className='ui-overlay demo' />
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
      <div style={{ fontSize: '25px' }}>We're undergoing a bit of scheduled maintenance.</div>
      <hr style={{ margin: '25px 0px' }} />
      <div>Sorry for the inconvenience. We will be back up and running as soon as possible.</div>
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
        {this.state.isAuthenticated && this.state.currentPage !== 'chatbar' && this.renderDataMessenger()}
        {pageToRender}
      </div>
    )
  }
}
