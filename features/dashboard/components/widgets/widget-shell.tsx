import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface WidgetShellProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function WidgetShell({ title, description, children, className, action }: WidgetShellProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

interface WidgetGridProps {
  children: ReactNode
}

export function WidgetGrid({ children }: WidgetGridProps) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
}

interface WidgetGridItemProps {
  colSpan?: 1 | 2
  children: ReactNode
}

export function WidgetGridItem({ colSpan = 1, children }: WidgetGridItemProps) {
  return (
    <div className={cn(colSpan === 2 && 'md:col-span-2 xl:col-span-2')}>
      {children}
    </div>
  )
}
