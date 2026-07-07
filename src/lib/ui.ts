import type { ActivityStatus, ActivityType, Channel, GTMActivity } from './types'

// ─── 활동 카테고리 (상품 / 온라인 / 오프라인) — 모든 뷰 공통 단일 소스 ───
export type Category = '상품' | '온라인' | '오프라인'

// EC/Retail 값 → 온/오프라인 파생. 오프라인 리테일만 화이트리스트, 빈값은 미분류('').
const OFFLINE_RETAIL = /@?cosme|loft|로프트|돈키|세포라|sephora/i
export function retailChannel(retail: string): Channel {
  const s = (retail || '').trim()
  if (!s) return ''
  if (OFFLINE_RETAIL.test(s)) return '오프라인'
  return '온라인'
}

// 카테고리: 신상품=상품, 그 외는 retail 파생 채널(오프라인/온라인). 채널 미분류는 온라인으로.
export function category(a: GTMActivity): Category {
  if (a.type === '신상품') return '상품'
  const ch = a.channel || retailChannel(a.retail)
  return ch === '오프라인' ? '오프라인' : '온라인'
}

export const CATEGORY_STYLE: Record<Category, { dot: string; bar: string; bg: string; text: string; chip: string }> = {
  '상품':   { dot: 'bg-blue-500',  bar: 'border-l-blue-400',  bg: 'bg-blue-50',  text: 'text-blue-700',  chip: 'bg-blue-100 text-blue-700' },
  '온라인': { dot: 'bg-amber-500', bar: 'border-l-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700' },
  '오프라인': { dot: 'bg-pink-500', bar: 'border-l-pink-400',  bg: 'bg-pink-50',  text: 'text-pink-700',  chip: 'bg-pink-100 text-pink-700' },
}

export const CATEGORY_ORDER: Category[] = ['상품', '온라인', '오프라인']

// ─── 월(月) 공통 헬퍼 — 간트·당월목록·대시보드 공유 (v1 로직 유지) ───
export function parseYMD(d: string): { y: number; m: number; d: number } | null {
  const m = (d || '').match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
}
export const monthKey = (y: number, m: number) => y * 12 + (m - 1)
export const fromMonthKey = (k: number) => ({ y: Math.floor(k / 12), m: (k % 12) + 1 })

// 활동이 해당 월(monthKey)에 걸쳐 있는지 (시작~종료가 그 달과 교차)
export function intersectsMonth(a: GTMActivity, curKey: number): boolean {
  const s = parseYMD(a.startDate); if (!s) return false
  const e = parseYMD(a.endDate) || s
  const sKey = monthKey(s.y, s.m), eKey = monthKey(e.y, e.m)
  return sKey <= curKey && eKey >= curKey
}

// 초기 표시 달: 데이터가 있는 달 중 (오늘 달 → 이후 가장 가까운 달 → 마지막 달)
export function pickInitialMonth(activities: GTMActivity[]): number {
  const keys = activities.map(a => parseYMD(a.startDate)).filter(Boolean).map(p => monthKey(p!.y, p!.m))
  const now = new Date()
  const todayKey = monthKey(now.getFullYear(), now.getMonth() + 1)
  if (!keys.length) return todayKey
  const uniq = Array.from(new Set(keys)).sort((a, b) => a - b)
  if (uniq.includes(todayKey)) return todayKey
  return uniq.find(k => k >= todayKey) ?? uniq[uniq.length - 1]
}

export const STATUS_STYLE: Record<ActivityStatus, { bg: string; text: string; dot: string }> = {
  '기획':   { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  '확정':   { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  '진행중': { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  '완료':   { bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400' },
  '보류':   { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  '취소':   { bg: 'bg-red-50',     text: 'text-red-400',    dot: 'bg-red-300' },
}

// 유형 색 3종 — 범례/막대/칩 공통
export const TYPE_STYLE: Record<ActivityType, string> = {
  '신상품':   'bg-blue-500',
  '프로모션': 'bg-amber-500',
  '마케팅':   'bg-pink-500',
}
export const TYPE_ORDER: ActivityType[] = ['신상품', '프로모션', '마케팅']

export function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// YYYY-MM 표기 (기간 라벨용)
export function fmtYearMonth(dateStr: string): string {
  const p = parseYMD(dateStr)
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}` : (dateStr || '')
}

export function fmtRelTime(iso: string): string {
  if (!iso) return ''
  // "2026-07-06 14:32" 형태도 흡수 (공백→T)
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).getTime()
  if (isNaN(then)) return iso
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 0) return iso
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
