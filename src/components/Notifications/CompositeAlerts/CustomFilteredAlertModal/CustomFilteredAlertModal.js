import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash.isempty'
import { CUSTOM_FILTERED_ALERT_MODAL_TITLES } from '../../../../js/Constants'
import {
  getAuthentication,
  dataFormattingDefault,
  authenticationDefault,
  createManagementDataAlert,
  autoQLConfigDefault,
  getAllDataAlertsLabels,
  assignLabelToManagementDataAlert,
  previewManagementDataAlert,
  previewDataAlert,
  createDataAlert,
  updateDataAlert,
  updateManagementDataAlert,
} from 'autoql-fe-utils'

import { Icon } from '../../../Icon'
import { Modal } from '../../../Modal'
import { Button } from '../../../Button'
import { Tooltip } from '../../../Tooltip'
import { ConditionBuilder } from '../../ConditionBuilder'
import { ErrorBoundary } from '../../../../containers/ErrorHOC'
import { DataAlertDeleteDialog } from '../../DataAlertDeleteDialog'
import AppearanceSection from '../../DataAlertSettings/AppearanceSection/AppearanceSection'
import { withTheme } from '../../../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../../props/types'

import './CustomFilteredAlertModal.scss'

class CustomFilteredAlertModal extends React.Component {
  NOTIFICATION_TYPE_EVENT = 'EVENT'
  EVALUATION_MODE_COMPOSITE = 'COMPOSITE'
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.TOOLTIP_ID = `react-autoql-data-alert-modal-tooltip-${this.COMPONENT_KEY}`
    this.CONDITIONS_STEP = 'CONDITIONS'
    this.FREQUENCY_STEP = 'FREQUENCY'
    this.MESSAGE_STEP = 'MESSAGE'
    this.TYPE_STEP = 'TYPE'
    this.state = this.getInitialState(props)
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSave: PropTypes.func,
    queryResponse: PropTypes.shape({}),
    currentDataAlert: PropTypes.shape({}),
    isVisible: PropTypes.bool,
    allowDelete: PropTypes.bool,
    onClose: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    enableQueryValidation: PropTypes.bool,
    onClosed: PropTypes.func,
    onOpened: PropTypes.func,
    dataFormatting: dataFormattingType,
    autoQLConfig: autoQLConfigType,
    enableAlphaAlertSettings: PropTypes.bool,
    isPreviewMode: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onSave: () => {},
    onErrorCallback: () => {},
    currentDataAlert: undefined,
    isVisible: false,
    allowDelete: true,
    onClose: () => {},
    onSuccessAlert: () => {},
    onClosed: () => {},
    onOpened: () => {},
    enableQueryValidation: true,
    dataFormatting: dataFormattingDefault,
    autoQLConfig: autoQLConfigDefault,
    enableAlphaAlertSettings: false,
    isPreviewMode: false,
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      this.state.customFilters !== prevState.customFilters ||
      this.state.baseDataAlertColumns !== prevState.baseDataAlertColumns
    ) {
      const filteredColumns = this.state.baseDataAlertColumns.filter((col) =>
        this.state.customFilters.some((filter) => filter.column_name === col.name),
      )
      const rows = this.state.customFilters.map((filter) => [filter.value])
      this.setState({
        termValue: {
          columns: filteredColumns,
          rows: rows,
        },
      })
    }

    if (!this.props.isVisible && prevProps.isVisible) {
      setTimeout(this.initializeFields, 500)
      this.props.onClosed()
    }

    if (this.props.isVisible && !prevProps.isVisible) {
      this.initializeFields()
    }
    if (this.props?.autoQLConfig?.projectId && !this.state.fetchedCategories) {
      this.getLabels()
    }
  }

  getLabels = () => {
    if (this.props.authentication?.token && this.props.authentication?.domain && this.props.authentication?.apiKey)
    {getAllDataAlertsLabels({ ...getAuthentication(this.props.authentication) })
      .then((response) => {
        this.setState({ categories: response?.data?.data?.items, fetchedCategories: true })
      })
      .catch((error) => {
        console.error('error fetching data alert categories', error)
        this.setState({ categories: [], fetchedCategories: true })
      })}
  }

  getFilters = (props = this.props) => {
    let lockedFilters = []
    let tableFilters = []

    if (!props.queryResponse) {
      lockedFilters = props.initialData[0]?.session_filter_locks ?? []
      tableFilters = props.initialData[0]?.filters ?? []
    } else {
      const persistentFilters = props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
      const sessionFilters = props.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
      lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
      tableFilters = props.filters ?? []
    }

    const tableFiltersFormatted =
      tableFilters.map((filter) => ({
        ...filter,
        value: filter?.displayValue ?? filter?.value,
        type: 'table',
      })) ?? []

    const lockedFiltersFormatted = lockedFilters.map((filter) => ({
      ...filter,
      type: 'locked',
    }))

    const allFilters = [...tableFiltersFormatted, ...lockedFiltersFormatted]

    return allFilters
  }

  getInitialState = (initialProps) => {
    const props = initialProps ?? this.props

    const state = {
      titleInput: '',
      messageInput: '',
      expressionJSON: [],
      isConfirmDeleteModalVisible: false,
      activeStep: 0,
      completedSections: [],
      expressionKey: uuid(),
      isMounted: false,
      isSettingsFormComplete: true,
      billingUnitsInput: '',
      descriptionInput: '',
      categoryId: '',
      categories: null,
      fetchedCategories: false,
      baseDataAlertColumns: [],
      baseDataAlertQueryResponse: {},
      isLoadingBaseDataAlertQueryResponse: true,
      customFilters: [],
      termValue: {},
      isEditingDataAlert: this.props.currentDataAlert?.expression?.[1]?.term_type === 'DATA',
    }

    if (props.currentDataAlert) {
      const { currentDataAlert } = props
      if (
        (currentDataAlert?.id && currentDataAlert?.project?.id) ||
        (currentDataAlert?.id && currentDataAlert?.projects?.[0]?.id)
      ) {
        const dataAlertId = currentDataAlert.id
        const projectId = currentDataAlert.projects?.[0]?.id
        if (this.props?.autoQLConfig?.projectId) {
          previewManagementDataAlert({
            dataAlertId: dataAlertId,
            ...getAuthentication(this.props.authentication),
            projectId: projectId,
          })
            .then((response) => {
              this.setState({
                baseDataAlertColumns: response?.data?.data?.query_result?.data?.columns,
                baseDataAlertQueryResponse: { data: response?.data?.data?.query_result },
                isLoadingBaseDataAlertQueryResponse: false,
              })
            })
            .catch((error) => {
              const errorDetail = error?.message || 'Please try again or contact support if the issue persists'
              const errorMessage = `${errorDetail}`
              this.props.onErrorCallback(errorMessage)
              console.error('Error getting data alert preview:', error)
              this.setState({ isLoadingBaseDataAlertQueryResponse: false })
            })
        } else {
          previewDataAlert({
            dataAlertId: dataAlertId,
            ...getAuthentication(this.props.authentication),
          })
            .then((response) => {
              this.setState({
                baseDataAlertColumns: response?.data?.data?.query_result?.data?.columns,
                baseDataAlertQueryResponse: { data: response?.data?.data?.query_result },
                isLoadingBaseDataAlertQueryResponse: false,
              })
            })
            .catch((error) => {
              const errorDetail = error?.message || 'Please try again or contact support if the issue persists'
              const errorMessage = ` ${errorDetail}`
              this.props.onErrorCallback(errorMessage)
              console.error('Error getting data alert preview:', error)
              this.setState({ isLoadingBaseDataAlertQueryResponse: false })
            })
        }
      }
      if (state.isEditingDataAlert) {
        state.titleInput = currentDataAlert.title
        state.messageInput = currentDataAlert.message
      }

      state.expressionJSON = currentDataAlert?.expression
      state.billingUnitsInput = currentDataAlert?.billing_units
      state.descriptionInput = ''
      state.categoryId = ''
    }

    return state
  }

  initializeFields = (props) => {
    this.setState(this.getInitialState(props))
  }

  getDataAlertData = () => {
    try {
      const { currentDataAlert } = this.props
      const { titleInput, messageInput } = this.state

      const customFilters = this.state.customFilters

      const expressionJSON = [
        {
          id: this.state.isEditingDataAlert ? currentDataAlert.expression?.[0]?.id : uuid(),
          term_type: 'DATA_ALERT',
          condition: 'INTERSECTS',
          term_value: this.state.isEditingDataAlert
            ? currentDataAlert.expression?.[0]?.term_value
            : currentDataAlert.id,
          project_id: this.state.isEditingDataAlert
            ? currentDataAlert.expression?.[0]?.project_id
            : currentDataAlert.project?.id || currentDataAlert.projects?.[0]?.id,
          join_columns: [customFilters?.[0]?.column_name],
        },
        {
          id: this.state.isEditingDataAlert ? currentDataAlert.expression?.[1]?.id : uuid(),
          term_type: 'DATA',
          condition: 'TERMINATOR',
          term_value: this.state.termValue,
          join_columns: [customFilters?.[0]?.column_name],
        },
      ]

      let newDataAlert = {
        title: titleInput,
        message: messageInput,
        notification_type: this.NOTIFICATION_TYPE_EVENT,
        expression: expressionJSON,
        reset_period: null,
        projects: [],
        evaluation_mode: this.EVALUATION_MODE_COMPOSITE,
      }
      if (this.state.isEditingDataAlert) {
        newDataAlert = {
          id: currentDataAlert?.id,
          title: titleInput,
          message: messageInput,
          notification_type: this.NOTIFICATION_TYPE_EVENT,
          expression: expressionJSON,
          reset_period: null,
          projects: [],
          evaluation_mode: 'COMPOSITE',
        }
      }
      return newDataAlert
    } catch (error) {
      console.error(error)
    }
  }

  onExpressionChange = (expressionJSON) => {
    this.setState({ expressionJSON })
  }

  onDataAlertCreateOrEditSuccess = (dataAlertResponse) => {
    this.props.onSave(dataAlertResponse)
    const message = dataAlertResponse?.status === 201 ? 'Data Alert created!' : 'Data Alert updated!'
    this.props.onSuccessAlert(message)

    this.setState({
      isSavingDataAlert: false,
    })
  }

  onDataAlertCreateOrEditError = (error) => {
    console.error(error)
    this.props.onErrorCallback(error?.message)
    this.setState({
      isSavingDataAlert: false,
    })
  }

  assignCategoryToDataAlert = async (categoryId, dataAlertId) => {
    if (!categoryId || !dataAlertId) {
      return Promise.resolve()
    }
    return await assignLabelToManagementDataAlert({
      ...getAuthentication(this.props.authentication),
      dataAlertId: dataAlertId,
      categoryId: categoryId,
    })
  }

  onDataAlertSave = () => {
    this.setState({
      isSavingDataAlert: true,
    })

    const newDataAlert = this.getDataAlertData()
    const requestParams = {
      dataAlert: newDataAlert,
      ...getAuthentication(this.props.authentication),
    }

    if (this.props?.autoQLConfig?.projectId) {
      if (newDataAlert.id) {
        updateManagementDataAlert({
          ...requestParams,
          projectId: this.props?.autoQLConfig?.projectId,
        })
          .then((dataAlertResponse) => {
            this.assignCategoryToDataAlert(newDataAlert?.categoryId, newDataAlert?.id).then(() => {
              this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
            })
          })
          .catch((error) => {
            this.onDataAlertCreateOrEditError(error)
          })
      } else {
        createManagementDataAlert({
          ...requestParams,
          projectId: this.props?.autoQLConfig?.projectId,
        })
          .then((dataAlertResponse) => {
            this.assignCategoryToDataAlert(this.state.categoryId, dataAlertResponse?.data?.data?.id).then(() => {
              this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
            })
          })
          .catch((error) => {
            this.onDataAlertCreateOrEditError(error)
          })
      }
    } else if (newDataAlert?.id) {
      updateDataAlert({
        ...requestParams,
      })
        .then((dataAlertResponse) => {
          this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
        })
        .catch((error) => {
          this.onDataAlertCreateOrEditError(error)
        })
    } else {
      createDataAlert({
        ...requestParams,
      })
        .then((dataAlertResponse) => {
          this.onDataAlertCreateOrEditSuccess(dataAlertResponse)
        })
        .catch((error) => {
          this.onDataAlertCreateOrEditError(error)
        })
    }
  }

  isFinishBtnDisabled = () => {
    return !this.isStepReady()
  }

  renderFinishAndSaveBtn = () => {
    if (this.props.isPreviewMode) {
      return (
        <Button type='primary' onClick={this.props.onClose}>
          Close Preview
        </Button>
      )
    }

    const tooltipContent =
      this.state.titleInput === '' && this.state.customFilters.length === 0
        ? 'You must provide both an alert title and at least one filter'
        : this.state.titleInput === ''
          ? 'You must provide an alert title'
          : this.state.customFilters.length === 0
            ? 'You must select at least one filter'
            : ''

    return (
      <span data-tooltip-id={this.TOOLTIP_ID} data-tooltip-content={tooltipContent}>
        <Button
          type='primary'
          loading={this.state.isSavingDataAlert}
          onClick={this.onDataAlertSave}
          disabled={this.isFinishBtnDisabled()}
          tooltipID={this.TOOLTIP_ID}
        >
          Finish & Save
        </Button>
      </span>
    )
  }

  renderCancelBtn = () => {
    if (this.props.isPreviewMode) {
      return null
    }

    return (
      <Button
        tooltipID={this.TOOLTIP_ID}
        border={false}
        onClick={(e) => {
          e.stopPropagation()
          if (this.modalRef) {
            this.modalRef.onClose()
          }
        }}
      >
        Cancel
      </Button>
    )
  }
  renderDeleteBtn = () => {
    if (this.props.isPreviewMode) {
      return null
    }

    return (
      <Button
        type='danger'
        onClick={() => {
          this.setState({ isConfirmDeleteModalVisible: true })
        }}
        tooltipID={this.TOOLTIP_ID}
      >
        Delete Data Alert
      </Button>
    )
  }
  renderFooter = () => {
    return (
      <div className='data-alert-modal-footer-container'>
        {this.renderQuerySummary()}
        <div ref={(r) => (this.footerElement = r)} className='react-autoql-data-alert-modal-footer'>
          <div className='modal-footer-button-container'></div>
          <div className='modal-footer-button-container'>
            {this.renderCancelBtn()}
            {this.renderFinishAndSaveBtn()}
          </div>
        </div>
      </div>
    )
  }

  updateCustomFilters = (filters) => {
    this.setState({ customFilters: filters })
  }

  renderConditionsStep = () => {
    return (
      <div className={`react-autoql-custom-filtered-alert-modal-step`}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, width: '100%' }}>
            <ConditionBuilder
              authentication={this.props.authentication}
              dataFormatting={this.props.dataFormatting}
              ref={(r) => (this.expressionRef = r)}
              key={`expression-${this.state.expressionKey}`}
              onChange={this.onExpressionChange}
              expression={this.state.expressionJSON}
              queryResponse={this.props.queryResponse}
              tooltipID={this.TOOLTIP_ID}
              filters={this.props.filters}
              isCompositeAlert={true}
              dataAlert={this.props.currentDataAlert}
              baseDataAlertColumns={this.state.baseDataAlertColumns}
              baseDataAlertQueryResponse={this.state.baseDataAlertQueryResponse}
              isLoadingBaseDataAlertQueryResponse={this.state.isLoadingBaseDataAlertQueryResponse}
              onCustomFiltersChange={this.updateCustomFilters}
              customFilters={this.state.customFilters}
              isPreviewMode={this.props.isPreviewMode}
            />
          </div>
        </div>
      </div>
    )
  }

  getConditionStatement = () => {
    return 'the alert conditions are met'
  }

  renderComposeMessageStep = () => {
    return (
      <div className={`react-autoql-custom-filtered-alert-modal-step`}>
        <AppearanceSection
          ref={(r) => (this.appearanceSectionRef = r)}
          titleInput={this.state.titleInput}
          messageInput={this.state.messageInput}
          onTitleInputChange={(e) => this.setState({ titleInput: e.target.value })}
          onMessageInputChange={(e) => this.setState({ messageInput: e.target.value })}
          showConditionStatement
          conditionStatement={this.getConditionStatement()}
          descriptionInput={this.state.descriptionInput}
          selectedCategory={this.state.categoryId}
          onDescriptionInputChange={(e) => {
            this.setState({ descriptionInput: e.target.value })
          }}
          onCategorySelectChange={(value) => {
            this.setState({ categoryId: value })
          }}
          categories={this.state.categories || []}
          enableAlphaAlertSettings={this.props.enableAlphaAlertSettings}
          isCompositeAlert={true}
          isPreviewMode={this.props.isPreviewMode}
        />
      </div>
    )
  }

  onDataAlertDelete = () => {
    const dataAlertId = this.props.currentDataAlert?.id
    if (dataAlertId) {
      this.setState({ isConfirmDeleteModalVisible: false })
    }
  }

  renderStepContent = () => {
    return (
      <>
        {this.renderConditionsStep()}
        {!this.props.isPreviewMode && this.renderComposeMessageStep()}
      </>
    )
  }

  hasFilters = () => {
    return (
      !!this.props.filters?.length ||
      !!this.props.queryResponse?.data?.data?.fe_req?.session_filter_locks?.length ||
      !!this.props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks?.length ||
      !!this.props.currentDataAlert?.expression?.[0]?.session_filter_locks?.length ||
      !!this.props.currentDataAlert?.expression?.[0]?.filters?.length
    )
  }

  onSettingsCompleteChange = (isSettingsFormComplete) => {
    this.setState({ isSettingsFormComplete })
  }

  renderQuerySummary = () => {
    if (this.props.currentDataAlert?.id) {
      return null
    }
    const formattedQueryText = this.expressionRef?.getFormattedQueryText({
      sentenceCase: false,
      withFilters: true,
    })
    return (
      <div className='data-alert-modal-query-summary-container'>
        <div className='data-alert-modal-query-summary-background' />
        <div className='data-alert-modal-query-summary'>
          <span>
            <strong>Your data alert:</strong> "{formattedQueryText}"
          </span>
        </div>
      </div>
    )
  }

  renderContent = () => {
    if (!this.props.isVisible) {
      return null
    }

    return (
      <>
        <div className='data-alert-modal-step-content-container'>{this.renderStepContent()}</div>
      </>
    )
  }

  isStepReady = () => {
    return this.state.titleInput !== '' && this.state.customFilters.length > 0
  }

  getTitleIcon = () => {
    if (!_isEmpty(this.props.currentDataAlert) && this.state.isEditingDataAlert) {
      return <Icon key={`title-icon-${this.COMPONENT_KEY}`} type='settings' />
    }
    return <span key={`title-icon-${this.COMPONENT_KEY}`} />
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          contentClassName='react-autoql-data-alert-creation-modal'
          bodyClassName='react-autoql-data-alert-modal-body'
          overlayStyle={{ zIndex: '9998' }}
          title={
            this.props.isPreviewMode
              ? CUSTOM_FILTERED_ALERT_MODAL_TITLES.PREVIEW
              : this.state.isEditingDataAlert
                ? CUSTOM_FILTERED_ALERT_MODAL_TITLES.EDIT
                : CUSTOM_FILTERED_ALERT_MODAL_TITLES.CREATE
          }
          titleIcon={this.getTitleIcon()}
          ref={(r) => (this.modalRef = r)}
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          confirmOnClose={!this.props.isPreviewMode}
          enableBodyScroll
          width='1200px'
          height='auto'
          footer={this.renderFooter()}
          onOpened={this.props.onOpened}
          onClosed={this.props.onClosed}
        >
          <Tooltip tooltipId={this.TOOLTIP_ID} delayShow={500} />
          <div
            key={`data-alert-modal-content-${this.COMPONENT_KEY}`}
            ref={(r) => (this.contentRef = r)}
            className='react-autoql-data-alert-modal-content'
          >
            {this.renderContent()}
          </div>
        </Modal>
        <DataAlertDeleteDialog
          authentication={this.props.authentication}
          dataAlertId={this.props.currentDataAlert?.id}
          isVisible={this.state.isConfirmDeleteModalVisible}
          onDelete={this.onDataAlertDelete}
          onClose={() => this.setState({ isConfirmDeleteModalVisible: false })}
          onErrorCallback={this.props.onErrorCallback}
          onSuccessAlert={this.props.onSuccessAlert}
        />
      </ErrorBoundary>
    )
  }
}

export default withTheme(CustomFilteredAlertModal)
