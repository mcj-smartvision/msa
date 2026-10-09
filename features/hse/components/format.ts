export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}
