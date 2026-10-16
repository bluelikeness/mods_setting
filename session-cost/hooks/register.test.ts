import { expect, mock, test } from 'claude-code/testing'

import { comma, line, short } from './register'

test('문구 계산', () => {
  expect(comma(12345.6)).toBe('12,346')
  expect(comma(999)).toBe('999')
  expect(comma(1234567)).toBe('1,234,567')
  expect(short(950)).toBe('950')
  expect(short(90123)).toBe('90k')
  expect(short(1_000_000)).toBe('1.0M')
  expect(line({ context: { window: 200000, tokens: 90123, percent: 45 }, cost: { usd: 8.8234 } }, 1400))
    .toBe('이번 세션 ₩12,353 ($8.82) · 컨텍스트 45% (90k/200k)')
  expect(line({ context: { window: 1_000_000 } }, 1400)).toBe('이번 세션 ₩0 ($0.00) · 컨텍스트 -')
})

test('측정 알림과 30초마다 상태 줄을 바꾼다 · 환율 설정 반영', { options: { krwPerUsd: 1000 } }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const shown: (string | undefined)[] = []
  on('ui.status', (_$, e) => {
    shown.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  let usd = 1
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 50000, percent: 25 }, rateLimits: [], cost: { usd } } }))

  await $.session.measure({ context: { window: 200000, tokens: 40000, percent: 20 }, rateLimits: [], cost: { usd: 0.5 }, changed: ['cost'] })
  expect(shown.at(-1)).toBe('이번 세션 ₩500 ($0.50) · 컨텍스트 20% (40k/200k)')

  usd = 2
  await clock.advance(30_000)
  expect(shown.at(-1)).toBe('이번 세션 ₩2,000 ($2.00) · 컨텍스트 25% (50k/200k)')

  const n = shown.length
  await clock.advance(30_000) // 값이 그대로면 다시 쓰지 않는다
  expect(shown.length).toBe(n)
})
