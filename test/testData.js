export const defaultState = {
  _persist: {
    rehydrated: true,
    version: -1
  },
  authentication: {
    accessToken: null,
    authenticated: false,
    didUserJustLogin: true,
    isRefreshingToken: false,
    isResettingPassword: false,
    passwordTokenStatus: null,
    refreshToken: null,
    resetPasswordError: null
  },
  billing: {
    assignLicenseError: null,
    billingPlans: [],
    coupon: null,
    deletingLicenses: [],
    deletingPurchases: [],
    hasMadePurchase: false,
    isAssigningLicense: false,
    isFetchingLicenses: false,
    isFetchingPurchases: false,
    isPurchasingLicenses: false,
    licenseError: null,
    licenses: [],
    purchases: [],
    receipt: null,
    receiptError: null,
    userPaymentInfo: null
  },
  dashboards: {
    activeDashboardId: null,
    dashboardElementScrollToID: null,
    dashboardMessageObjects: [],
    dashboardObjects: [],
    dashboardOrgPermissionKeys: [],
    dashboardUserPermissions: [],
    dashboardsList: null,
    editedDashboardMessageObjects: [],
    editedDashboardObjects: [],
    error: null,
    isCreatingDashboard: false,
    isDashboardEditMode: false,
    isDashboardSharingModalVisible: false,
    isExportDashboardModalVisible: false,
    isFetchingDashboardsList: true,
    isNewDashboardWizardVisible: false,
    isProcessingDashboard: false,
    isSavingDashboard: false,
    selectedDashboardRowKeys: []
  },
  drillDown: {
    isDrillDownRunning: []
  },
  location: {
    location: null,
    redirectURL: null,
    scrollToCommentId: null,
    settingsTab: null
  },
  messages: {
    isQueryRunning: false,
    list: []
  },
  modals: {
    connectDataSourceServiceId: 1,
    isConnectDataSourceModalVisible: false,
    isDrillDownModalVisible: false,
    isProjectSettingVisible: false,
    isRemoveWeatherModalVisible: false,
    isScheduledTemplateWizardVisible: false,
    shouldFocusConnectDataSourceDataSourceNameInput: false,
    templateTileProjectSelectModalVisible: false
  },
  organizations: {
    activeId: null,
    creatingOrganizationError: null,
    error: null,
    hasAssignedLicense: false,
    isAddingUserToOrganization: false,
    isCreateOrganizationFormVisible: false,
    isCreatingOrganizationAndAddingUser: false,
    isFetchingOrganizationsForUser: false,
    isFetchingUsersFromUser: false,
    isUserOptedOutOfNotifications: false,
    list: [],
    organizationLicenses: null,
    organizationUsers: [],
    selectedOrganizationId: null,
    userProjectPermissionError: null
  },
  projects: {
    activeId: null,
    allProjects: [],
    deleteProjectFromOrganizationError: null,
    error: null,
    hasFetchedProjects: false,
    isFetchingProjectsFromOrganization: false,
    isQBODownloading: false,
    isStartingAuthorization: false,
    isUpdatingSettings: false,
    list: [],
    proAdvisorsList: [],
    projectAuthError: null,
    projectRefreshError: null,
    projectRefreshFailed: false,
    projectSettings: null
  },
  reports: {
    activeReportId: null,
    deleteReportError: null,
    isFetchingReports: false,
    isLoadingReport: true,
    isRenamingReport: false,
    isSavingReport: false,
    isSharingReport: false,
    justPerformedUndoAction: false,
    numPins: 0,
    pinnedQueriesList: [],
    reportOrganizationId: null,
    reportTilesList: [],
    reportsList: [],
    shareReportErrorModalVisible: false,
    shareReportId: null,
    shareReportModalVisible: false,
    shareReportSelectedRowKeys: [],
    shareReportUsers: [],
    showShareReportModal: false
  },
  router: {
    locationBeforeTransitions: null
  },
  sandbox: {
    sandboxApi: null
  },
  sider: {
    isSiderCollapsed: true,
    siderMounted: false
  },
  templates: {
    activeTemplateHasSchedule: false,
    activeTemplateId: null,
    activeTemplateQueries: [],
    hasExecutedTemplateQueries: false,
    isAddingTemplateTile: false,
    isCreatingScheduledTemplate: false,
    isExecutingTemplateQueries: false,
    isFetchingScheduledTemplates: true,
    isFetchingSharedTemplateOrgs: false,
    isFetchingTemplateQueries: false,
    isFetchingTemplates: false,
    isFirstTemplateProjectSelect: true,
    isRenamingTemplate: false,
    isSavingTemplate: false,
    isSharingTemplate: false,
    isTemplateEditMode: false,
    justPerformedUndoAction: false,
    pinnedQueriesList: [],
    reorderingTemplateMessages: false,
    scheduledTemplatesList: {},
    shareTemplateId: null,
    shareTemplateModalVisible: false,
    shareTemplateOrgList: [],
    shareTemplatePublicKeys: {},
    shareTemplateSelectedRowKeys: [],
    showShareTemplateModal: false,
    templateIsEdited: false,
    templatesList: []
  },
  tutorial: {
    connectDataSourceWalkthroughRunning: false,
    dsConnectionComplete: false,
    dsConnectionSkipped: null,
    interfaceOverviewBeaconClicked: false,
    interfaceOverviewWalkthroughRunning: false,
    uiIntroComplete: false,
    uiIntroSkipped: undefined
  },
  user: {
    email: null,
    full_name: null,
    id: null,
    notifications: []
  }
}
