'use client'

import { ModalOverlay } from '@/components/supervisor/modal-overlay'
import { ZoneDefinitionWorkspace } from '@/components/supervisor/zone-definition-workspace'
import type { DefinedZone } from '@/lib/supervisor/drawings-zoning-mock'
import type { ProjectDrawing } from '@/lib/technical-office/drawings-shared'

type ZoneDefinitionModalProps = {
  open: boolean
  onClose: () => void
  drawings: ProjectDrawing[]
  existingZones: DefinedZone[]
  onSaveZone: (zone: DefinedZone) => void
  editZone?: DefinedZone | null
  supervisorOptions?: string[]
  contractorOptions?: string[]
}

export function ZoneDefinitionModal({
  open,
  onClose,
  drawings,
  existingZones,
  onSaveZone,
  editZone = null,
  supervisorOptions = [],
  contractorOptions = [],
}: ZoneDefinitionModalProps) {
  if (!open) return null

  function handleSave(zone: DefinedZone) {
    onSaveZone(zone)
    if (editZone) onClose()
  }

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title="تعریف زون روی نقشه"
      className="sm:max-w-[min(96vw,1180px)] sm:rounded-xl"
      overlayClassName="p-2 sm:p-3"
    >
      <ZoneDefinitionWorkspace
        drawings={drawings}
        existingZones={existingZones}
        editZone={editZone}
        onSaveZone={handleSave}
        supervisorOptions={supervisorOptions}
        contractorOptions={contractorOptions}
        active={open}
      />
    </ModalOverlay>
  )
}
