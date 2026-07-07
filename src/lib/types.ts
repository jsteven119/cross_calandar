// ─── 크로스 캘린더 v2 데이터 모델 ───────────────────────────────
// 핵심 원칙: "한 줄 = 한 활동(activity)". 권역 탭(국내/미국/중국/일본)이 행 단위로 입력하고,
// BM(상품기획) 탭은 신상품 출시 계획을 타겟권역별로 팬아웃하여 활동으로 변환한다.

// 권역 — 활동 탭 이름과 1:1. (구 '전사' 권역 제거)
export type Region = '국내' | '미국' | '중국' | '일본'
export const REGIONS: Region[] = ['국내', '미국', '중국', '일본']

// 유형(3종) — 활동 탭 '유형' 컬럼. 이외 값은 프로모션으로 정규화.
export type ActivityType = '신상품' | '프로모션' | '마케팅'

// 상태 — 활동 탭 '상태' 컬럼(자유값 흡수, 기본 '기획')
export type ActivityStatus =
  | '기획'
  | '확정'
  | '진행중'
  | '완료'
  | '보류'
  | '취소'

// 파생 채널 — retail 값으로 온/오프라인 추정 (retailChannel 참조)
export type Channel = '온라인' | '오프라인' | ''

// 브랜드 (자사 멀티브랜드) — 필터 칩 고정 노출
export const BRANDS = ['바이오힐보', '웨이크메이크', '컬러그램', '브링그린', '올리브영'] as const

// BM(신상품 기획) 메타 — DetailDrawer '신상품 기획' 섹션에서 표시
export interface BMMeta {
  price: string        // 출시가
  ingredient: string   // 핵심성분
  usp: string          // USP
  moq: string          // 초도물량
  renewal: string      // 리뉴얼여부
  note: string         // 비고
}

export interface GTMActivity {
  id: string
  region: Region          // 권역 (활동 탭명 = 권역, BM은 타겟권역 팬아웃)
  brand: string           // 브랜드
  type: ActivityType      // 유형 (신상품/프로모션/마케팅)
  retail: string          // EC/Retail (Qoo10/RKT/올리브영/@cosme/LOFT …)
  channel: Channel        // 온라인/오프라인 (retail로 파생)
  title: string           // 행사명 (BM은 "○○ 출시")
  product: string         // 제품/라인명
  hero: boolean           // 주력상품 여부
  activity: string        // 활동내용 (자유서술)
  count: string           // 건수 (실행 수)
  budget: string          // 예산 (자유 텍스트)
  startDate: string       // YYYY-MM-DD (시작월 1일)
  endDate: string         // YYYY-MM-DD (종료월 말일)
  status: ActivityStatus
  team: string            // 담당팀
  owner: string           // 담당자
  source: 'region' | 'BM' // 데이터 출처(활동 탭 / BM 팬아웃)
  updatedAt: string       // 수정일시 (ISO 또는 yyyy-MM-dd HH:mm)
  updatedBy: string       // 수정자
  meta?: BMMeta           // source==='BM' 일 때만
}

// 주력상품 탭 → 권역×브랜드×월 평탄화
export interface FocusProduct {
  region: string
  brand: string
  month: number        // 1..12
  products: string[]   // 콤마 복수
}

// _변경로그 탭 → 실시간 변동 피드
export interface ChangeLogEntry {
  at: string           // 일시
  tab: string          // 탭
  rowKey: string       // 행식별
  column: string       // 컬럼
  before: string       // 이전값
  after: string        // 새값
  by: string           // 수정자
}

export interface RegionMeta {
  name: string
  color: string        // hex
  order: number
}

// 충돌 감지 결과: 같은 제품이 서로 다른 권역에서 기간 겹침
export interface Conflict {
  product: string
  activities: GTMActivity[]
  regions: string[]
  overlapStart: string
  overlapEnd: string
}

export interface GTMData {
  year: number
  title: string
  regions: RegionMeta[]
  activities: GTMActivity[]
  focusProducts: FocusProduct[]
  changeLog: ChangeLogEntry[]
  lastUpdated: string
}

export interface RefreshEvent {
  type: 'refresh'
  timestamp: string
}
