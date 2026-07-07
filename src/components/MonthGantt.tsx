'use client'

import { useMemo, useState } from 'react'
import type { GTMActivity } from '@/lib/types'
import { category, CATEGORY_STYLE, CATEGORY_ORDER, parseYMD, fromMonthKey, monthKey, type Category } from '@/lib/ui'

const BRAND_ORDER = ['바이오힐보', '웨이크메이크', '컬러그램', '브링그린', '올리브영']
const BRAND_COLOR: Record<string, string> = {
  바이오힐보: '#7C3AED', 웨이크메이크: '#DC2626', 컬러그램: '#DB2777', 브링그린: '#16A34A', 올리브영: '#65A30D',
}
const brandColor = (b: string) => BRAND_COLOR[b] || '#94a3b8'
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s }

interface Span {
  a: GTMActivity
  left: number; width: number
  contBefore: boolean; contAfter: boolean
  track: number
}

// 활동 막대의 월 내 위치(0~1). 월과 교차하지 않으면 null.
function computeSpan(a: GTMActivity, curKey: number, daysInMonth: number) {
  const s = parseYMD(a.startDate); if (!s) return null
  const e = parseYMD(a.endDate) || s
  const sKey = monthKey(s.y, s.m), eKey = monthKey(e.y, e.m)
  if (sKey > curKey || eKey < curKey) return null
  const startDay = sKey < curKey ? 1 : s.d
  const endDay = eKey > curKey ? daysInMonth : Math.min(e.d, daysInMonth)
  const left = (startDay - 1) / daysInMonth
  const right = Math.max(endDay, startDay) / daysInMonth
  return { left, width: Math.max(right - left, 0.025), contBefore: sKey < curKey, contAfter: eKey > curKey }
}

// 겹치지 않게 트랙(행) 배치
function packTracks(spans: Omit<Span, 'track'>[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.left - b.left || b.width - a.width)
  const ends: number[] = []
  return sorted.map(sp => {
    let t = ends.findIndex(end => end <= sp.left + 1e-6)
    if (t === -1) { t = ends.length; ends.push(sp.left + sp.width) }
    else ends[t] = sp.left + sp.width
    return { ...sp, track: t }
  })
}

interface Props {
  activities: GTMActivity[]
  cursor: number
  setCursor: (k: number) => void
  onSelect: (a: GTMActivity) => void
}

