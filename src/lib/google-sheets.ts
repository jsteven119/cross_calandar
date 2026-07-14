import type {
  GTMData, GTMActivity, ActivityType, ActivityStatus, Region, RegionMeta,
  FocusProduct, ChangeLogEntry, BMMeta,
} from './types'
import { REGIONS } from './types'
import { retailChannel } from './ui'

// ─── 공개 구글시트(링크 보기)를 서비스계정 없이 CSV로 직접 읽음 ───
// v2: 활동 탭 4개(국내/미국/중국/일본) + BM + 주력상품 + _변경로그 = 7개 병렬 fetch.
// 탭이 아직 없거나 비공개면 조용히 skip. 전체 0건이면 샘플 폴백.
const DEFAULT_SHEET_ID = '1Q_JypC7SG9NuvD_gzwFSioWlUAo2jJJVwya-NPkIShI'
const SHEET_ID = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID

const ACTIVITY_TABS: Region[] = ['국내', '미국', '영국', '중국', '일본']
const BM_TAB = 'BM'
const FOCUS_TAB = '주력상품'
const CHANGELOG_TAB = '_변경로그'

const DEFAULT_REGIONS: RegionMeta[] = [
  { name: '국내', color: '#ec4899', order: 0 },
  { name: '미국', color: '#3b82f6', order: 1 },
  { name: '영국', color: '#0ea5e9', order: 2 },
  { name: '중국', color: '#ef4444', order: 3 },
  { name: '일본', color: '#8b5cf6', order: 4 },
]

// ── 헤더 별칭 — 신(v2) 라벨 전용. 구 라벨(매체/미디어/목적/이슈/리스크/채널/시작일/종료일)은 제거 ──
const ACT_ALIASES: Record<string, string[]> = {
  type:       ['유형', 'type'],
  brand:      ['브랜드', 'brand'],
  retail:     ['ec/retail', 'retail/ec', 'retail', 'ec', '리테일'],
  title:      ['행사명', 'title', '제목'],
  product:    ['제품', 'product', '상품'],
  hero:       ['주력', 'hero'],
  activity:   ['활동내용', '활동', 'activity'],
  count:      ['건수', '건', 'count'],
  startMonth: ['시작월', 'startmonth', '시작'],
  endMonth:   ['종료월', 'endmonth', '종료'],
  status:     ['상태', 'status'],
  budget:     ['예산', 'budget'],
  team:       ['담당팀', 'team', '팀'],
  owner:      ['담당자', 'owner'],
  updatedAt:  ['수정일시', 'updatedat'],
  updatedBy:  ['수정자', 'updatedby'],
}

const BM_ALIASES: Record<string, string[]> = {
  brand:        ['브랜드', 'brand'],
  product:      ['제품', 'product'],
  launchMonth:  ['출시월', 'launchmonth'],
  targetRegion: ['타겟권역', '타겟', '권역'],
  price:        ['출시가', '가격', 'price'],
  ingredient:   ['핵심성분', '성분', 'ingredient'],
  usp:          ['usp'],
  moq:          ['초도물량', '초도', '물량', 'moq'],
  renewal:      ['리뉴얼여부', '리뉴얼', 'renewal'],
  note:         ['비고', 'note'],
  status:       ['상태', 'status'],
  team:         ['담당팀', 'team'],
  owner:        ['담당자', 'owner'],
  updatedAt:    ['수정일시', 'updatedat'],
  updatedBy:    ['수정자', 'updatedby'],
}

const CHLOG_ALIASES: Record<string, string[]> = {
  at:     ['일시', '시각', 'datetime', 'at'],
  tab:    ['탭', 'tab'],
  rowKey: ['행식별', '행', 'rowkey'],
  column: ['컬럼', '열', 'column'],
  before: ['이전값', '이전', 'before'],
  after:  ['새값', '신규값', 'after'],
  by:     ['수정자', 'by'],
}

// 유형 정규화 — 신상품/프로모션/마케팅 3종, 이외는 프로모션
function normType(v: string): ActivityType {
  const s = v.trim()
  if (s === '신상품' || s === '신제품' || s === '신제품출시' || s === '출시') return '신상품'
  if (s === '마케팅') return '마케팅'
  return '프로모션'
}

