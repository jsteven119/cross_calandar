'use client'

import { useState } from 'react'
import type { GTMActivity, Conflict, ChangeLogEntry } from '@/lib/types'
import { REGIONS } from '@/lib/types'
import {
  STATUS_STYLE, TYPE_STYLE, fmtDate, fmtRelTime, fmtYearMonth,
  category, CATEGORY_STYLE, fromMonthKey, intersectsMonth, parseYMD,
} from '@/lib/ui'

// ─── KPI 요약 스트립 (수치 + 해석 1줄 병기) ──────────────────────────────
// 회사 필수 룰: 모든 카드에 "의미 · 왜 중요 · 액션 힌트"를 함께 노출.
function daysUntil(endDate: string): number | null {
  const p = parseYMD(endDate)
  if (!p) return null
  const end = new Date(p.y, p.m - 1, p.d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((end - today) / 86400000)
}

export function KpiStrip({ activities, cursor, conflicts }: { activities: GTMActivity[]; cursor: number; conflicts: Conflict[] }) {
  const { m: curM } = fromMonthKey(cursor)
  const monthActs = activities.filter(a => intersectsMonth(a, cursor))
  const total = monthActs.length

  const newLaunch = monthActs.filter(a => a.type === '신상품' && a.status !== '취소').length
  const imminent = activities.filter(a => {
    if (a.status === '완료' || a.status === '취소') return false
    const d = daysUntil(a.endDate)
    return d !== null && d >= 0 && d <= 7
  }).length
  const planning = monthActs.filter(a => a.status === '기획').length
  const planningPct = total ? Math.round((planning / total) * 100) : 0
  const coverage = REGIONS.filter(r => monthActs.some(a => a.region === r)).length
  const gapRegions = REGIONS.filter(r => !monthActs.some(a => a.region === r))

  const cards = [
    {
      label: `당월 활동수 (${curM}월)`, value: total, unit: '건',
      tone: total ? 'text-gray-800' : 'text-gray-400',
      note: total ? '권역·브랜드 합산 진행·예정. 아래 간트에서 기간 겹침 확인' : '이달 등록 활동 없음 — 입력 누락 또는 비수기. 담당팀 확인',
    },
    {
      label: '당월 신상품 출시', value: newLaunch, unit: '건',
      tone: newLaunch ? 'text-blue-600' : 'text-gray-400',
      note: newLaunch ? '신제품 인지 집중 구간 — 주력이면 시딩·매체 지원 확인' : '이달 런칭 0건 — 신제품 파이프라인 공백 여부 점검',
    },
    {
      label: '임박 (종료 D-7·미완료)', value: imminent, unit: '건',
      tone: imminent ? 'text-rose-600' : 'text-gray-400',
      note: imminent ? '7일 내 종료 예정 미완료 — 마감 성과·정산 누락 위험. 최종 점검' : '임박 마감 없음 — 여유 있음',
    },
    {
      label: '상태미정 비율 (기획)', value: planningPct, unit: '%',
      tone: planningPct >= 50 ? 'text-amber-600' : 'text-gray-800',
      note: planningPct >= 50 ? `당월 ${planning}건이 기획 단계 — 실행 확정 지연. 확정 전환 독려` : '대부분 확정·진행 — 실행 안정권',
    },
    {
      label: '권역 커버리지', value: coverage, unit: '/4',
      tone: coverage === 4 ? 'text-green-600' : 'text-amber-600',
      note: coverage === 4 ? '4개 권역 모두 이달 활동 보유 — 공유 사각지대 없음' : `공백: ${gapRegions.join('·')} — 공유 사각지대. 담당자 확인`,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-col">
          <p className="text-xs text-gray-400">{c.label}</p>
          <p className={`text-3xl font-bold mt-0.5 ${c.tone}`}>
            {c.value}<span className="text-base font-medium text-gray-300 ml-0.5">{c.unit}</span>
          </p>
          <p className="text-2xs text-gray-400 mt-1.5 leading-snug">{c.note}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 변경/충돌 통합 패널 (탭 전환) — "실시간 변동 공유" 핵심 UI ──────────────
export function ChangeFeed({
  changeLog, conflicts, onPick, onSelect,
}: {
  changeLog: ChangeLogEntry[]
  conflicts: Conflict[]
  onPick: (product: string) => void
  onSelect: (a: GTMActivity) => void
}) {
  const [tab, setTab] = useState<'change' | 'conflict'>('change')
  const recent = changeLog.slice(0, 20)

  const tabs = [
    { id: 'change' as const, label: '변경', icon: '↻', count: changeLog.length, active: 'border-blue-500 text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    { id: 'conflict' as const, label: '충돌', icon: '⚡', count: conflicts.length, active: 'border-orange-500 text-orange-600', badge: conflicts.length ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50/60">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2
              ${tab === t.id ? `bg-white ${t.active}` : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100/60'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
            <span className={`text-2xs rounded-full px-1.5 py-0.5 font-semibold ${t.badge}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* 읽는 법 */}
      <div className="px-4 py-1.5 bg-gray-50/40 border-b border-gray-50">
        <p className="text-2xs text-gray-400">
          {tab === 'change'
            ? '시트 셀 변경 실시간 피드 — 다른 팀이 무엇을 바꿨는지 즉시 공유. 최신 20건'
            : '같은 제품이 다른 권역에서 기간 겹침 — 글로벌 동시 푸시 or 자기잠식. 클릭 시 해당 제품만 필터'}
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {tab === 'change' && (
          recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl text-gray-200">↻</span>
              <p className="text-xs text-gray-400">변경 기록 없음 · _변경로그 탭 미입력</p>
            </div>
          ) : recent.map((c, i) => (
            <div key={i} className="px-4 py-2.5 border-b border-gray-50 last:border-b-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-2xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{c.tab || '—'}</span>
                  <span className="text-2xs font-medium text-gray-700 truncate max-w-[160px]">{c.rowKey}</span>
                </span>
                <span className="text-2xs text-gray-400 shrink-0">{fmtRelTime(c.at) || c.at}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap text-2xs">
                <span className="text-gray-400">{c.column}:</span>
                <span className="text-gray-400 line-through">{c.before || '∅'}</span>
                <span className="text-gray-300">→</span>
                <span className="text-blue-700 font-medium">{c.after || '∅'}</span>
                {c.by && <span className="text-gray-300 ml-auto">by {c.by}</span>}
              </div>
            </div>
          ))
        )}

        {tab === 'conflict' && (
          conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl text-gray-200">✓</span>
              <p className="text-xs text-gray-400">겹치는 제품 일정 없음</p>
            </div>
          ) : conflicts.map(c => (
            <button key={c.product} onClick={() => onPick(c.product)}
              className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-b-0 group">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-800 group-hover:text-orange-700">{c.product}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.regions.map(r => (
                      <span key={r} className="text-2xs bg-orange-50 text-orange-600 border border-orange-100 rounded-full px-2 py-0.5">{r}</span>
                    ))}
                  </div>
                </div>
                <span className="text-2xs text-orange-500 shrink-0 mt-0.5 font-medium">{fmtDate(c.overlapStart)}~{fmtDate(c.overlapEnd)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── 당월 활동 목록 (현재 보는 달 · 브랜드별) ──────────────
const AT_BRAND_ORDER = ['바이오힐보', '웨이크메이크', '컬러그램', '브링그린', '올리브영']
const AT_BRAND_COLOR: Record<string, string> = {
  바이오힐보: '#7C3AED', 웨이크메이크: '#DC2626', 컬러그램: '#DB2777', 브링그린: '#16A34A', 올리브영: '#65A30D',
}

export function ActivityTable({ activities, cursor, onSelect }: { activities: GTMActivity[]; cursor: number; onSelect: (a: GTMActivity) => void }) {
  const { y: curY, m: curM } = fromMonthKey(cursor)

  const monthActs = activities
    .filter(a => intersectsMonth(a, cursor))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))

  const brands: { brand: string; acts: GTMActivity[] }[] = []
  monthActs.forEach(a => {
    const brand = a.brand || '기타'
    let g = brands.find(x => x.brand === brand)
    if (!g) { g = { brand, acts: [] }; brands.push(g) }
    g.acts.push(a)
  })
  brands.sort((x, y) =>
    (AT_BRAND_ORDER.indexOf(x.brand) < 0 ? 99 : AT_BRAND_ORDER.indexOf(x.brand)) -
    (AT_BRAND_ORDER.indexOf(y.brand) < 0 ? 99 : AT_BRAND_ORDER.indexOf(y.brand))
  )

  const carriedIn = (a: GTMActivity) => { const s = parseYMD(a.startDate); return !!s && (s.y * 12 + (s.m - 1)) < cursor }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-gray-500">📋</span>
        <h3 className="text-sm font-bold text-gray-800">당월 활동 목록</h3>
        <span className="text-2xs text-gray-400">{curY}년 {curM}월 · 브랜드별 · ◀ = 전월 이월</span>
        <span className="ml-auto text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{monthActs.length}건</span>
      </div>

      {monthActs.length === 0 ? (
        <div className="px-3 py-8 text-center text-gray-400 text-xs">{curM}월에 예정된 활동이 없습니다 (위 간트의 ◀ ▶ 로 달 이동)</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {brands.map(b => (
            <div key={b.brand}>
              <div className="flex items-center gap-1.5 px-4 py-1 bg-gray-50/70">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: AT_BRAND_COLOR[b.brand] ?? '#94a3b8' }} />
                <span className="text-2xs font-bold text-gray-700">{b.brand}</span>
                <span className="text-2xs text-gray-300">{b.acts.length}건</span>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-50">
                  {b.acts.map(a => {
                    const st = STATUS_STYLE[a.status]
                    const cat = category(a)
                    const catSty = CATEGORY_STYLE[cat]
                    return (
                      <tr key={a.id} onClick={() => onSelect(a)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="pl-6 pr-2 py-1.5 text-gray-400 whitespace-nowrap w-10 text-left">{a.region}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap w-16 text-left">
                          <span className={`text-2xs rounded px-1.5 py-0.5 ${catSty.chip}`}>{cat}</span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[260px] truncate text-left">
                          {a.hero && <span className="text-pink-500 mr-0.5">★</span>}
                          <span className="font-medium">{a.product || a.title}</span>
                          {a.product && a.title && a.title !== a.product && <span className="text-gray-400"> · {a.title}</span>}
                          {a.count && <span className="text-rose-500 text-2xs ml-1 font-semibold">×{a.count}</span>}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-left">
                          <span className="inline-flex items-center gap-1 text-gray-500 text-2xs">
                            <span className={`w-2 h-2 rounded-sm ${TYPE_STYLE[a.type] ?? 'bg-gray-400'}`} />{a.type}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap text-2xs text-left">
                          {carriedIn(a) && <span className="text-gray-300 mr-0.5">◀</span>}
                          {fmtDate(a.startDate)}~{fmtDate(a.endDate)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-left">
                          <span className={`text-2xs rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>{a.status}</span>
                        </td>
                        <td className="px-2 py-1.5 pr-4 text-gray-400 whitespace-nowrap text-2xs text-left">{a.owner}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 활동 상세 드로어 ──────────────────────────────
export function DetailDrawer({ activity, onClose }: { activity: GTMActivity | null; onClose: () => void }) {
  if (!activity) return null
  const st = STATUS_STYLE[activity.status]
  const rows: [string, string][] = [
    ['권역', activity.region],
    ['브랜드', activity.brand],
    ['유형', activity.type],
    ['EC/Retail', activity.retail],
    ['채널(파생)', activity.channel],
    ['제품', activity.product + (activity.hero ? ' ★주력' : '')],
    ['활동내용', activity.activity],
    ['건수', activity.count],
    ['기간', `${fmtYearMonth(activity.startDate)} ~ ${fmtYearMonth(activity.endDate)}`],
    ['상태', activity.status],
    ['예산', activity.budget],
    ['담당', [activity.team, activity.owner].filter(Boolean).join(' / ')],
  ]
  const m = activity.meta
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-2">
          <div>
            <span className={`text-2xs rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>{activity.status}</span>
            <h2 className="text-base font-bold text-gray-800 mt-1.5">{activity.title}</h2>
            <p className="text-2xs text-gray-400 mt-0.5">
              {activity.source === 'BM' ? 'BM 신상품 기획' : '활동'} · {activity.region}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {rows.map(([k, v]) => v && (
            <div key={k} className="flex text-xs">
              <span className="w-20 shrink-0 text-gray-400">{k}</span>
              <span className="text-gray-700">{v}</span>
            </div>
          ))}

          {activity.source === 'BM' && m && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 space-y-1.5">
              <p className="text-2xs text-blue-600 font-semibold">신상품 기획 (BM)</p>
              {([['출시가', m.price], ['핵심성분', m.ingredient], ['USP', m.usp], ['초도물량', m.moq], ['리뉴얼', m.renewal], ['비고', m.note]] as [string, string][])
                .map(([k, v]) => v && (
                  <div key={k} className="flex text-xs">
                    <span className="w-16 shrink-0 text-blue-400">{k}</span>
                    <span className="text-blue-900">{v}</span>
                  </div>
                ))}
            </div>
          )}

          {activity.updatedAt && (
            <p className="text-2xs text-gray-400 pt-2">
              최종 수정 {fmtRelTime(activity.updatedAt)} {activity.updatedBy && `· ${activity.updatedBy}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
