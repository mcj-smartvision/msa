import { describe, expect, it } from 'vitest'
import { groupMembersByRoleDashboard } from '@/features/admin/lib/role-dashboard-routes'

describe('groupMembersByRoleDashboard', () => {
  it('buckets people by the live dashboard of their assigned position', () => {
    const groups = groupMembersByRoleDashboard([
      { id: '1', positions: [{ key: 'site_supervisor' }] },
      { id: '2', positions: [{ key: 'site_manager' }, { key: 'hse_officer' }] },
      { id: '3', positions: [{ key: 'worker' }] },
    ])
    const supervisor = groups.find((g) => g.roleKey === 'site_supervisor')
    const hse = groups.find((g) => g.roleKey === 'hse_officer')
    expect(supervisor?.href).toBe('/dashboard/site-supervisor')
    expect(supervisor?.members.map((m) => m.id)).toEqual(['1', '2'])
    expect(hse?.members.map((m) => m.id)).toEqual(['2'])
  })
})
