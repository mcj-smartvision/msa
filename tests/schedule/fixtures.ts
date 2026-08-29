/** Minimal MSP XML builders for deterministic CPM tests. */

export function buildMspXml(
  projectName: string,
  tasks: Array<{
    uid: number
    name: string
    durationDays: number
    summary?: boolean
    predecessors?: Array<{ uid: number; type?: number; lag?: number }>
  }>,
  minutesPerDay = 480
): string {
  const taskXml = tasks
    .map((t) => {
      const dur = `PT${t.durationDays * (minutesPerDay / 60)}H0M0S`
      const links = (t.predecessors ?? [])
        .map(
          (p) =>
            `<PredecessorLink><PredecessorUID>${p.uid}</PredecessorUID><Type>${p.type ?? 1}</Type><LinkLag>${(p.lag ?? 0) * 10}</LinkLag></PredecessorLink>`
        )
        .join('')
      return `<Task><UID>${t.uid}</UID><ID>${t.uid}</ID><Name>${t.name}</Name><Summary>${t.summary ? 1 : 0}</Summary><Duration>${dur}</Duration><PercentComplete>0</PercentComplete>${links}</Task>`
    })
    .join('')

  return `<?xml version="1.0"?><Project><Name>${projectName}</Name><MinutesPerDay>${minutesPerDay}</MinutesPerDay><StartDate>2026-01-01T08:00:00</StartDate><FinishDate>2026-12-31T17:00:00</FinishDate><Tasks>${taskXml}</Tasks></Project>`
}

/** Fixture A: A(5)→B(3)→C(2), duration 10 days */
export const FIXTURE_A_XML = buildMspXml('Fixture A', [
  { uid: 1, name: 'A', durationDays: 5 },
  { uid: 2, name: 'B', durationDays: 3, predecessors: [{ uid: 1 }] },
  { uid: 3, name: 'C', durationDays: 2, predecessors: [{ uid: 2 }] },
])

/** Fixture B: A→B(3), A→C(1), project 8 days, C float 2 */
export const FIXTURE_B_XML = buildMspXml('Fixture B', [
  { uid: 1, name: 'A', durationDays: 5 },
  { uid: 2, name: 'B', durationDays: 3, predecessors: [{ uid: 1 }] },
  { uid: 3, name: 'C', durationDays: 1, predecessors: [{ uid: 1 }] },
])

/** Fixture C: two terminal branches */
export const FIXTURE_C_XML = buildMspXml('Fixture C', [
  { uid: 1, name: 'A', durationDays: 10 },
  { uid: 2, name: 'B', durationDays: 4, predecessors: [{ uid: 1 }] },
  { uid: 3, name: 'C', durationDays: 7 },
])

/** Fixture D: milestone */
export const FIXTURE_D_XML = buildMspXml('Fixture D', [
  { uid: 1, name: 'Milestone', durationDays: 0 },
])

/** Fixture E: cycle */
export const FIXTURE_E_XML = buildMspXml('Fixture E', [
  { uid: 1, name: 'A', durationDays: 2, predecessors: [{ uid: 2 }] },
  { uid: 2, name: 'B', durationDays: 2, predecessors: [{ uid: 1 }] },
])
