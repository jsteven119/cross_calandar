'use client'

import { useMemo, useState } from 'react'
import type { GTMData, GTMActivity } from '@/lib/types'
import { detectConflicts, collectIssues, recentChanges } from '@/lib/conflicts'
import { SwimlaneTimeline } from './SwimlaneTimeline'
import { Filters, FilterState, emptyFilter } from './Filters'
import { KpiStrip, AlertsPanel, DetailDrawer, ActivityTable } from './Panels'
import { SeedingBoard } from './SeedingBoard'
import { MonthMatrix } from './MonthMatrix'

export function GTMDashboard({ data, lastRefreshed }: { data: GTMData; lastRefreshed: Date }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter())
  const [selected, setSelected] = useState<GTMActivity | null>(null)

  // 필터 적용 (빈 Set = 전체)
  const filtered = useMemo(() => {
    return data.activities.filter(a => {
      if (filter.regions.size && !filter.regions.has(a.region)) return false
      if (filter.brands.size && !filter.brands.has(a.brand)) return false
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

  // 유형별 분리: 출시 / EC 프로모션 / 프로모션 마케팅
  const launches = filtered.filter(a => a.type === '신제품출시' || a.type === '리뉴얼')
  const promos = filtered.filter(a => a.type === '프로모션' || a.type === '채널행사')
  const marketing = filtered.filter(a => a.type === '캠페인')

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {data.year}년 · 전 브랜드·전 권역 마케팅 활동 통합 캘린더 · 구글시트 실시간 연동
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 데이터 신선도: 어디까지 입력됐는지 */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
            <span className="text-xs text-gray-400">📊</span>
            <span className="text-xs text-gray-600 font-medium">활동 {data.activities.length}건</span>
            {dataFresh && (
              <span className="text-xs text-gray-400">· 최근 입력 {dataFresh}</span>
            )}
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

      <KpiStrip data={data} conflicts={conflicts} issues={issues} />

      {/* 메인 레이아웃: 좌측 필터 사이드바 + 우측 콘텐츠 */}
      <div className="flex gap-4 items-start">
        {/* 좌측 필터 사이드바 */}
        <aside className="w-52 shrink-0 sticky top-4">
          <Filters data={data} filter={filter} setFilter={setFilter} />
          {filter.product && (
            <div className="mt-2 flex items-center gap-1.5 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 text-xs">
              <span className="text-pink-700 font-medium truncate">렌즈: {filter.product}</span>
              <button onClick={() => setFilter({ ...filter, product: null })} className="text-pink-400 hover:text-pink-600 shrink-0 ml-auto">✕</button>
            </div>
          )}
        </aside>

        {/* 우측 콘텐츠 — 첫 사용자 기준 순서: 전체 일정 → 신상품 → EC프로모션 → 마케팅 → 시딩 → 상세 */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 1) 메인 타임라인 = 전체 일정 한 눈에 (핵심 뷰) */}
          <SwimlaneTimeline
            data={data}
            activities={filtered}
            highlightProduct={filter.product}
            onSelect={setSelected}
          />

          {/* 2) 신상품 출시 — 브랜드별 가로 월간 */}
          <MonthMatrix title="신상품 출시 (브랜드별 월간)" icon="🆕" activities={launches} rowMode="brand" onSelect={setSelected} />

          {/* 3) EC 프로모션 — 브랜드·국가별 월간 (프로모션/채널행사만) */}
          <MonthMatrix title="EC 프로모션 (브랜드·국가별 월간)" icon="🛒" activities={promos} rowMode="brand-region" onSelect={setSelected} />

          {/* 4) 프로모션 마케팅 — 캠페인만 (프로모션과 분리) */}
          <MonthMatrix title="프로모션 마케팅 (브랜드·국가별 월간)" icon="📣" activities={marketing} rowMode="brand-region" onSelect={setSelected} />

          {/* 5) 인플루언서 시딩 스케줄 */}
          <SeedingBoard />

          {/* 활동 목록 + 알림 패널 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <ActivityTable activities={filtered} onSelect={setSelected} />
            </div>
            <div>
              <AlertsPanel
                conflicts={conflicts}
                issues={issues}
                changes={changes}
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
