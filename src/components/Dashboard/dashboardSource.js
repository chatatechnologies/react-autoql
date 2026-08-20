// Fixed-position source string for dashboard-related requests: dashboards.<type>.<editState>.<id>
// Always 4 segments, id always last, so the backend can parse by fixed index regardless of state.
export const buildDashboardSource = ({ dashboardId, isProjectDashboard, isEditing }) => {
  const type = isProjectDashboard == null ? 'unspecified' : isProjectDashboard ? 'project' : 'custom'
  const editState = isEditing ? 'edit' : 'view'
  const id = dashboardId || 'user'

  return `dashboards.${type}.${editState}.${id}`
}
