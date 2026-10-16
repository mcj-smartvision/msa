/**
 * @file features/hse/components/alerts-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (alerts-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/format, features/hse/components/ui, shared/components/ui/button, shared/components/ui/input, features/hse/lib/mock-data, features/hse/lib/types, features/hse/config
 */

'use client'

import { useState } from 'react'
import { BellRing, Save } from 'lucide-react'
import { SeverityBadge } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
HSE_ALERT_LOGS,
HSE_ALERT_ROUTING,
HSE_TELEGRAM_SETTINGS,
} from '@/features/hse/lib/mock-data'
import type { AlertLogEntry, AlertRouting } from '@/features/hse/lib/types'
import { HSE_ALERT_RESULT_COPY, HSE_ALERTS_COPY, HSE_CHANNEL_COPY, HSE_COMMON_COPY } from '@/features/hse/config'

const CHANNEL_LABEL: Record<AlertLogEntry['channel'], string> = HSE_CHANNEL_COPY
const RESULT_LABEL: Record<AlertLogEntry['result'], string> = HSE_ALERT_RESULT_COPY

export function AlertsPage() {
  const [telegram, setTelegram] = useState(() => ({ ...HSE_TELEGRAM_SETTINGS }))
  const [routing, setRouting] = useState<AlertRouting[]>(() =>
    HSE_ALERT_ROUTING.map((r) => ({ ...r }))
  )
  const [webhookUrl, setWebhookUrl] = useState(HSE_ALERTS_COPY.defaultWebhookUrl)
  const [emailDigest, setEmailDigest] = useState(HSE_ALERTS_COPY.defaultEmailDigest)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  function toggleRoute(
    severity: AlertRouting['severity'],
    channel: 'telegram' | 'email' | 'webhook'
  ) {
    setRouting((prev) =>
      prev.map((row) =>
        row.severity === severity ? { ...row, [channel]: !row[channel] } : row
      )
    )
  }

  function saveSettings() {
    setSavedNote(HSE_ALERTS_COPY.savedNote)
  }

  function testAlert() {
    setTestMessage(HSE_ALERTS_COPY.testMessage(telegram.chatIdMasked, emailDigest))
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title={HSE_ALERTS_COPY.title}
        description={HSE_ALERTS_COPY.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {savedNote ? (
              <div className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                {savedNote}
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={saveSettings}>
              <Save className="h-3.5 w-3.5" />
              {HSE_ALERTS_COPY.saveSettings}
            </Button>
            <Button size="sm" onClick={testAlert}>
              <BellRing className="h-3.5 w-3.5" />
              {HSE_ALERTS_COPY.testAlert}
            </Button>
          </div>
        }
      />

      {testMessage ? (
        <div className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {testMessage}
        </div>
      ) : null}

      <Panel
        title={HSE_ALERTS_COPY.roleRoutingTitle}
        description={HSE_ALERTS_COPY.roleRoutingDesc}
      >
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">{HSE_ALERTS_COPY.hseOfficer}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {HSE_ALERTS_COPY.hseOfficerDesc}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="font-semibold text-slate-900">{HSE_ALERTS_COPY.siteSupervisor}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {HSE_ALERTS_COPY.siteSupervisorDesc}
            </p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3">
            <p className="font-semibold text-slate-900">{HSE_ALERTS_COPY.projectManager}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {HSE_ALERTS_COPY.projectManagerDesc}
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title={HSE_ALERTS_COPY.telegramTitle} description={HSE_ALERTS_COPY.telegramDesc}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{HSE_ALERTS_COPY.botConfigured}</dt>
              <dd className="font-medium text-slate-900">
                {telegram.botConfigured ? HSE_COMMON_COPY.yes : HSE_COMMON_COPY.no}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{HSE_ALERTS_COPY.chatId}</dt>
              <dd className="font-mono text-slate-900">{telegram.chatIdMasked}</dd>
            </div>
          </dl>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {(
              [
                ['notifyCritical', HSE_ALERTS_COPY.notifyCritical],
                ['notifyHigh', HSE_ALERTS_COPY.notifyHigh],
                ['notifyMedium', HSE_ALERTS_COPY.notifyMedium],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={telegram[key]}
                  onChange={(e) => setTelegram((t) => ({ ...t, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>

        <Panel title={HSE_ALERTS_COPY.webhookTitle} description={HSE_ALERTS_COPY.webhookDesc}>
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-600">{HSE_ALERTS_COPY.endpoint}</span>
            <Input
              className="h-9 font-mono text-xs"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {HSE_ALERTS_COPY.webhookHint}
          </p>
        </Panel>

        <Panel title={HSE_ALERTS_COPY.emailTitle} description={HSE_ALERTS_COPY.emailDesc}>
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-600">{HSE_ALERTS_COPY.defaultRecipients}</span>
            <Input
              className="h-9 text-sm"
              value={emailDigest}
              onChange={(e) => setEmailDigest(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {HSE_ALERTS_COPY.emailHint}
          </p>
        </Panel>
      </div>

      <Panel title={HSE_ALERTS_COPY.severityRoutingTitle} description={HSE_ALERTS_COPY.severityRoutingDesc}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colSeverity}</th>
                <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colTelegram}</th>
                <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colEmail}</th>
                <th className="pb-2 font-semibold">{HSE_ALERTS_COPY.colWebhook}</th>
              </tr>
            </thead>
            <tbody>
              {routing.map((row) => (
                <tr key={row.severity} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pl-3">
                    <SeverityBadge value={row.severity} />
                  </td>
                  {(['telegram', 'email', 'webhook'] as const).map((channel) => (
                    <td key={channel} className="py-2 pl-3 last:pl-0">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={row[channel]}
                          onChange={() => toggleRoute(row.severity, channel)}
                        />
                        {row[channel] ? HSE_ALERTS_COPY.on : HSE_ALERTS_COPY.off}
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={HSE_ALERTS_COPY.historyTitle} description={HSE_ALERTS_COPY.historyDesc(HSE_ALERT_LOGS.length)}>
        {HSE_ALERT_LOGS.length === 0 ? (
          <EmptyRow>{HSE_ALERTS_COPY.emptyLogs}</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colTime}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colChannel}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colSeverity}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colIncident}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colTarget}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ALERTS_COPY.colResult}</th>
                  <th className="pb-2 font-semibold">{HSE_ALERTS_COPY.colDetail}</th>
                </tr>
              </thead>
              <tbody>
                {[...HSE_ALERT_LOGS]
                  .sort((a, b) => +new Date(b.at) - +new Date(a.at))
                  .map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="py-2 pl-3 whitespace-nowrap text-xs tabular-nums text-slate-600">
                        {formatDateTime(log.at)}
                      </td>
                      <td className="py-2 pl-3 text-slate-700">{CHANNEL_LABEL[log.channel]}</td>
                      <td className="py-2 pl-3">
                        <SeverityBadge value={log.severity} />
                      </td>
                      <td className="py-2 pl-3 font-mono text-xs text-slate-800">
                        {log.incidentCode}
                      </td>
                      <td className="max-w-[180px] py-2 pl-3 text-xs text-slate-600">
                        {log.target}
                      </td>
                      <td className="py-2 pl-3 text-slate-700">{RESULT_LABEL[log.result]}</td>
                      <td className="max-w-[240px] py-2 text-xs text-slate-600">{log.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