export function MonthGantt({ activities, cursor, setCursor, onSelect }: Props) {
  const [catFilter, setCatFilter] = useState<Set<Category>>(new Set())
  const { y: curY, m: curM } = fromMonthKey(cursor)
  const daysInMonth = new Date(curY, curM, 0).getDate()

  const visible = useMemo(
    () => (catFilter.size ? activities.filter(a => catFilter.has(category(a))) : activities),
    [activities, catFilter]
  )

  // 이번 달과 교차하는 활동만
  const monthActs = useMemo(() => {
    return visible.map(a => {
      const sp = computeSpan(a, cursor, daysInMonth)
      return sp ? { a, ...sp } : null
    }).filter(Boolean) as Omit<Span, 'track'>[]
  }, [visible, cursor, daysInMonth])

  // 카테고리 카운트(전체 기준, 토글 표시용)
  const catCounts = useMemo(() => {
    const c: Record<string, number> = { 상품: 0, 온라인: 0, 오프라인: 0 }
    activities.forEach(a => { if (computeSpan(a, cursor, daysInMonth)) c[category(a)]++ })
    return c
  }, [activities, cursor, daysInMonth])

  // 브랜드 → 카테고리 레인
  const brandRows = useMemo(() => {
    const byBrand = new Map<string, Omit<Span, 'track'>[]>()
    monthActs.forEach(sp => {
      const b = sp.a.brand || '기타'
      if (!byBrand.has(b)) byBrand.set(b, [])
      byBrand.get(b)!.push(sp)
    })
    const brands = Array.from(byBrand.keys()).sort((a, b) => {
      const ia = BRAND_ORDER.indexOf(a), ib = BRAND_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1)
    })
    return brands.map(brand => {
      const spans = byBrand.get(brand)!
      const lanes = CATEGORY_ORDER
        .map(cat => ({ cat, spans: packTracks(spans.filter(sp => category(sp.a) === cat)) }))
        .filter(l => l.spans.length > 0)
      return { brand, count: spans.length, lanes }
    })
  }, [monthActs])

  const now = new Date()
  const todayFrac = (now.getFullYear() === curY && now.getMonth() + 1 === curM)
    ? (now.getDate() - 0.5) / daysInMonth : null

  const move = (delta: number) => setCursor(cursor + delta)
  const goToday = () => setCursor(monthKey(now.getFullYear(), now.getMonth() + 1))
  const toggleCat = (c: Category) => setCatFilter(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })

  // 주 경계 눈금 (1, 8, 15, 22, 29 …)
  const ticks: number[] = []
  for (let d = 1; d <= daysInMonth; d += 7) ticks.push(d)
  if (ticks[ticks.length - 1] !== daysInMonth) ticks.push(daysInMonth)

  const LABEL_W = 132 // 좌측 라벨 칼럼 px
  const BAR_H = 22

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <span>📊</span>
        <h3 className="text-sm font-bold text-gray-800">월 간트 (기간 타임라인)</h3>
        <span className="text-2xs text-gray-400">막대 = 행사 기간 · 색 = 상품/온라인/오프라인</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => move(-1)} className="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-500 text-sm" aria-label="이전 달">◀</button>
          <span className="text-sm font-bold text-gray-800 min-w-[88px] text-center tabular-nums">{curY}년 {curM}월</span>
          <button onClick={() => move(1)} className="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-500 text-sm" aria-label="다음 달">▶</button>
          <button onClick={goToday} className="ml-1 text-2xs text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:border-gray-400">오늘</button>
          <span className="ml-1 text-2xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{monthActs.length}건</span>
        </div>
        {/* 카테고리 토글 */}
        <div className="w-full flex items-center gap-1.5 mt-0.5">
          {CATEGORY_ORDER.map(c => {
            const on = catFilter.has(c); const sty = CATEGORY_STYLE[c]
            return (
              <button key={c} onClick={() => toggleCat(c)}
                className={`inline-flex items-center gap-1 text-2xs rounded-full px-2 py-0.5 border transition-colors
                  ${on ? `${sty.chip} border-transparent font-semibold` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                <span className={`w-2 h-2 rounded-sm ${sty.dot}`} />{c}<span className="text-gray-400">{catCounts[c]}</span>
              </button>
            )
          })}
          {catFilter.size > 0 && <button onClick={() => setCatFilter(new Set())} className="text-2xs text-gray-400 hover:text-gray-600 ml-0.5">전체</button>}
        </div>
      </div>

      {/* 날짜 눈금 헤더 */}
      <div className="flex items-stretch border-b border-gray-100 bg-gray-50/60">
        <div className="shrink-0 px-3 py-1.5 text-2xs font-semibold text-gray-400" style={{ width: LABEL_W }}>브랜드 · 구분</div>
        <div className="relative flex-1 h-7">
          {ticks.map(d => (
            <div key={d} className="absolute top-0 bottom-0 border-l border-gray-200/70" style={{ left: `${((d - 1) / daysInMonth) * 100}%` }}>
              <span className="absolute top-1 left-1 text-2xs text-gray-400">{d}일</span>
            </div>
          ))}
        </div>
      </div>

      {/* 본문 */}
      {brandRows.length === 0 ? (
        <div className="px-3 py-10 text-center text-gray-400 text-xs">이 달에 예정된 활동이 없습니다 · ◀ ▶ 로 다른 달을 확인하세요</div>
      ) : (
        <div className="relative">
          {/* 오늘 세로선 (전체 높이) */}
          {todayFrac !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
              style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${todayFrac})` }} />
          )}
          {brandRows.map(({ brand, count, lanes }) => (
            <div key={brand} className="border-b border-gray-100 last:border-b-0">
              {/* 브랜드 헤더 */}
              <div className="flex items-center gap-1.5 px-3 py-1" style={{ background: `${brandColor(brand)}0d` }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: brandColor(brand) }} />
                <span className="text-xs font-bold text-gray-800">{brand}</span>
                <span className="text-2xs text-gray-400">{count}건</span>
              </div>
              {/* 카테고리 레인 */}
              {lanes.map(({ cat, spans }) => {
                const trackCount = Math.max(1, ...spans.map(s => s.track + 1))
                const catSty = CATEGORY_STYLE[cat]
                return (
                  <div key={cat} className="flex items-stretch border-t border-gray-50">
                    <div className="shrink-0 flex items-center gap-1 px-3 py-1" style={{ width: LABEL_W }}>
                      <span className={`w-1.5 h-1.5 rounded-sm ${catSty.dot}`} />
                      <span className="text-2xs font-medium text-gray-600">{cat}</span>
                    </div>
                    <div className="relative flex-1" style={{ height: trackCount * BAR_H + 6 }}>
                      {/* 주 격자 */}
                      <div className="absolute inset-0 pointer-events-none">
                        {ticks.map(d => (
                          <div key={d} className="absolute top-0 bottom-0 border-l border-gray-50" style={{ left: `${((d - 1) / daysInMonth) * 100}%` }} />
                        ))}
                      </div>
                      {spans.map(({ a, left, width, contBefore, contAfter, track }) => (
                        <button
                          key={a.id}
                          onClick={() => onSelect(a)}
                          title={`[${a.type}] ${a.brand} · ${a.title}${a.product ? ` (${a.product})` : ''} · ${a.startDate}~${a.endDate}`}
                          className={`absolute rounded px-1.5 flex items-center gap-1 border-l-2 ${catSty.bar} ${catSty.bg} hover:brightness-95 transition overflow-hidden
                            ${a.status === '취소' ? 'opacity-40 line-through' : ''}`}
                          style={{ left: `${left * 100}%`, width: `${width * 100}%`, top: track * BAR_H + 3, height: BAR_H - 4 }}
                        >
                          {contBefore && <span className="text-gray-400 text-2xs shrink-0">◀</span>}
                          {a.hero && <span className="text-pink-500 text-2xs shrink-0 leading-none">★</span>}
                          <span className={`text-[10px] leading-tight truncate ${catSty.text}`}>{trunc(a.product || a.title, 18)}</span>
                          {a.count && <span className="text-[9px] text-rose-600 shrink-0 font-semibold">×{a.count}</span>}
                          {contAfter && <span className="text-gray-400 text-2xs shrink-0 ml-auto">▶</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50 text-2xs text-gray-400 flex-wrap">
        {CATEGORY_ORDER.map(c => (
          <span key={c} className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-sm ${CATEGORY_STYLE[c].dot}`} />{c}</span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="text-pink-500">★</span>주력</span>
        <span className="inline-flex items-center gap-1">◀▶ 이월(전·후월 연속)</span>
        <span className="ml-auto text-gray-300">막대 길이 = <b className="text-gray-400">행사 기간</b> · 겹치면 자동 줄바꿈</span>
      </div>
    </div>
  )
}
