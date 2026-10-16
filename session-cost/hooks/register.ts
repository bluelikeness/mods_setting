import type { EngineInterface, Register, SessionUsage } from 'claude-code'

/** 천 단위 쉼표: 12345 → "12,345" (실행 환경에 Intl 이 없어도 되게 직접) */
export function comma(n: number): string {
  const s = String(Math.round(Math.abs(n)))
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 토큰 수를 짧게: 950 → "950", 90123 → "90k", 1000000 → "1.0M" */
export function short(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(n)
}

/** 상태 줄 문구: "이번 세션 ₩12,345 ($8.82) · 컨텍스트 45% (90k/200k)" */
export function line(u: Pick<SessionUsage, 'context' | 'cost'>, krwPerUsd: number): string {
  const usd = u.cost?.usd ?? 0
  const cost = `이번 세션 ₩${comma(usd * krwPerUsd)} ($${usd.toFixed(2)})`
  const c = u.context
  if (c.tokens === undefined) return `${cost} · 컨텍스트 -`
  const pct = c.percent ?? Math.round((c.tokens / c.window) * 100)
  return `${cost} · 컨텍스트 ${pct}% (${short(c.tokens)}/${short(c.window)})`
}

// 모듈이 새로 불릴 때(세션 시작·/reload-plugins)마다 처음부터
let rate = 1400
let last = ''
let isTicking = false

/** 같은 문구면 다시 쓰지 않는다 */
async function show($: EngineInterface, u?: Pick<SessionUsage, 'context' | 'cost'>): Promise<void> {
  const text = line(u ?? (await $.session.usage()), rate)
  if (text !== last) {
    last = text
    $.ui.status(text)
  }
}

/** 30초마다 다시 읽는다 — 엔진의 측정 알림은 턴이 끝날 때만 와서 긴 작업 중엔 멈춰 보인다 */
function tick($: EngineInterface): void {
  if (isTicking) return
  isTicking = true
  $.clock.every(30_000, () => show($))
}

export const register: Register = (on, options) => {
  const r = Number(options.krwPerUsd)
  if (Number.isFinite(r) && r > 0) rate = r

  on('session.start', async ($, e, next) => {
    const res = await next(e)
    await show($)
    tick($)
    return res
  })

  on('session.measure', async ($, e, next) => {
    await show($, e)
    tick($)
    return next(e)
  })
}
