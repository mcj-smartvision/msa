import { notFound } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { ProjectAdminNav } from '@/features/admin/components/admin-nav'

export default async function ProjectAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.projectId)
    .maybeSingle()

  if (!project) notFound()

  return (
    <div className="space-y-6">
      <ProjectAdminNav projectId={project.id} projectName={project.name} />
      {children}
    </div>
  )
}
