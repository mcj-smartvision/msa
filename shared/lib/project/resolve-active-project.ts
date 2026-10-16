/**
 * @file shared/lib/project/resolve-active-project.ts
 * @purpose منطق دامنه — زیرساخت مشترک سامانه (resolve-active-project)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on nothing
 */

/** Resolve active project from cookie + allowed options (client or server). */

export function resolveActiveProjectId(
  projectOptions: Array<{ id: string }>,
  cookieProjectId: string | null | undefined
): string | null {
  if (projectOptions.length === 0) return null
  if (cookieProjectId && projectOptions.some((p) => p.id === cookieProjectId)) {
    return cookieProjectId
  }
  return projectOptions[0]?.id ?? null
}
