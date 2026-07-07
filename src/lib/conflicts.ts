import type { GTMActivity, Conflict } from './types'

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string): [string, string] | null {
  const s = aStart > bStart ? aStart : bStart
  const e = aEnd < bEnd ? aEnd : bEnd
  return s <= e ? [s, e] : null
}

// 같은 제품이 서로 다른 권역에서 기간이 겹치면 충돌로 표시.
// (글로벌 동시 푸시일 수도, 자기잠식일 수도 — 사람이 판단하도록 노출)
export function detectConflicts(activities: GTMActivity[]): Conflict[] {
  const live = activities.filter(
    a => a.status !== '취소' && a.product && a.startDate && a.endDate
  )

  // 제품명 기준 그룹
  const byProduct = new Map<string, GTMActivity[]>()
  for (const a of live) {
    const key = a.product.trim()
    if (!byProduct.has(key)) byProduct.set(key, [])
    byProduct.get(key)!.push(a)
  }

  const conflicts: Conflict[] = []

  for (const [product, group] of byProduct) {
    if (group.length < 2) continue

    // 서로 다른 권역끼리 기간 겹치는 쌍 찾기
    const overlappingSet = new Set<GTMActivity>()
    let oStart = ''
    let oEnd = ''

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (a.region === b.region) continue
        const ov = overlap(a.startDate, a.endDate, b.startDate, b.endDate)
        if (ov) {
          overlappingSet.add(a)
          overlappingSet.add(b)
          if (!oStart || ov[0] < oStart) oStart = ov[0]
          if (!oEnd || ov[1] > oEnd) oEnd = ov[1]
        }
      }
    }

    if (overlappingSet.size >= 2) {
      const acts = Array.from(overlappingSet)
      conflicts.push({
        product,
        activities: acts,
        regions: Array.from(new Set(acts.map(a => a.region))),
        overlapStart: oStart,
        overlapEnd: oEnd,
      })
    }
  }

  return conflicts
}
