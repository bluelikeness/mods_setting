import { expect, mock, test } from 'claude-code/testing'

import { BLACK_CAT, sanitize } from './creature'
import {
  kst, label, limitsSvg, paceOf, parseCreature, remaining, termCells, userTexts, withPlaceholders,
} from './register'

const FOX = {
  id: 'red-fox', name: '붉은 여우', reason: '분석적이고 집요하게 원인을 파고든다',
  ears: 'bigPointed', tail: 'bushy', pattern: 'belly', snout: 'muzzle', extras: ['tailTip', 'earTips', 'whiskers'],
  colors: { fur: '#E8732A', furDark: '#A8481A', belly: '#FFFFFF', accent: '#3A2418',
            earIn: '#F0B3B7', eye: '#F2B648', nose: '#2B2B2B' },
  lines: ['킁킁, 냄새를 쫓는 중…', '조금만요!'], runLines: ['후다닥!'], sleepLine: '꼬리 덮고 쿨쿨',
}

test('문구·판정·한도 SVG·빈자리', async () => {
  const now = Date.parse('2026-10-14T03:00:00Z') // KST 12:00
  expect(remaining(now + (2 * 60 + 13) * 60000, now)).toBe('2시간 13분')
  expect(remaining(now + (3 * 24 + 4) * 3600000, now)).toBe('3일 4시간')
  expect(kst(Date.parse('2026-10-17T00:00:00Z'))).toBe('10/17(토) 09:00')
  expect(label({ kind: 'five_hour', percentUsed: 37.4, resetsAt: '2026-10-14T05:13:00Z' }, now)).toBe('5시간 37% · 2시간 13분 뒤 초기화')
  expect(label({ kind: 'seven_day', percentUsed: 62, resetsAt: '2026-10-17T00:00:00Z' }, now)).toBe('주간 62% · 10/17(토) 09:00 초기화')
  expect(paceOf([now - 1000, now - 2000, now - 3000], now)).toBe('walk')
  expect(paceOf([now - 1000, now - 2000, now - 3000, now - 4000], now)).toBe('run')
  // 5시간 값이 안 와도 자리를 지킨다
  const xs = withPlaceholders([{ kind: 'seven_day', percentUsed: 8 }])
  expect(xs.map(x => label(x, now))).toEqual(['5시간 -', '주간 8%'])
  const s = limitsSvg([{ kind: 'five_hour', percentUsed: 97, resetsAt: '2026-10-14T05:00:00Z' }], now)
  expect(s.source).toContain('font-size="10.5"')
  expect(s.source).toContain('#DC2626')
})

test('지난 대화에서 사용자 질문만 뽑고, 모델 답을 고쳐 받는다', async () => {
  const jsonl = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'DDL 리포트 오류 고쳐줘' } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: '<local-command-caveat>…' } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: '네' } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: '파티션 정책 판단 근거 줘' }] } }),
  ].join('\n')
  expect(userTexts(jsonl)).toEqual(['DDL 리포트 오류 고쳐줘', '파티션 정책 판단 근거 줘'])
  const c = parseCreature('이렇게 정했어요 ' + JSON.stringify(FOX) + ' 끝')
  expect(c?.name).toBe('붉은 여우')
  // 모르는 부품·잘못된 색은 기본값으로
  const bad = sanitize({ name: '용', ears: 'wings', tail: 'fire', colors: { fur: 'red' } })
  expect(bad?.ears).toBe('pointed')
  expect(bad?.tail).toBe('thin')
  expect(bad?.colors.fur).toBe('#8C93A3')
})

test('터미널 픽셀아트 — 셀 수가 폭×4줄과 맞는다', async () => {
  for (const working of [false, true]) {
    const cells = termCells({ requestId: 'b', cols: 40, working, pace: 'run', kittens: 2, pet: BLACK_CAT }, 3)
    const bytes = (cells.length / 4) * 3 - (cells.endsWith('==') ? 2 : cells.endsWith('=') ? 1 : 0)
    expect(bytes).toBe(40 * 4 * 12)
  }
  const egg = termCells({ requestId: 'b', cols: 20, working: false, pace: 'walk', kittens: 0, pet: null }, 1)
  expect(egg.length).toBeGreaterThan(0)
})