// 주력(hero) 제품 위계 — 브랜드별 패턴(v1 유지). 제품/행사명 매칭 시 hero
const HERO_PATTERNS: Record<string, RegExp> = {
  '바이오힐보': /아사[츄추]|요루탄|3D\s*크림|3d크림|탄력\s*크림|콜라겐\s*겔?\s*미스트|(NAD|엔에이디|콜라겐)\s*아이\s*크림/i,
  '웨이크메이크': /소프트\s*블러링|소블아|심리스\s*(파운데이션|파데)|쉐이킹\s*블러|볼드\s*블러/i,
  '컬러그램': /컬러?\s*커버\s*틴트|컬커버|커버틴트|딥\s*글레이즈|딥글/i,
}
function isHeroProduct(brand: string, text: string): boolean {
  const re = HERO_PATTERNS[(brand || '').trim()]
  return re ? re.test(text || '') : false
}

function txt(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}
function toBool(v: string): boolean {
  const s = v.toLowerCase()
  return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'o'
}

// ── 시작월/종료월 파서 — "2026-08" / "2026.8" / "2026년 8월" / "8월"(연도생략=올해) ──
export function parseYM(v: string): { y: number; m: number } | null {
  const s = txt(v)
  if (!s) return null
  // 연도 포함: 2026-08 / 2026.8 / 2026년 8월 / 2026/8
  const full = s.match(/(\d{4})\D+(\d{1,2})/)
  if (full) {
    const m = +full[2]
    if (m >= 1 && m <= 12) return { y: +full[1], m }
  }
  // 연도 생략: "8월" / "8" → 올해
  const only = s.match(/^\D*(\d{1,2})\s*월?\D*$/)
  if (only) {
    const m = +only[1]
    if (m >= 1 && m <= 12) return { y: new Date().getFullYear(), m }
  }
  return null
}
const pad = (n: number) => String(n).padStart(2, '0')
const firstISO = (y: number, m: number) => `${y}-${pad(m)}-01`
const lastISO = (y: number, m: number) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`

// ── CSV 파서 (따옴표·콤마·개행·"" 이스케이프) — v1 그대로 재사용 ──
function parseCsv(t: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], f = '', q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++ } else q = false }
      else f += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(f); f = ''
      if (row.some(v => v !== '')) rows.push(row)
      row = []
    } else f += c
  }
  if (f !== '' || row.length) { row.push(f); if (row.some(v => v !== '')) rows.push(row) }
  return rows
}

function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {}
  header.forEach((h, i) => { idx[txt(h).toLowerCase()] = i })
  return idx
}
// 헤더에 해당 필드(별칭 중 하나)가 존재하는지 — 스키마 시그니처 검사용.
// gviz는 없는 탭 이름에 대해 '기본(첫) 시트'를 CSV로 되돌려주므로, HTML 검사만으로는
// 미생성 탭을 걸러낼 수 없다. v2 전용 컬럼(예: 시작월/출시월) 유무로 오탭을 skip.
function headerHas(header: string[], aliases: string[]): boolean {
  const idx = headerIndex(header)
  return aliases.some(a => idx[a.toLowerCase()] !== undefined)
}
function makeGetter(header: string[], aliases: Record<string, string[]>) {
  const idx = headerIndex(header)
  const colCache: Record<string, number> = {}
  for (const field in aliases) {
    colCache[field] = -1
    for (const a of aliases[field]) { const p = idx[a.toLowerCase()]; if (p !== undefined) { colCache[field] = p; break } }
  }
  return (r: string[], field: string): string => {
    const p = colCache[field]
    return p >= 0 ? txt(r[p]) : ''
  }
}

// 탭 하나의 CSV 행렬. 비공개/없음/빈/HTML 응답 탭은 null(조용히 skip).
async function fetchTabRows(tab: string): Promise<string[][] | null> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    if (/^\s*(<!DOCTYPE html|<html)/i.test(text.slice(0, 200))) return null
    const rows = parseCsv(text)
    return rows.length >= 2 ? rows : null
  } catch {
    return null
  }
}

// ── 활동 탭 → GTMActivity[] ──
function parseActivityTab(region: Region, rows: string[][]): GTMActivity[] {
  // v2 시그니처(시작월) 없는 헤더 = 미생성 탭에 대한 gviz 기본시트 폴백 → skip
  if (!headerHas(rows[0], ACT_ALIASES.startMonth)) return []
  const g = makeGetter(rows[0], ACT_ALIASES)
  const out: GTMActivity[] = []
  rows.slice(1).forEach((r, i) => {
    const title = g(r, 'title')
    const product = g(r, 'product')
    if (!title && !product) return // 행사명·제품 둘 다 빈 행 skip
    const sm = parseYM(g(r, 'startMonth'))
    const em = parseYM(g(r, 'endMonth')) || sm
    const startDate = sm ? firstISO(sm.y, sm.m) : ''
    const endDate = em ? lastISO(em.y, em.m) : startDate
    const retail = g(r, 'retail')
    out.push({
      id: `${region}-${g(r, 'startMonth') || i}-${title || product}-${i}`,
      region,
      brand: g(r, 'brand'),
      type: normType(g(r, 'type')),
      retail,
      channel: retailChannel(retail),
      title: title || product,
      product,
      hero: toBool(g(r, 'hero')) || isHeroProduct(g(r, 'brand'), `${product} ${title}`),
      activity: g(r, 'activity'),
      count: g(r, 'count'),
      budget: g(r, 'budget'),
      startDate,
      endDate,
      status: (g(r, 'status') || '기획') as ActivityStatus,
      team: g(r, 'team'),
      owner: g(r, 'owner'),
      source: 'region',
      updatedAt: g(r, 'updatedAt'),
      updatedBy: g(r, 'updatedBy'),
    })
  })
  return out
}

// ── BM 탭 → 타겟권역별 신상품 활동 팬아웃 ──
function parseBMTab(rows: string[][]): GTMActivity[] {
  // v2 시그니처(출시월) 없는 헤더 = 오탭 폴백 → skip
  if (!headerHas(rows[0], BM_ALIASES.launchMonth)) return []
  const g = makeGetter(rows[0], BM_ALIASES)
  const out: GTMActivity[] = []
  rows.slice(1).forEach(r => {
    const brand = g(r, 'brand')
    const product = g(r, 'product')
    if (!brand && !product) return
    const ym = parseYM(g(r, 'launchMonth'))
    if (!ym) return
    const startDate = firstISO(ym.y, ym.m)
    const endDate = lastISO(ym.y, ym.m)
    // 타겟권역: 콤마/·/、 split. 공백=전체 4권역. 유효 권역만 사용.
    const raw = g(r, 'targetRegion')
    const tokens = raw.split(/[,、·/]+/).map(s => s.trim()).filter(Boolean)
    let regions: Region[]
    if (!tokens.length) regions = [...REGIONS]
    else {
      regions = tokens.filter((t): t is Region => (REGIONS as string[]).includes(t))
      if (!regions.length) regions = [...REGIONS] // 인식 실패 시 전체로 노출(누락 방지)
    }
    const meta: BMMeta = {
      price: g(r, 'price'), ingredient: g(r, 'ingredient'), usp: g(r, 'usp'),
      moq: g(r, 'moq'), renewal: g(r, 'renewal'), note: g(r, 'note'),
    }
    const launchLabel = g(r, 'launchMonth')
    regions.forEach(region => {
      out.push({
        id: `BM-${brand}-${product}-${region}-${launchLabel}`,
        region,
        brand,
        type: '신상품',
        retail: '',
        channel: '',
        title: `${product} 출시`,
        product,
        hero: isHeroProduct(brand, product),
        activity: '',
        count: '',
        budget: '',
        startDate,
        endDate,
        status: (g(r, 'status') || '기획') as ActivityStatus,
        team: g(r, 'team'),
        owner: g(r, 'owner'),
        source: 'BM',
        updatedAt: g(r, 'updatedAt'),
        updatedBy: g(r, 'updatedBy'),
        meta,
      })
    })
  })
  return out
}

// ── 주력상품 탭 → FocusProduct[] (권역|브랜드|1월..12월 평탄화) ──
function parseFocusTab(rows: string[][]): FocusProduct[] {
  const header = rows[0]
  const idx = headerIndex(header)
  const regionCol = idx['권역'] ?? idx['region'] ?? 0
  const brandCol = idx['브랜드'] ?? idx['brand'] ?? 1
  // 월 컬럼: 헤더에서 "N월" 매칭
  const monthCols: { col: number; month: number }[] = []
  header.forEach((h, i) => {
    const m = txt(h).match(/^(\d{1,2})\s*월$/)
    if (m) { const mm = +m[1]; if (mm >= 1 && mm <= 12) monthCols.push({ col: i, month: mm }) }
  })
  // 월 컬럼(N월)이 하나도 없으면 오탭 폴백 → skip
  if (!monthCols.length) return []
  const out: FocusProduct[] = []
  rows.slice(1).forEach(r => {
    const region = txt(r[regionCol])
    const brand = txt(r[brandCol])
    if (!region && !brand) return
    monthCols.forEach(({ col, month }) => {
      const cell = txt(r[col])
      if (!cell) return
      const products = cell.split(/[,、·/]+/).map(s => s.trim()).filter(Boolean)
      if (products.length) out.push({ region, brand, month, products })
    })
  })
  return out
}

// ── _변경로그 탭 → ChangeLogEntry[] (일시 내림차순) ──
function parseChangeLog(rows: string[][]): ChangeLogEntry[] {
  // 시그니처(일시) 없는 헤더 = 오탭 폴백 → skip
  if (!headerHas(rows[0], CHLOG_ALIASES.at)) return []
  const g = makeGetter(rows[0], CHLOG_ALIASES)
  const out: ChangeLogEntry[] = []
  rows.slice(1).forEach(r => {
    const at = g(r, 'at')
    if (!at) return
    out.push({
      at, tab: g(r, 'tab'), rowKey: g(r, 'rowKey'), column: g(r, 'column'),
      before: g(r, 'before'), after: g(r, 'after'), by: g(r, 'by'),
    })
  })
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

export async function fetchGTMData(): Promise<GTMData> {
  const [actResults, bmRows, focusRows, chlogRows] = await Promise.all([
    Promise.all(ACTIVITY_TABS.map(t => fetchTabRows(t).then(rows => ({ region: t, rows })))),
    fetchTabRows(BM_TAB),
    fetchTabRows(FOCUS_TAB),
    fetchTabRows(CHANGELOG_TAB),
  ])

  const activities: GTMActivity[] = []
  for (const { region, rows } of actResults) {
    if (rows) activities.push(...parseActivityTab(region, rows))
  }
  if (bmRows) activities.push(...parseBMTab(bmRows))

  const focusProducts = focusRows ? parseFocusTab(focusRows) : []
  const changeLog = chlogRows ? parseChangeLog(chlogRows) : []

  // 전체 0건이면 샘플 폴백
  if (!activities.length) return getSampleData()

  const present = new Set(activities.map(a => a.region))
  const regions = DEFAULT_REGIONS.filter(r => present.has(r.name as Region))

  const stamps = [
    ...activities.map(a => a.updatedAt),
    ...changeLog.map(c => c.at),
  ].filter(Boolean).sort()
  const lastUpdated = stamps.length ? stamps[stamps.length - 1] : new Date().toISOString()

  return {
    year: new Date().getFullYear(),
    title: '크로스 캘린더',
    regions: regions.length ? regions : DEFAULT_REGIONS,
    activities,
    focusProducts,
    changeLog,
    lastUpdated,
  }
}

// ─── 샘플 데이터 (시트 로드 실패·전체 0건 시 폴백) ──────────────────────
export function getSampleData(): GTMData {
  const y = new Date().getFullYear()
  const mk = (m: number, s: 1 | 0 = 1) => s ? firstISO(y, m) : lastISO(y, m)
  const now = new Date()

  type A = Omit<GTMActivity, 'channel' | 'updatedAt'> & { updatedAt?: string }
  const raw: A[] = [
    { id: 'S-1', region: '국내', brand: '웨이크메이크', type: '프로모션', retail: '올리브영', title: '헬로키티 컬렉션 올영 매대', product: '헬로키티 컬렉션', hero: true, activity: '올영 매대 + 인스타 릴스', count: '', budget: '1.5억', startDate: mk(7), endDate: mk(8, 0), status: '진행중', team: '국내마케팅', owner: '김지은', source: 'region', updatedBy: '김지은' },
    { id: 'S-2', region: '국내', brand: '컬러그램', type: '마케팅', retail: '', title: '누디블러 인플루언서 시딩', product: '누디블러틴트', hero: false, activity: '인플루언서 40명 시딩', count: '40', budget: '3천만', startDate: mk(7), endDate: mk(7, 0), status: '확정', team: '국내마케팅', owner: '박서준', source: 'region', updatedBy: '박서준' },
    { id: 'S-3', region: '미국', brand: '웨이크메이크', type: '프로모션', retail: '아마존', title: 'Amazon Prime Day Deal', product: '래스팅 글로우 스틱', hero: false, activity: 'Prime Day 딜 + TikTok', count: '', budget: '$120K', startDate: mk(7), endDate: mk(8, 0), status: '확정', team: '미국마케팅', owner: 'Sarah K', source: 'region', updatedBy: 'Sarah K' },
    { id: 'S-4', region: '중국', brand: '컬러그램', type: '프로모션', retail: '티몰', title: '티몰 8월 슈퍼브랜드데이', product: '누드 스탠다드', hero: false, activity: 'KOL 라이브 3회', count: '3', budget: '2억', startDate: mk(8), endDate: mk(8, 0), status: '기획', team: '중국마케팅', owner: '王伟', source: 'region', updatedBy: '王伟' },
    { id: 'S-5', region: '일본', brand: '컬러그램', type: '프로모션', retail: 'Qoo10', title: 'RE:NUDE 큐텐 메가와리', product: '누드 스탠다드', hero: false, activity: '메가와리 D2 라이브', count: '', budget: '¥8M', startDate: mk(9), endDate: mk(9, 0), status: '기획', team: '일본마케팅', owner: '佐藤', source: 'region', updatedBy: '佐藤' },
    { id: 'S-6', region: '일본', brand: '바이오힐보', type: '마케팅', retail: '@cosme', title: '@cosme 매장 신상 시딩', product: 'NAD 아이 크림', hero: true, activity: '앳코스메 매장 시딩 30건', count: '30', budget: '¥5M', startDate: mk(9), endDate: mk(9, 0), status: '기획', team: '일본마케팅', owner: '佐藤', source: 'region', updatedBy: '佐藤' },
    { id: 'S-7', region: '국내', brand: '바이오힐보', type: '프로모션', retail: 'LOFT', title: '로프트 팝업 (오프라인)', product: '콜라겐 겔미스트', hero: true, activity: '로프트 3개점 팝업', count: '', budget: '8천만', startDate: mk(8), endDate: mk(8, 0), status: '기획', team: '국내영업', owner: '이하늘', source: 'region', updatedBy: '이하늘' },
  ]

  const activities: GTMActivity[] = raw.map((a, i) => ({
    ...a,
    channel: retailChannel(a.retail),
    updatedAt: new Date(now.getTime() - i * 41 * 60 * 1000).toISOString(),
  }))

  // BM 팬아웃 예시: 1개 BM 행 → 타겟권역(국내·일본) 2건 신상품
  const bmMeta: BMMeta = { price: '32,000원', ingredient: '나이아신아마이드 10%', usp: '모공·미백 동시 케어', moq: '30,000개', renewal: '신규', note: '9월 글로벌 동시 출시' }
  ;(['국내', '일본'] as Region[]).forEach(region => {
    activities.push({
      id: `BM-바이오힐보-나이아 글로우 세럼-${region}-${y}-09`,
      region, brand: '바이오힐보', type: '신상품', retail: '', channel: '',
      title: '나이아 글로우 세럼 출시', product: '나이아 글로우 세럼', hero: false,
      activity: '', count: '', budget: '', startDate: mk(9), endDate: mk(9, 0),
      status: '확정', team: '상품기획', owner: '정민수', source: 'BM',
      updatedAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(), updatedBy: '정민수', meta: bmMeta,
    })
  })

  const focusProducts: FocusProduct[] = [
    { region: '국내', brand: '웨이크메이크', month: 7, products: ['헬로키티 컬렉션'] },
    { region: '국내', brand: '컬러그램', month: 7, products: ['누디블러틴트'] },
    { region: '일본', brand: '바이오힐보', month: 9, products: ['NAD 아이 크림', '나이아 글로우 세럼'] },
    { region: '중국', brand: '컬러그램', month: 8, products: ['누드 스탠다드'] },
  ]

  const changeLog: ChangeLogEntry[] = [
    { at: '2026-07-06 15:20', tab: '국내', rowKey: '헬로키티 컬렉션', column: '상태', before: '확정', after: '진행중', by: '김지은' },
    { at: '2026-07-06 11:05', tab: '중국', rowKey: '티몰 8월 슈퍼브랜드데이', column: '예산', before: '1.5억', after: '2억', by: '王伟' },
    { at: '2026-07-05 18:42', tab: 'BM', rowKey: '나이아 글로우 세럼', column: '타겟권역', before: '국내', after: '국내,일본', by: '정민수' },
  ]

  return {
    year: y,
    title: '크로스 캘린더 (샘플)',
    regions: DEFAULT_REGIONS,
    activities,
    focusProducts,
    changeLog,
    lastUpdated: now.toISOString(),
  }
}
