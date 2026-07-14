'use client'

import type { GTMActivity } from '@/lib/types'
import { TYPE_STYLE, TYPE_ORDER, category } from '@/lib/ui'

const BRAND_COLOR: Record<string, string> = {
  바이오힐보: '#7C3AED', 웨이크메이크: '#DC2626', 컬러그램: '#DB2777',
  브링그린: '#16A34A', 올리브영: '#65A30D',
}
const brandColor = (b: string) => BRAND_COLOR[b] || '#94a3b8'
const BRAND_ORDER = ['바이오힐보', '웨이크메이크', '컬러그램', '브링그린', '올리브영']
const REGION_ORDER = ['국내', '일본', '중국', '미국', '영국', '전사']
const CAT_ORDER = ['상품', '온라인', '오프라인'] as const

function ym(d: string): { y: number; m: number; key: string } | null {
  const m = (d || '').match(/^(\d{4})\D+(\d{1,2})/)
  return m ? { y: +m[1], m: +m[2], key: `${m[1]}-${String(+m[2]).padStart(2, '0')}` } : null
}
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s }

function sortPresent(values: string[], order: string[]): string[] {
  const present = Array.from(new Set(values))
  return present.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
  })
}

export function BrandMatrix({ activities, onSelect }: { activities: GTMActivity[]; onSelect: (a: GTMActivity) => void }) {
  const acts = activities.filter(a => ym(a.startDate))

  // 공통 월 컬럼
  const monthMap = new Map<string, { y: number; m: number }>()
  acts.forEach(a => { const k = ym(a.startDate)!; monthMap.set(k.key, { y: k.y, m: k.m }) })
  const months = Array.from(monthMap.values()).sort((a, b) => a.y - b.y || a.m - b.m)

  const brands = sortPresent(acts.map(a => a.brand || '기타'), BRAND_ORDER)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <span>🗂️</span>
        <h3 className="text-sm font-bold text-gray-800">브랜드별 활동 (국가 · 상품/온라인/오프라인)</h3>
        <span className="ml-auto text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{acts.length}건</span>
        {/* 유형 범례 */}
        <div className="w-full flex items-center gap-3 text-2xs text-gray-400 mt-0.5">
          {TYPE_ORDER.map(t => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${TYPE_STYLE[t] ?? 'bg-gray-400'}`} />{t}
            </span>
          ))}
          <span className="inline-flex items-center gap-1"><span className="text-pink-500">★</span>주력</span>
        </div>
      </div>

      {acts.length === 0 ? (
        <div className="px-3 py-8 text-center text-gray-400 text-xs">표시할 항목이 없습니다 (필터 확인)</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 text-left text-2xs font-semibold text-gray-400 px-3 py-1.5 min-w-[150px]">브랜드 · 국가 · 구분</th>
                {months.map(mo => (
                  <th key={`${mo.y}-${mo.m}`} className="text-2xs font-semibold text-gray-400 px-2 py-1.5 min-w-[120px] border-l border-gray-100">{mo.m}월</th>
                ))}
              </tr>
            </thead>
            {brands.map(brand => {
                const bActs = acts.filter(a => (a.brand || '기타') === brand)
                const regions = sortPresent(bActs.map(a => a.region || '기타'), REGION_ORDER)
                const rows: { region: string; cat: string }[] = []
                regions.forEach(rg => {
                  CAT_ORDER.forEach(cat => {
                    if (bActs.some(a => (a.region || '기타') === rg && category(a) === cat)) rows.push({ region: rg, cat })
                  })
                })
                return (
                  <tbody key={brand} className="border-t-4 border-gray-100">
                    {/* 브랜드 헤더 행 */}
                    <tr style={{ background: `${brandColor(brand)}10` }}>
                      <td colSpan={months.length + 1} className="px-3 py-1.5 sticky left-0">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: brandColor(brand) }} />
                          <span className="text-xs font-bold text-gray-800">{brand}</span>
                          <span className="text-2xs text-gray-400">{bActs.length}건</span>
                        </span>
                      </td>
                    </tr>
                    {rows.map(({ region, cat }) => {
                      const rowActs = bActs.filter(a => (a.region || '기타') === region && category(a) === cat)
                      return (
                        <tr key={`${brand}-${region}-${cat}`} className="align-top border-b border-gray-50">
                          <td className="sticky left-0 z-10 bg-white px-3 py-1.5 whitespace-nowrap border-r border-gray-100">
                            <span className="text-2xs text-gray-500">{region}</span>
                            <span className="text-2xs font-semibold text-gray-700 ml-1.5">{cat}</span>
                          </td>
                          {months.map(mo => {
                            const cell = rowActs
                              .filter(a => { const k = ym(a.startDate)!; return k.y === mo.y && k.m === mo.m })
                              .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
                            return (
                              <td key={`${mo.y}-${mo.m}`} className="px-1.5 py-1.5 border-l border-gray-50 align-top">
                                <div className="flex flex-col gap-1">
                                  {cell.map(a => (
                                    <button
                                      key={a.id}
                                      onClick={() => onSelect(a)}
                                      title={`[${a.type}] ${a.title}${a.product ? ` · ${a.product}` : ''} (${a.startDate})`}
                                      className="text-left rounded px-1.5 py-1 bg-gray-50 hover:bg-gray-100 transition flex items-start gap-1"
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-sm shrink-0 mt-0.5 ${TYPE_STYLE[a.type] ?? 'bg-gray-400'}`} />
                                      <span className="text-2xs font-medium text-gray-800 leading-tight">
                                        {a.hero && <span className="text-pink-500">★</span>}
                                        {trunc(a.product || a.title, 13)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
          </table>
        </div>
      )}
    </div>
  )
}