const band = (isWorking: boolean) => ({
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking, maxRows: 6, bodyColumns: 120, scroll: { offset: 0, bodyRows: 5 }, view: {} },
  viewport: { columns: 125, rows: 40 },
}) as const

type Mounted = { drawn: () => Promise<unknown> }
const tree = async (ui: Mounted) => JSON.stringify(await ui.drawn())

test('처음엔 알 → 지난 대화로 동물을 정해 태어난다 · 걷기/뛰기 · 새끼', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-14T03:00:00Z') })
  on('tool.call', async () => ({ result: {} }))
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: '' }))
  const saved: Record<string, unknown> = {}
  on('store.get', async (_$, e) => ({ value: saved[(e as { key: string }).key] }))
  on('store.set', async (_$, e) => { saved[(e as { key: string }).key] = (e as { value: unknown }).value; return { value: undefined } })
  let asked = ''
  on('model.complete', async (_$, e) => {
    asked = JSON.stringify(e)
    return { value: { isAnswered: true, text: JSON.stringify(FOX), usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  let agents = 0
  on('agent.list', async () => ({
    value: Array.from({ length: agents }, (_, i) => ({ id: `a${i}`, description: 'x', type: 'Explore', status: 'running' })),
  }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))

  const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'desktop', ...band(false) })
  await clock.advance(50)
  expect(asked).toContain('마스코트 동물')
  expect(await tree(ui)).toContain('졸고 있는 붉은 여우')
  await ui.unmount()

  const walk = await $.ui.mount({ plugin: 'usage-band', surface: 'desktop', ...band(true) })
  expect(await tree(walk)).toContain('걸어다니는 붉은 여우')
  for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/x.txt' })
  agents = 2
  await clock.advance(10_000)
  expect(await tree(walk)).toContain('뛰어다니는 붉은 여우')
  expect(await tree(walk)).toContain('새끼 2마리')
  await walk.unmount()

  const term = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...band(true) })
  expect(await tree(term)).toContain('"Raster"')
  await term.unmount()

  // pick — 이름이면 바로, 설명이면 모델이 부품 사양으로 옮긴다(소품·화풍·눈·배경 포함)
  const r1 = await $.command.run({ command: 'usage-band', args: 'pick black-cat' } as never)
  expect(JSON.stringify(r1)).toContain('검은 고양이')
  const desc = '작은 검은 고양이, 크고 둥근 황금빛 눈, 파스텔 보라색 보타이, 수채화, 꿈꾸는 파스텔 배경'
  asked = ''
  const r2 = await $.command.run({ command: 'usage-band', args: `pick "${desc}"` } as never)
  expect(JSON.stringify(r2)).toContain('설명대로')
  await clock.advance(50)
  expect(asked).toContain('캐릭터 설명')
  expect(asked).toContain('보타이')
  const r3 = await $.command.run({ command: 'usage-band', args: '' } as never)
  expect(JSON.stringify(r3)).toContain('설명: ' + desc)
})

test('한도 — 터미널은 글자(빈자리 "-"), 10초마다 갱신', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-14T03:00:00Z') })
  on('fs.list', async () => ({ value: [] }))
  on('model.complete', async () => ({ value: { isAnswered: false, reason: 'empty-reply' } }))
  let pct = 10
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 },
             rateLimits: [{ kind: 'seven_day', percentUsed: pct, resetsAt: '2026-10-17T00:00:00Z' }] },
  }))
  const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...band(false) })
  await clock.advance(10_000)
  expect(await ui.find({ type: 'Text', text: /^-$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^10%$/ })).toBeDefined()
  pct = 11
  await clock.advance(10_000)
  expect(await ui.find({ type: 'Text', text: /^11%$/ })).toBeDefined()
  await ui.unmount()
})
