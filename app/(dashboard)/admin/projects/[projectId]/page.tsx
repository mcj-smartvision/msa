/**
 * @file app/(dashboard)/admin/projects/[projectId]/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on nothing
 */

import { redirect } from 'next/navigation'

export default function ProjectAdminIndexPage({
  params,
}: {
  params: { projectId: string }
}) {
  redirect(`/admin/projects/${params.projectId}/members`)
}
