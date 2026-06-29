'use client'

import { useState } from 'react'
import type { GTMActivity, Conflict, GTMData, Region } from '@/lib/types'
import { STATUS_STYLE, RISK_STYLE, TYPE_STYLE, fmtDate, fmtRelTime } from '@/lib/ui'

// ─── KPI 요약 스트립 ──────────────────────────────
export function KpiStrip({ data, conflicts, issues }: { data: GTMData; conflicts: Conflict[]; issues: GTMActivity[] }) {
  const live = data.activities.filter(a => a.status === '진행중').length
  const heroLaunch = data.activities.filter(a => a.hero && a.type === '신제품출시' && a.status !== '취소').length
  const highRisk = issues.filter(i => i.riskLevel === '상').length

  const cards = [
    { label: '진행중 활동', value: live, tone: 'text-green-600' },
    { label: '주력 런칭', value: heroLaunch, tone: 'text-pink-600' },
    { label: '상품 충돌', value: conflicts.length, tone: conflicts.length ? 'text-orange-600' : 'text-gray-400' },
    { label: '고위험 이슈', value: highRisk, tone: highRisk ? 'text-red-600' : 'text-gray-400' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3.5">
          <p className="text-xs text-gray-400">{c.label}</p>
          <p className={`text-3xl font-bold mt-0.5 ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 알림·모니터링 통합 패널 (탭) ──────────────────────────────
interface AlertsPanelProps {
  conflicts: Conflict[]
  issues: GTMActivity[]
  changes: GTMActivity[]
  onPick: (product: string) => void
  onSelect: (a: GTMActivity) => void
}

export function AlertsPanel({ conflicts, issues, changes, onPick, onSelect }: AlertsPanelProps) {
  const [tab, setTab] = useState<'conflict' | 'issue' | 'change'>('issue')

  const tabs = [
    {
      id: 'conflict' as const,
      label: '충돌',
      icon: '⚡',
      count: conflicts.length,
      activeColor: 'border-orange-500 text-orange-600',
      badgeColor: conflicts.length ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400',
    },
    {
      id: 'issue' as const,
      label: '이슈',
      icon: '⚠',
      count: issues.length,
      activeColor: 'border-red-500 text-red-600',
      badgeColor: issues.length ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400',
    },
    {
      id: 'change' as const,
      label: '변경',
      icon: '↻',
      count: changes.length,
      activeColor: 'border-blue-500 text-blue-600',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200 bg-gray-50/60">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2
              ${tab === t.id
                ? `bg-white ${t.activeColor}`
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100/60'
              }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className={`text-2xs rounded-full px-1.5 py-0.5 font-semibold ${t.badgeColor}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="max-h-80 overflow-y-auto">
        {/* 충돌 탭 */}
        {tab === 'conflict' && (
          <>
            {conflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
                <span className="text-3xl">✓</span>
                <p className="text-xs text-gray-400">겹치는 주력상품 일정 없음</p>
              </div>
            ) : conflicts.map(c => (
              <button
                key={c.product}
                onClick={() => onPick(c.product)}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-b-0 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-orange-700 transition-colors">{c.product}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.regions.map(r => (
                        <span key={r} className="text-2xs bg-orange-50 text-orange-600 border border-orange-100 rounded-full px-2 py-0.5">{r}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-2xs text-orange-500 shrink-0 mt-0.5 font-medium">{fmtDate(c.overlapStart)}~{fmtDate(c.overlapEnd)}</span>
                </div>
              </button>
            ))}
          </>
        )}

        {/* 이슈 탭 */}
        {tab === 'issue' && (
          <>
            {issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl text-gray-200">✓</span>
                <p className="text-xs text-gray-400">등록된 이슈 없음</p>
              </div>
            ) : issues.map(a => {
              const risk = RISK_STYLE[a.riskLevel] ?? RISK_STYLE['하']
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className="w-full text-left px-4 py-3 hover:bg-red-50/60 transition-colors border-b border-gray-50 last:border-b-0 group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-2xs font-bold rounded-full px-2 py-0.5 shrink-0 ${risk.bg} ${risk.text}`}>{risk.label}</span>
                    <span className="text-2xs text-gray-400 shrink-0">{a.region} · {a.brand}</span>
                    {a.hero && <span className="text-2xs text-pink-500 shrink-0">★</span>}
                  </div>
                  <p className="text-xs font-medium text-gray-700 truncate group-hover:text-red-700 transition-colors">{a.product}</p>
                  <p className="text-2xs text-gray-400 mt-0.5 truncate">{a.issue}</p>
                </button>
              )
            })}
          </>
        )}

        {/* 변경 탭 */}
        {tab === 'change' && (
          <>
            {changes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl text-gray-200">↻</span>
                <p className="text-xs text-gray-400">최근 변경 없음</p>
              </div>
            ) : changes.map(a => {
              const st = STATUS_STYLE[a.status]
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-gray-50 last:border-b-0 group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-2xs text-gray-400">{a.region} · {a.brand}</span>
                    <span className="text-2xs text-gray-400 shrink-0">{fmtRelTime(a.updatedAt)}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-700 truncate group-hover:text-blue-700 transition-colors">{a.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-2xs rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>{a.status}</span>
                    {a.updatedBy && <span className="text-2xs text-gray-400">by {a.updatedBy}</span>}
                  </div>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ─── (레거시 export — GTMDashboard 외부 사용 시 호환용) ─────────
export function ConflictPanel({ conflicts, onPick }: { conflicts: Conflict[]; onPick: (product: string) => void }) {
  return <AlertsPanel conflicts={conflicts} issues={[]} changes={[]} onPick={onPick} onSelect={() => {}} />
}
export function IssueBoard({ issues, onSelect }: { issues: GTMActivity[]; onSelect: (a: GTMActivity) => void }) {
  return <AlertsPanel conflicts={[]} issues={issues} changes={[]} onPick={() => {}} onSelect={onSelect} />
}
export function ChangeFeed({ changes, onSelect }: { changes: GTMActivity[]; onSelect: (a: GTMActivity) => void }) {
  return <AlertsPanel conflicts={[]} issues={[]} changes={changes} onPick={() => {}} onSelect={onSelect} />
}

// ─── 권역별 EC 프로모션 보드 (권역 × EC채널 정리) ──────────────
export function ECPromotionBoard({ regions, activities, onSelect }: { regions: Region[]; activities: GTMActivity[]; onSelect: (a: GTMActivity) => void }) {
  // 프로모션성 활동만 (프로모션/채널행사/캠페인/신제품출시)
  const PROMO_TYPES = new Set(['프로모션', '채널행사', '캠페인', '신제품출시'])
  const promo = activities.filter(a => PROMO_TYPES.has(a.type))

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-purple-500">🛒</span>
        <h3 className="text-sm font-bold text-gray-800">권역별 EC 프로모션</h3>
        <span className="ml-auto text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{promo.length}건</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y xl:divide-y-0 xl:divide-x divide-gray-100">
        {regions.map(region => {
          const regionActs = promo.filter(a => a.region === region.name)
          // EC 채널별 그룹화
          const byChannel = new Map<string, GTMActivity[]>()
          regionActs.forEach(a => {
            const ch = a.channel || '기타'
            if (!byChannel.has(ch)) byChannel.set(ch, [])
            byChannel.get(ch)!.push(a)
          })
          const channels = Array.from(byChannel.entries())
          return (
            <div key={region.name} className="p-3 min-h-[120px]">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: region.color }} />
                <span className="text-xs font-bold text-gray-700">{region.name}</span>
                <span className="text-2xs text-gray-400">{regionActs.length}</span>
              </div>
              {channels.length === 0 && <p className="text-2xs text-gray-300">예정 없음</p>}
              <div className="space-y-2">
                {channels.map(([ch, acts]) => (
                  <div key={ch}>
                    <p className="text-2xs font-semibold text-gray-500 mb-0.5">{ch}</p>
                    <div className="space-y-1">
                      {acts.sort((a, b) => (a.startDate < b.startDate ? -1 : 1)).map(a => (
                        <button
                          key={a.id}
                          onClick={() => onSelect(a)}
                          className="w-full text-left rounded-md border border-gray-100 hover:border-purple-300 hover:bg-purple-50 px-2 py-1.5 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_STYLE[a.type] ?? 'bg-gray-400'}`} />
                            {a.hero && <span className="text-pink-500 text-2xs shrink-0">★</span>}
                            <span className="text-2xs font-medium text-gray-700 truncate">{a.title}</span>
                            {a.issue && <span className="text-red-400 text-2xs shrink-0">⚠</span>}
                          </div>
                          <div className="flex items-center justify-between mt-0.5 pl-2.5">
                            <span className="text-2xs text-gray-400">{a.brand}</span>
                            <span className="text-2xs text-gray-400">{fmtDate(a.startDate)}~{fmtDate(a.endDate)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 전체 활동 목록 (타임라인 하단 리스트 뷰) ──────────────
export function ActivityTable({ activities, onSelect }: { activities: GTMActivity[]; onSelect: (a: GTMActivity) => void }) {
  const LIMIT = 30
  const [expanded, setExpanded] = useState(false)
  const sorted = [...activities].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
  const shown = expanded ? sorted : sorted.slice(0, LIMIT)
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-gray-500">📋</span>
        <h3 className="text-sm font-bold text-gray-800">전체 활동 목록</h3>
        <span className="ml-auto text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
          {sorted.length > LIMIT && !expanded ? `${LIMIT} / ${sorted.length}건` : `${sorted.length}건`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-left">
              <th className="font-medium px-3 py-2">권역</th>
              <th className="font-medium px-3 py-2">브랜드</th>
              <th className="font-medium px-3 py-2">상품</th>
              <th className="font-medium px-3 py-2">활동명</th>
              <th className="font-medium px-3 py-2">유형</th>
              <th className="font-medium px-3 py-2 whitespace-nowrap">기간</th>
              <th className="font-medium px-3 py-2">상태</th>
              <th className="font-medium px-3 py-2">담당</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">표시할 활동이 없습니다</td></tr>
            )}
            {shown.map(a => {
              const st = STATUS_STYLE[a.status]
              const type = TYPE_STYLE[a.type] ?? 'bg-gray-400'
              return (
                <tr key={a.id} onClick={() => onSelect(a)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{a.region}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{a.brand}</td>
                  <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    {a.hero && <span className="text-pink-500 mr-0.5">★</span>}{a.product}
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">
                    {a.title}
                    {a.issue && <span className="text-red-400 ml-1">⚠</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-gray-500`}>
                      <span className={`w-2 h-2 rounded-sm ${type}`} />{a.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(a.startDate)}~{fmtDate(a.endDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`text-2xs rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>{a.status}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{a.owner}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > LIMIT && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2 text-2xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100"
        >
          {expanded ? '접기 ▲' : `전체 ${sorted.length}건 보기 ▼`}
        </button>
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
    ['세부 시장', activity.market],
    ['상품', activity.product + (activity.hero ? ' ★주력' : '')],
    ['유형', activity.type],
    ['기간', `${fmtDate(activity.startDate)} ~ ${fmtDate(activity.endDate)}`],
    ['채널', activity.channel],
    ['예산', activity.budget],
    ['담당', `${activity.team} / ${activity.owner}`],
  ]
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-2">
          <div>
            <span className={`text-2xs rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>{activity.status}</span>
            <h2 className="text-base font-bold text-gray-800 mt-1.5">{activity.title}</h2>
            <p className="text-2xs text-gray-400 mt-0.5">{activity.id}</p>
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
          {activity.issue && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-2xs text-red-500 font-medium mb-0.5">
                이슈 {activity.riskLevel && `· 위험도 ${(RISK_STYLE[activity.riskLevel] ?? {label:''}).label}`}
              </p>
              <p className="text-xs text-red-800">{activity.issue}</p>
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
