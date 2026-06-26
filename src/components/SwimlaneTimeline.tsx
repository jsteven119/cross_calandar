'use client'

import { useMemo } from 'react'
import type { GTMData, GTMActivity, Region } from '@/lib/types'
import { dateToYearFraction, fmtDate, MONTH_LABELS, TYPE_STYLE, STATUS_STYLE } from '@/lib/ui'

interface Props {
  data: GTMData
  activities: GTMActivity[]
  highlightProduct: string | null
  onSelect: (a: GTMActivity) => void
}

// 한 권역(레인) 안에서 막대가 겹치지 않도록 트랙(행) 배치
function layoutLane(acts: GTMActivity[], year: number) {
  const sorted = [...acts].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  const tracks: { end: number }[] = []
  return sorted.map(a => {
    const s = dateToYearFraction(a.startDate, year)
    const e = Math.max(dateToYearFraction(a.endDate, year), s + 0.012)
    let track = tracks.findIndex(t => t.end <= s)
    if (track === -1) { track = tracks.length; tracks.push({ end: e }) }
    else tracks[track].end = e
    return { a, s, e, track }
  })
}

export function SwimlaneTimeline({ data, activities, highlightProduct, onSelect }: Props) {
  const year = data.year
  const currentFrac = useMemo(() => {
    const now = new Date()
    if (now.getFullYear() !== year) return null
    return dateToYearFraction(now.toISOString().slice(0, 10), year)
  }, [year])

  const lanes = useMemo(() => {
    return data.regions.map(region => {
      const acts = activities.filter(a => a.region === region.name)
      const laid = layoutLane(acts, year)
      const trackCount = Math.max(1, ...laid.map(l => l.track + 1))
      return { region, laid, trackCount }
    })
  }, [data.regions, activities, year])

  const TRACK_H = 40   // 트랙(행) 높이
  const BAR_H = 34     // 막대 높이

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* 월 헤더 */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="w-28 shrink-0 px-4 py-2.5 text-sm font-semibold text-gray-500 border-r border-gray-200">
          권역
        </div>
        <div className="relative flex-1 grid grid-cols-12">
          {MONTH_LABELS.map((m, i) => (
            <div key={i} className="text-center text-xs text-gray-400 py-2.5 border-r border-gray-100 last:border-r-0">
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* 레인 */}
      <div className="relative">
        {/* 오늘 세로선 (라벨 칼럼 7rem 이후 영역 기준) */}
        {currentFrac !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
            style={{ left: `calc(7rem + (100% - 7rem) * ${currentFrac})` }}
          />
        )}

        {lanes.map(({ region, laid, trackCount }) => (
          <div key={region.name} className="flex border-b border-gray-100 last:border-b-0">
            <div className="w-28 shrink-0 px-4 py-3 border-r border-gray-200 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: region.color }} />
              <span className="text-sm font-semibold text-gray-700 truncate">{region.name}</span>
            </div>

            <div
              className="relative flex-1"
              style={{ height: `${trackCount * TRACK_H + 12}px` }}
            >
              {/* 월 격자 */}
              <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="border-r border-gray-50 last:border-r-0" />
                ))}
              </div>

              {laid.map(({ a, s, e, track }) => {
                const dimmed = highlightProduct && a.product !== highlightProduct
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a)}
                    title={`${a.title} (${fmtDate(a.startDate)}~${fmtDate(a.endDate)})`}
                    className={`absolute rounded-md px-2 flex items-center gap-1 text-xs text-white font-medium
                      shadow-sm hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-all overflow-hidden
                      ${TYPE_STYLE[a.type] ?? 'bg-gray-400'}
                      ${dimmed ? 'opacity-20' : 'opacity-95'}
                      ${a.status === '취소' ? 'line-through opacity-40' : ''}`}
                    style={{
                      left: `${s * 100}%`,
                      width: `${(e - s) * 100}%`,
                      height: `${BAR_H}px`,
                      top: `${track * TRACK_H + 6}px`,
                    }}
                  >
                    {a.hero && <span className="shrink-0">★</span>}
                    <span className="truncate">{a.title}</span>
                    {a.issue && <span className="shrink-0 text-red-200">⚠</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
        {Object.entries(TYPE_STYLE).map(([type, cls]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${cls}`} />{type}
          </span>
        ))}
        <span className="flex items-center gap-1.5">★ 주력상품</span>
        <span className="flex items-center gap-1.5 text-red-400">⚠ 이슈</span>
      </div>
    </div>
  )
}
