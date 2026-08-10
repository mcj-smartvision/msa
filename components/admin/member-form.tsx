'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ConstructionRoleSelect } from '@/components/admin/construction-role-select'
import {
  formatLoginDisplay,
  isDeliverableEmail,
  normalizeLoginIdentifier,
} from '@/lib/auth/login-identifier'
import { getAdminMemberMessages } from '@/lib/i18n/admin-member'
import { useLocale } from '@/components/i18n/locale-provider'
import type { CreateMemberInput, Position, ProjectMember } from '@/types/admin'
import { UserPlus } from 'lucide-react'

interface MemberFormProps {
  positions: Position[]
  initial?: Partial<ProjectMember> & { position_ids?: string[] }
  submitLabel: string
  onSubmit: (values: CreateMemberInput & { contact_email?: string }) => Promise<void>
  showPasswordField?: boolean
  positionsLoading?: boolean
  onSeedPositions?: () => Promise<void>
  /** Prefill role dropdown by positions.key (e.g. hse_officer). */
  preferredPositionKey?: string
}

export function MemberForm({
  positions,
  initial,
  submitLabel,
  onSubmit,
  showPasswordField = !initial,
  positionsLoading = false,
  onSeedPositions,
  preferredPositionKey,
}: MemberFormProps) {
  const { locale } = useLocale()
  const t = getAdminMemberMessages(locale)
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [username, setUsername] = useState(
    initial?.email ? formatLoginDisplay(initial.email) : ''
  )
  const [contactEmail, setContactEmail] = useState(
    initial?.contact_email ||
      (initial?.email && !initial.email.toLowerCase().endsWith('@site.local')
        ? initial.email
        : '')
  )
  const [personnelCode, setPersonnelCode] = useState(initial?.personnel_code ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [roleId, setRoleId] = useState<string>(
    initial?.position_ids?.[0] ?? initial?.positions?.[0]?.id ?? ''
  )
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!preferredPositionKey || roleId) return
    const match = positions.find((p) => p.key === preferredPositionKey && p.is_active)
    if (match) setRoleId(match.id)
  }, [preferredPositionKey, positions, roleId])

  async function handleSeed() {
    if (!onSeedPositions) return
    setSeeding(true)
    setSeedMessage(null)
    setError(null)
    try {
      await onSeedPositions()
      setSeedMessage(t.positionsSeeded)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.seedFailed)
    } finally {
      setSeeding(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!roleId) {
      setError(t.selectRoleError)
      return
    }

    const emailTrimmed = contactEmail.trim().toLowerCase()
    if (emailTrimmed && !isDeliverableEmail(emailTrimmed)) {
      setError(t.emailInvalidError)
      return
    }

    if (showPasswordField && password.length < 6) {
      setError(t.passwordMinError)
      return
    }

    // New members: prefer real email as login; otherwise username@site.local
    const loginEmail = showPasswordField
      ? emailTrimmed && isDeliverableEmail(emailTrimmed)
        ? emailTrimmed
        : normalizeLoginIdentifier(username.trim())
      : normalizeLoginIdentifier(username.trim() || initial?.email || '')

    if (showPasswordField && !loginEmail) {
      setError(t.usernameOrEmailRequired)
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        full_name: fullName.trim(),
        email: loginEmail,
        contact_email: emailTrimmed || undefined,
        personnel_code: personnelCode.trim() || undefined,
        phone: phone.trim() || undefined,
        password: showPasswordField ? password : (initial?.admin_visible_password ?? ''),
        is_active: isActive,
        position_ids: [roleId],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t.seedFailed)
    } finally {
      setLoading(false)
    }
  }

  const roleMessages = {
    siteRole: t.siteRole,
    selectRole: t.selectRole,
    noPositions: t.noPositions,
    seedPositions: t.seedPositions,
    seedingPositions: t.seedingPositions,
    loadingPositions: t.loadingPositions,
  }

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">{submitLabel}</CardTitle>
            <CardDescription>{t.memberManagementDesc}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-name">{t.fullName}</Label>
              <Input
                id="member-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-username">{t.username}</Label>
              <Input
                id="member-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={showPasswordField && !contactEmail.trim()}
                disabled={Boolean(initial)}
                className="h-11"
                placeholder="jimi"
              />
              <p className="text-xs text-muted-foreground">{t.usernameHint}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-contact-email">{t.email}</Label>
            <Input
              id="member-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-11"
              placeholder="name@gmail.com"
              required={showPasswordField}
            />
            <p className="text-xs text-muted-foreground">{t.emailHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-personnel-code">کد پرسنلی</Label>
            <Input
              id="member-personnel-code"
              value={personnelCode}
              onChange={(e) => setPersonnelCode(e.target.value)}
              className="h-11 font-mono"
              placeholder="مثلاً 1403-012"
            />
          </div>

          <ConstructionRoleSelect
            positions={positions}
            value={roleId}
            onChange={setRoleId}
            loading={positionsLoading}
            seeding={seeding}
            seedMessage={seedMessage}
            onSeed={onSeedPositions ? handleSeed : undefined}
            messages={roleMessages}
          />

          {showPasswordField ? (
            <div className="space-y-2">
              <Label htmlFor="member-password">{t.initialPassword}</Label>
              <Input
                id="member-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 font-mono"
              />
              <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-phone">{t.phoneOptional}</Label>
              <Input
                id="member-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex items-end pb-1">
              <Checkbox
                id="member-active"
                label={t.activeMember}
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          ) : null}

          <Button
            type="submit"
            disabled={loading || seeding || (!positionsLoading && positions.filter((p) => p.is_active).length === 0)}
            className="h-11"
          >
            {loading ? t.saving : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
