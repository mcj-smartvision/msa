import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { fetchAdminProjects, fetchAllMembers } from '@/features/admin/services/admin'
import { fetchControlCenterFeeds } from '@/features/admin/lib/control-center'
import { ProjectDirectoryPage } from '@/features/admin/components/project-directory-page'

export default async function ProjectDirectoryRoute() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = await isSystemAdmin(supabase, user.id)
  if (!admin) redirect('/admin')

  const [projects, members] = await Promise.all([
    fetchAdminProjects(supabase),
    fetchAllMembers(supabase),
  ])
  const feeds = await fetchControlCenterFeeds(supabase, members)

  return (
    <ProjectDirectoryPage
      projects={projects}
      members={members}
      lastActivityByProjectId={feeds.lastActivityByProjectId}
    />
  )
}
