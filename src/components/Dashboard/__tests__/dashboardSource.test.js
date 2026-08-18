import { buildDashboardSource } from '../dashboardSource'

describe('buildDashboardSource', () => {
  test('project dashboard, viewing', () => {
    expect(buildDashboardSource({ dashboardId: 'db_123', isProjectDashboard: true, isEditing: false })).toBe(
      'dashboards.project.view.db_123',
    )
  })

  test('custom dashboard, editing', () => {
    expect(buildDashboardSource({ dashboardId: 'db_456', isProjectDashboard: false, isEditing: true })).toBe(
      'dashboards.custom.edit.db_456',
    )
  })

  test('undefined isProjectDashboard is treated as unspecified, not custom', () => {
    expect(buildDashboardSource({ dashboardId: 'db_789', isProjectDashboard: undefined, isEditing: false })).toBe(
      'dashboards.unspecified.view.db_789',
    )
  })

  test('null isProjectDashboard is treated as unspecified, not custom', () => {
    expect(buildDashboardSource({ dashboardId: 'db_789', isProjectDashboard: null, isEditing: false })).toBe(
      'dashboards.unspecified.view.db_789',
    )
  })

  test('missing dashboardId falls back to the "user" id placeholder while still encoding type/edit state', () => {
    expect(buildDashboardSource({ dashboardId: undefined, isProjectDashboard: true, isEditing: true })).toBe(
      'dashboards.project.edit.user',
    )
  })

  test('the id always sits in the last position regardless of type/edit state', () => {
    const withType = buildDashboardSource({ dashboardId: 'db_1', isProjectDashboard: true, isEditing: true })
    const withoutType = buildDashboardSource({ dashboardId: 'db_1', isProjectDashboard: undefined, isEditing: false })

    expect(withType.split('.').at(-1)).toBe('db_1')
    expect(withoutType.split('.').at(-1)).toBe('db_1')
  })
})
