'use client'

import { useMemo } from 'react'
import type { GTMActivity, FocusProduct } from '@/lib/types'
import { REGIONS } from '@/lib/types'
import { fromMonthKey, intersectsMonth } from '@/lib/ui'

const BRAND_COLOR: Record<string, string> = {
  바이오힐보: '#7C3AED', 웨이크메이크: '#DC2626', 컬러그램: '#DB2777', 브링그린: '#16A34A', 올리브영: '#65A30D',
}
const brandColor = (b: string) => BRAND_COLOR[b] || '#94a3b8'

// 제품명 부분일치 (양방향) — 주력 제품명과 활동 제품/행사명 매칭
function nameMatch(focusProduct: string, a: GTMActivity): boolean {
  const p = focusProduct.trim()
  if (!p) return false
  const cands = [a.product, a.title].filter(Boolean)
  return cands.some(c => c.includes(p) || p.includes(c))
}

interface Item { region: string; brand: string; product: string; count: number }

export function FocusProductStrip({
  focusProducts, activities, cursor,
}: {
  focusProducts: FocusProduct[]
  activities: GTMActivity[]
  cursor: number
}) {
  const { m: curM } = fromMonthKey(cursor)

  const items = useMemo<Item[]>(() => {
    const monthActs = activities.filter(a => intersectsMonth(a, cursor))
    const rows: Item[] = []
    focusProducts
      .filter(f => f.month === curM)
      .forEach(f => f.products.forEach(product => {
        const count = monthActs.filter(a => nameMatch(product, a)).length
        rows.push({ region: f.region, brand: f.brand, product, count })
      }))
    // 권역 순서로 정렬
    return rows.sort((a, b) => {
      const ra = REGIONS.indexOf(a.region as never), rb = REGIONS.indexOf(b.region as never)
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || (a.brand < b.brand ? -1 : 1)
    })
  }, [focusProducts, activities, cursor, curM])

  const orphan = items.filter(i => i.count === 0).length

  // 강등 표시 (숨기지 않음)
  const degraded = focusProducts.length === 0
    ? '주력상품 탭 미입력 — 시트에 권역별 월 주력 제품을 채우면 여기 표시됩니다'
    : items.length === 0
      ? `${curM}월 주력상품 미지정 — 이달 집중 제품이 시트에 없습니다`
      : null

  // 권역별 그룹
  const byRegion = useMemo(() => {
    const map = new Map<string, Item[]>()
    items.forEach(i => { if (!map.has(i.region)) map.set(i.region, []); map.get(i.region)!.push(i) })
    return Array.from(map.entries())
  }, [items])

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <span className="text-pink-500">★</span>
        <h3 className="text-sm font-bold text-gray-800">이달의 주력상품</h3>
        <span className="text-2xs text-gray-400">{curM}월 · 권역 × 브랜드 · 배지 = 이달 관련 활동수</span>
        {!degraded && <span className="ml-auto text-2xs bg-pink-50 text-pink-600 rounded-full px-2 py-0.5">{items.length}개</span>}
      </div>

      {degraded ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-gray-400">{degraded}</p>
        </div>
      ) : (
        <>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {byRegion.map(([region, rows]) => (
              <div key={region} className="rounded-lg border border-gray-100 p-2.5">
                <p className="text-2xs font-bold text-gray-500 mb-1.5">{region}</p>
                <div className="space-y-1.5">
                  {rows.map((i, k) => (
                    <div key={`${i.brand}-${i.product}-${k}`} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: brandColor(i.brand) }} />
                      <span className="text-2xs text-gray-700 font-medium truncate flex-1">{i.product}</span>
                      <span className={`text-2xs rounded-full px-1.5 py-0.5 shrink-0 font-semibold
                        ${i.count === 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'}`}>
                        {i.count === 0 ? '활동 0' : `${i.count}건`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-2xs text-gray-400">
              {orphan > 0
                ? `⚠ 이달 주력인데 관련 활동 0건인 조합 ${orphan}개 — 실행계획 누락 의심. 담당팀 확인`
                : '모든 주력상품에 이달 관련 활동 존재 — 실행계획 정상'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
