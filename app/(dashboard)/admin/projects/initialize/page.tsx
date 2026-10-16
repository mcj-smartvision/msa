/**
 * @file app/(dashboard)/admin/projects/initialize/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/project-init/components/project-form, features/admin/components/shared, shared/components/ui/button
 */

'use client'

import Link from 'next/link'
import { ProjectForm } from '@/features/project-init/components/project-form'
import { PageHeader } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { PROJECT_INIT_PAGE_COPY } from '@/features/project-init/config'

export default function ProjectInitializePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={PROJECT_INIT_PAGE_COPY.title}
        description={PROJECT_INIT_PAGE_COPY.description}
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/projects">{PROJECT_INIT_PAGE_COPY.backToProjects}</Link>
          </Button>
        }
      />
      <ProjectForm />
    </div>
  )
}
