'use client'

import Link from 'next/link'
import { ProjectForm } from '@/features/project-init/components/project-form'
import { PageHeader } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'

export default function ProjectInitializePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="راه‌اندازی پروژه"
        description="هر 8 بخش را تکمیل کنید تا پروژه عمرانی جدید راه‌اندازی شود. شناسه‌های سیستمی پنهان هنگام ثبت به‌صورت خودکار اختصاص داده می‌شوند."
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
