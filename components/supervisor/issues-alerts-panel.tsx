'use client'

import { SectionCard } from '@/components/admin/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormattedDate } from '@/components/schedule/formatted-date'
import type { SupervisorIssue } from '@/lib/supervisor/types'
import type { SiteSupervisorMessages } from '@/lib/i18n/site-supervisor'

interface IssuesAlertsPanelProps {
  issues: SupervisorIssue[]
  labels: SiteSupervisorMessages
  onDraftPmComment: (issueId: string) => void
}

export function IssuesAlertsPanel({ issues, labels, onDraftPmComment }: IssuesAlertsPanelProps) {
  return (
    <SectionCard title={labels.issuesAlerts}>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{labels.noIssues}</p>
      ) : (
        <ul className="divide-y">
          {issues.map((issue) => (
            <li key={issue.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{issue.title}</span>
                  <Badge variant={issue.status === 'open' ? 'destructive' : 'outline'}>
                    {issue.status === 'open' ? labels.open : labels.closed}
                  </Badge>
                  <Badge variant="secondary">{issue.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                {issue.related_task_name ? (
                  <p className="text-xs text-muted-foreground mt-1">فعالیت: {issue.related_task_name}</p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">
                  <FormattedDate value={issue.created_at.slice(0, 10)} />
                </p>
              </div>
              {issue.status === 'open' ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onDraftPmComment(issue.id)}>
                  {labels.pmComment}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
