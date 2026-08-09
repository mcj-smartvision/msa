'use client'

import Link from 'next/link'
import { ProjectForm } from '@/components/project-init/ProjectForm'
import { PageHeader } from '@/components/admin/shared'
import { Button } from '@/components/ui/button'

export default function ProjectInitializePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="راه‌اندازی پروژه"
        description="هر ۸ بخش را تکمیل کنید تا پروژه عمرانی جدید راه‌اندازی شود. شناسه‌های سیستمی پنهان هنگام ثبت به‌صورت خودکار اختصاص داده می‌شوند."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/projects">بازگشت به پروژه‌ها</Link>
          </Button>
        }
      />
      <ProjectForm />
    </div>
  )
}
