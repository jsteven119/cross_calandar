'use client'

import { useMemo, useState, useEffect } from 'react'
import type { GTMData, GTMActivity } from '@/lib/types'
import { detectConflicts } from '@/lib/conflicts'
import { pickInitialMonth, monthKey, fromMonthKey } from '@/lib/ui'
import { MonthGantt } from './MonthGantt'
import { Filters, FilterState, emptyFilter } from './Filters'
import { KpiStrip, ChangeFeed, DetailDrawer, ActivityTable } from './Panels'
import { FocusProductStrip } from './FocusProductStrip'
import { BrandMatrix } from './BrandMatrix'

const startMonthOf = (d: string): number | null => {
  const m = (d || '').match(/^\d{4}\D+(\d{1,2})/)
  return m ? +m[1] : null
}

export function GTMDashboard({ data, lastRefreshed }: { data: GTMData; lastRefreshed: Date }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter())
  const [selected, setSelected] = useState<GTMActivity | null>(null)
  // 간트·당월목록·KPI·주력상품이 공유하는 "보는 달"
  const [monthCursor, setMonthCursor] = useState<number>(() => pickInitialMonth(data.activities))

  // 사이드바 '월' 필터를 켜면 간트도 그 달로 이동 (빈 화면 방지)
  useEffect(() => {
    if (filter.months.size === 0) return
    const curM = fromMonthKey(monthCursor).m
    if (!filter.months.has(curM)) {
      const target = Math.min(...Array.from(filter.months))
      setMonthCursor(monthKey(data.year, target))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.months])

  // 필터 적용 (빈 Set = 전체)
  const filtered = useMemo(() => {
    return data.activities.filter(a => {
      if (filter.regions.size && !filter.regions.has(a.region)) return false
      if (filter.brands.size && !filter.brands.has(a.brand)) return false
      if (filter.retails.size && !filter.retails.has(a.retail)) return false
      if (filter.types.size && !filter.types.has(a.type)) return false
      if (filter.teams.size && !filter.teams.has(a.team)) return false
      if (filter.statuses.size && !filter.statuses.has(a.status)) return false
      if (filter.months.size) { const mo = startMonthOf(a.startDate); if (mo === null || !filter.months.has(mo)) return false }
      if (filter.heroOnly && !a.hero) return false
      if (filter.product && a.product !== filter.product) return false
      return true
    })
  }, [data.activities, filter])

  // 충돌은 전체 데이터 기준 (필터와 무관하게 항상 경고)
  const conflicts = useMemo(() => detectConflicts(data.activities), [data.activities])

  // 데이터 최신 입력시각 (시트의 가장 최근 수정 기록). ISO면 보기 좋게 변환.
  const dataFresh = (() => {
    const s = data.lastUpdated || ''
    if (s.includes('T')) {
      const d = new Date(s)
      return isNaN(d.getTime()) ? s : d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
    return s
  })()
  const isSample = data.title.includes('샘플')

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">GTM 캘린더</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            전 VC 국내·미국·중국·일본 권역별 프로모션/마케팅/신상품 인지 캘린더 — 구글시트 실시간 연동
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
            <span className="text-xs text-gray-400">📊</span>
            <span className="text-xs text-gray-600 font-medium">활동 {data.activities.length}건</span>
            {dataFresh && <span className="text-xs text-gray-400">· 최근 입력 {dataFresh}</span>}
          </div>
          {isSample ? (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              <span className="text-xs text-amber-700 font-medium">⚠ 샘플 데이터</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-green-700 font-medium">실시간 연동</span>
            </div>
          )}
          <span className="text-xs text-gray-300">
            새로고침 {lastRefreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* KPI (당월 · 수치+해석) */}
      <KpiStrip activities={data.activities} cursor={monthCursor} conflicts={conflicts} />

      {/* 이달의 주력상품 (주력상품 탭 기반) */}
      <FocusProductStrip focusProducts={data.focusProducts} activities={data.activities} cursor={monthCursor} />

      {/* 메인 레이아웃: 좌측 필터 사이드바 + 우측 콘텐츠 */}
      <div className="flex gap-4 items-start">
        <aside className="w-52 shrink-0 sticky top-4">
          <Filters data={data} filter={filter} setFilter={setFilter} />
          {filter.product && (
            <div className="mt-2 flex items-center gap-1.5 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 text-xs">
              <span className="text-pink-700 font-medium truncate">렌즈: {filter.product}</span>
              <button onClick={() => setFilter({ ...filter, product: null })} className="text-pink-400 hover:text-pink-600 shrink-0 ml-auto">✕</button>
            </div>
          )}
        </aside>

        {/* 우측 콘텐츠: 월 간트 → 브랜드 매트릭스 → 당월목록 + 변경/충돌 피드 */}
        <div className="flex-1 min-w-0 space-y-4">
          <MonthGantt activities={filtered} cursor={monthCursor} setCursor={setMonthCursor} onSelect={setSelected} />
          <BrandMatrix activities={filtered} onSelect={setSelected} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <ActivityTable activities={filtered} cursor={monthCursor} onSelect={setSelected} />
            </div>
            <div>
              <ChangeFeed
                changeLog={data.changeLog}
                conflicts={conflicts}
                onPick={p => setFilter({ ...filter, product: p })}
                onSelect={setSelected}
              />
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer activity={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
