/**
 * Absolute package weights: a package's weight is in the same project-level units as its parent
 * (an MSP leaf task or a parent package), so the children's weights must sum to the parent's.
 *
 * Mismatches never stop a calculation. The children are scaled to the parent weight (so the
 * project total stays intact) and the mismatch is reported as a data-quality issue.
 */

export const WEIGHT_TOLERANCE = 0.01
export const PROJECT_WEIGHT_TOTAL = 100

export type WeightIssueCode = 'children_sum_mismatch' | 'children_exceed_parent' | 'project_total_mismatch'

export interface WeightIssue {
  code: WeightIssueCode
  /** Parent task/package id, or null for the project total. */
  parentId: string | null
  parentLabel: string | null
  expected: number
  actual: number
  message_fa: string
}

export interface SiblingWeightResult {
  weights: number[]
  issue: WeightIssue | null
}

function positive(value: number | null | undefined): number {
  return value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

/**
 * Effective weights of one sibling group under a parent of weight `parentWeight`.
 * - Weighted siblings keep their absolute weight; unweighted ones share what remains equally.
 * - If the result does not sum to the parent, every sibling is scaled to fit and an issue is returned.
 * - With no parent weight, weights stay as entered (unweighted siblings count as 1).
 */
export function resolveSiblingWeights(
  parentWeight: number | null | undefined,
  childWeights: Array<number | null | undefined>,
  parent: { id?: string | null; label?: string | null } = {}
): SiblingWeightResult {
  const parentW = positive(parentWeight)
  const raw = childWeights.map(positive)
  if (raw.length === 0) return { weights: [], issue: null }
  if (parentW <= 0) return { weights: raw.map((w) => (w > 0 ? w : 1)), issue: null }

  const weightedSum = raw.reduce((sum, w) => sum + w, 0)
  const unweighted = raw.filter((w) => w === 0).length
  const issueBase = { parentId: parent.id ?? null, parentLabel: parent.label ?? null, expected: parentW, actual: round4(weightedSum) }

  if (unweighted > 0) {
    const remainder = parentW - weightedSum
    if (remainder > WEIGHT_TOLERANCE) {
      const share = remainder / unweighted
      return { weights: raw.map((w) => (w > 0 ? w : share)), issue: null }
    }
    // Weighted siblings already use the whole parent weight: nothing left for the rest.
    const scale = parentW / weightedSum
    return {
      weights: raw.map((w) => w * scale),
      issue: {
        ...issueBase,
        code: 'children_exceed_parent',
        message_fa: `جمع وزن زیرشاخه‌های وزن‌دار (${round4(weightedSum)}) به وزن والد (${parentW}) رسیده یا از آن بیشتر است و برای ${unweighted} زیرشاخهٔ بدون وزن چیزی نمی‌ماند؛ وزن‌ها به نسبت به وزن والد مقیاس شدند.`,
      },
    }
  }

  if (Math.abs(weightedSum - parentW) <= WEIGHT_TOLERANCE) return { weights: raw, issue: null }
  const scale = parentW / weightedSum
  return {
    weights: raw.map((w) => w * scale),
    issue: {
      ...issueBase,
      code: 'children_sum_mismatch',
      message_fa: `جمع وزن زیرشاخه‌ها (${round4(weightedSum)}) با وزن والد (${parentW}) برابر نیست؛ برای محاسبه به نسبت به وزن والد مقیاس شدند.`,
    },
  }
}

/** Leaf weights across the project must sum to 100 (percent-points). */
export function checkProjectWeightTotal(
  leafWeights: number[],
  expected = PROJECT_WEIGHT_TOTAL
): WeightIssue | null {
  const actual = round4(leafWeights.reduce((sum, w) => sum + positive(w), 0))
  if (actual <= 0 || Math.abs(actual - expected) <= WEIGHT_TOLERANCE) return null
  return {
    code: 'project_total_mismatch',
    parentId: null,
    parentLabel: null,
    expected,
    actual,
    message_fa: `جمع وزن فعالیت‌های برگ ${actual} است، نه ${expected}؛ شاخص‌ها روی همین جمع نرمال می‌شوند.`,
  }
}

/** Data-quality log line; calculations continue regardless. */
export function logWeightIssues(context: string, issues: WeightIssue[]): void {
  for (const issue of issues) {
    console.warn(`[data-quality] ${context}: ${issue.code}`, {
      parentId: issue.parentId,
      parentLabel: issue.parentLabel,
      expected: issue.expected,
      actual: issue.actual,
    })
  }
}
