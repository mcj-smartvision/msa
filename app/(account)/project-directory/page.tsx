import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { fetchAdminProjects, fetchAllMembers } from '@/utils/admin'
import { fetchControlCenterFeeds } from '@/lib/admin/control-center'
import { ProjectDirectoryPage } from '@/components/admin/project-directory-page'

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
