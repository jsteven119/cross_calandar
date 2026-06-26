'use client'

import { useMemo, useState } from 'react'
import type { GTMData, GTMActivity } from '@/lib/types'
import { detectConflicts, collectIssues, recentChanges } from '@/lib/conflicts'
import { SwimlaneTimeline } from './SwimlaneTimeline'
import { Filters, FilterState, emptyFilter } from './Filters'
import { KpiStrip, ConflictPanel, IssueBoard, ChangeFeed, DetailDrawer, ActivityTable } from './Panels'

export function GTMDashboard({ data, lastRefreshed }: { data: GTMData; lastRefreshed: Date }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter())
  const [selected, setSelected] = useState<GTMActivity | null>(null)

  // 필터 적용 (빈 Set = 전체)
  const filtered = useMemo(() => {
    return data.activities.filter(a => {
      if (filter.regions.size && !filter.regions.has(a.region)) return false
      if (filter.types.size && !filter.types.has(a.type)) return false
      if (filter.statuses.size && !filter.statuses.has(a.status)) return false
      if (filter.heroOnly && !a.hero) return false
      return true
    })
  }, [data.activities, filter])

  // 충돌/이슈/변경은 전체 데이터 기준 (필터와 무관하게 항상 경고)
  const conflicts = useMemo(() => detectConflicts(data.activities), [data.activities])
  const issues = useMemo(() => collectIssues(data.activities), [data.activities])
  const changes = useMemo(() => recentChanges(data.activities), [data.activities])

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{data.year}년 · 전 권역 통합 뷰</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {lastRefreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-green-700 font-medium">실시간</span>
          </div>
        </div>
      </div>

      <KpiStrip data={data} conflicts={conflicts} issues={issues} />

      <Filters data={data} filter={filter} setFilter={setFilter} />

      {filter.product && (
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-pink-100 text-pink-700 rounded-full px-2.5 py-1">
            상품 렌즈: <b>{filter.product}</b>
          </span>
          <button onClick={() => setFilter({ ...filter, product: null })} className="text-gray-400 hover:text-gray-600">해제 ✕</button>
        </div>
      )}

      {/* 메인: 타임라인 + 사이드 패널 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <SwimlaneTimeline
            data={data}
            activities={filtered}
            highlightProduct={filter.product}
            onSelect={setSelected}
          />
          <ActivityTable activities={filtered} onSelect={setSelected} />
        </div>
        <div className="space-y-4">
          <ConflictPanel conflicts={conflicts} onPick={p => setFilter({ ...filter, product: p })} />
          <IssueBoard issues={issues} onSelect={setSelected} />
          <ChangeFeed changes={changes} onSelect={setSelected} />
        </div>
      </div>

      <DetailDrawer activity={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
