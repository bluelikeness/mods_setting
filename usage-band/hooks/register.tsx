import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Limit } from '../types'
import {
  ACCESSORIES, BLACK_CAT, CAT_HEIGHT, EARS, EXTRAS, PATTERNS, PRESETS, SNOUTS, STYLES, TAILS, TERM_ROWS,
  blitSprite, canvas, eggSprite, eggSvg, encodeCells, kittenSprite, sanitize,
  sleepSprite, sleepingSvg, walkSprite, workingSvg,
} from './creature'
import type { Creature, Pace } from './creature'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const pace = atom({ plugin: 'usage-band', key: 'pace' } as const, 'walk' as Pace)
const kittens = atom({ plugin: 'usage-band', key: 'kittens' } as const, 0)
/** 지금 캐릭터 — 영구 저장소($.store 'creature')의 사본. null 이면 아직 정하는 중(알) */
const pet = atom({ plugin: 'usage-band', key: 'pet' } as const, null as Creature | null)

const KST = 9 * 3600 * 1000
const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const NAMES: Record<string, string> = { five_hour: '5시간', seven_day: '주간', spend_limit: '지출 한도' }
const ORDER = ['five_hour', 'seven_day', 'spend_limit']
/** 늘 보여 줄 창 — 값이 아직 없으면 "-" 로 자리를 지킨다(빠진 건지 아직 없는 건지 구분되게) */
const ALWAYS = ['five_hour', 'seven_day']

/** 바쁨 판정 — 최근 BUSY_WINDOW 안에 도구 호출이 BUSY_CALLS 번 이상이면 뛴다 */
const BUSY_WINDOW = 20_000
const BUSY_CALLS = 4
/** 데스크톱 띠의 한 칸 폭 추정(px) — 캐릭터가 다닐 폭을 칸 수에서 어림한다 */
const PX_PER_COL = 7.2

/** 초기화까지 남은 시간: "2시간 13분", "45분", "3일 4시간" */
export function remaining(resetMs: number, nowMs: number): string {
  const min = Math.max(0, Math.round((resetMs - nowMs) / 60000))
  if (min >= 24 * 60) {
    const d = Math.floor(min / (24 * 60))
    const hr = Math.floor((min % (24 * 60)) / 60)
    return hr ? `${d}일 ${hr}시간` : `${d}일`
  }
  if (min >= 60) {
    const hr = Math.floor(min / 60)
    const m = min % 60
    return m ? `${hr}시간 ${m}분` : `${hr}시간`
  }
  return `${min}분`
}

/** 한국 시간 "10/17(금) 09:00" — 실행 환경의 시간대와 무관하게 UTC+9 로 계산 */
export function kst(resetMs: number): string {
  const t = new Date(resetMs + KST)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()}(${DAYS[t.getUTCDay()]}) ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`
}

/** 초기화 문구만 — 짧게: "2시간 13분 뒤 초기화" / "10/18(일) 07:00 초기화" */
export function resetText(l: Limit, nowMs: number): string {
  if (!l.resetsAt) return ''
  const r = Date.parse(l.resetsAt)
  if (Number.isNaN(r)) return ''
  return l.kind === 'five_hour' ? `${remaining(r, nowMs)} 뒤 초기화` : `${kst(r)} 초기화`
}

const pctText = (l: Limit) => (l.percentUsed < 0 ? '-' : `${Math.round(l.percentUsed)}%`)

/** 한 창의 표시 문구: "5시간 37% · 2시간 13분 뒤 초기화" */
export function label(l: Limit, nowMs: number): string {
  const name = NAMES[l.kind] ?? l.kind
  const r = resetText(l, nowMs)
  return r ? `${name} ${pctText(l)} · ${r}` : `${name} ${pctText(l)}`
}

/** 최근 도구 호출 시각들 → 걷기/뛰기 */
export function paceOf(calls: readonly number[], nowMs: number): Pace {
  return calls.filter(t => nowMs - t <= BUSY_WINDOW).length >= BUSY_CALLS ? 'run' : 'walk'
}

function sorted(xs: readonly Limit[]): Limit[] {
  const rank = (k: string) => (ORDER.indexOf(k) < 0 ? 99 : ORDER.indexOf(k))
  return [...xs].sort((a, b) => rank(a.kind) - rank(b.kind))
}

/** 받은 창 + 늘 보여 줄 창의 빈자리("-") */
export function withPlaceholders(xs: readonly Limit[]): Limit[] {
  if (!xs.length) return []
  const have = new Set(xs.map(x => x.kind))
  return sorted([...xs, ...ALWAYS.filter(k => !have.has(k)).map(kind => ({ kind, percentUsed: -1 }))])
}

const copy = (xs: readonly Limit[]): Limit[] =>
  xs.map(x => ({ kind: x.kind, percentUsed: x.percentUsed, ...(x.resetsAt ? { resetsAt: x.resetsAt } : {}) }))

/** 사용률 색(테마 키) — 여유(초록) · 보통 · 80%↑ 경고 · 95%↑ 빨강 · 값 없음은 흐리게 */
function pctColor(p: number): 'success' | 'warning' | 'error' | 'text' | 'subtle' {
  return p < 0 ? 'subtle' : p >= 95 ? 'error' : p >= 80 ? 'warning' : p < 50 ? 'success' : 'text'
}

/** 같은 뜻의 고정 색(SVG 용) — 밝은·어두운 테마 양쪽에서 읽히는 중간 톤 */
const HEX = { success: '#16A34A', warning: '#D97706', error: '#DC2626', text: '#6B7280', subtle: '#9AA4B2' }

/** 글자 폭 어림(px) — 한글은 1em, 영숫자 0.62em, 공백 0.3em */
function textWidth(s: string, size: number): number {
  let w = 0
  for (const ch of s) {
    if (/[가-힣]/.test(ch)) w += size
    else if (ch === ' ') w += size * 0.3
    else w += size * 0.62
  }
  return w
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 데스크톱 한도 줄 — 이름·사용률은 13px 굵게, 초기화 문구는 10.5px 로 작게 */
export function limitsSvg(xs: readonly Limit[], nowMs: number): { source: string; width: number; alt: string } {
  const BIG = 13
  const SMALL = 10.5
  const parts: { t: string; size: number; fill: string; bold: boolean }[] = []
  xs.forEach((l, i) => {
    if (i) parts.push({ t: '  │  ', size: BIG, fill: '#B0B7C3', bold: false })
    parts.push({ t: (NAMES[l.kind] ?? l.kind) + ' ', size: BIG, fill: '#3B82F6', bold: true })
    parts.push({ t: pctText(l), size: BIG, fill: HEX[pctColor(l.percentUsed)], bold: true })
    const rt = resetText(l, nowMs)
    if (rt) parts.push({ t: ` · ${rt}`, size: SMALL, fill: '#8A93A0', bold: false })
  })
  const width = Math.ceil(parts.reduce((w, p) => w + textWidth(p.t, p.size), 0)) + 6
  const spans = parts.map(p =>
    `<tspan font-size="${p.size}" fill="${p.fill}"${p.bold ? ' font-weight="700"' : ''}>${esc(p.t).replace(/ /g, '&#160;')}</tspan>`).join('')
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="18" viewBox="0 0 ${width} 18">
  <text x="${width - 2}" y="13.5" text-anchor="end" font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">${spans}</text>
</svg>`
  return { source, width, alt: xs.map(l => label(l, nowMs)).join(' │ ') }
}

/** 값이 실제로 바뀐 때만 쓴다 — 같은 값을 써서 띠를 공연히 다시 그리지 않게 */
async function store($: EngineInterface, xs: readonly Limit[]): Promise<void> {
  if (!xs.length) return
  const next = copy(xs)
  const cur = await read($, limits)
  if (JSON.stringify(sorted(cur)) !== JSON.stringify(sorted(next))) await update($, limits, () => next)
}

// ── 캐릭터 정하기 — 지난 여러 세션의 대화 맥락으로 ──────────────────
const STORE_KEY = 'creature'
let choosing = false
/** 선택 차례 — pick 이름·reset 이 오면 올린다. 늦게 끝난 정하기는 차례가 바뀌었으면 버린다 */
let gen = 0

/** 플러그인 경로에서 ~/.claude 를 찾는다(로컬 마켓플레이스든 캐시든 그 아래에 있다) */
function claudeDir(root: string): string | null {
  const m = /^(.*?[\\/]\.claude)(?:[\\/]|$)/.exec(root)
  return m ? m[1] : null
}

/** 사용자 질문만 뽑는다 — 도구 결과·명령 메아리·시스템 알림은 뺀다 */
export function userTexts(jsonl: string): string[] {
  const out: string[] = []
  for (const line of jsonl.split('\n')) {
    if (!line.includes('"type":"user"')) continue
    let o: { type?: string; message?: { role?: string; content?: unknown } }
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    if (o.type !== 'user' || o.message?.role !== 'user') continue
    const c = o.message.content
    const text = typeof c === 'string' ? c
      : Array.isArray(c) ? c.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join(' ')
      : ''
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t || t.startsWith('<') || t.startsWith('[') || t.includes('local-command') || t.length < 4) continue
    out.push(t.slice(0, 200))
  }
  return out
}

/** 최근 세션들의 사용자 질문 + 각 프로젝트의 메모리 목차(MEMORY.md) */
async function history($: EngineInterface): Promise<{ prompts: string[]; memory: string }> {
  const dir = claudeDir($.plugin.root)
  if (!dir) return { prompts: [], memory: '' }
  const proj = `${dir}/projects`
  const files: { path: string; mtime: number }[] = []
  let memory = ''
  try {
    for (const p of await $.fs.list(proj)) {
      if (p.kind !== 'directory') continue
      let entries: Awaited<ReturnType<typeof $.fs.list>> = []
      try {
        entries = await $.fs.list(`${proj}/${p.name}`)
      } catch {
        continue
      }
      for (const f of entries)
        if (f.kind === 'file' && f.name.endsWith('.jsonl') && f.size > 0 && f.size < 4 * 1024 * 1024)
          files.push({ path: `${proj}/${p.name}/${f.name}`, mtime: f.mtimeMs })
      if (memory.length < 3000) {
        try {
          const m = await $.fs.read(`${proj}/${p.name}/memory/MEMORY.md`)
          if (typeof m === 'string') memory += m.slice(0, 1500) + '\n'
        } catch {
          // 메모리가 없는 프로젝트
        }
      }
    }
  } catch {
    return { prompts: [], memory }
  }
  files.sort((a, b) => b.mtime - a.mtime)
  const prompts: string[] = []
  for (const f of files.slice(0, 25)) {
    try {
      const t = await $.fs.read(f.path)
      if (typeof t === 'string') prompts.push(...userTexts(t).slice(-12))
    } catch {
      // 읽을 수 없는 기록
    }
    if (prompts.length >= 120) break
  }
  return { prompts: prompts.slice(0, 120), memory: memory.slice(0, 3000) }
}

const SCHEMA = () => `{
 "id": "영문 소문자-하이픈 (예: snow-leopard)",
 "name": "한국어 이름 (예: 눈표범)",
 "reason": "왜 이 동물인지 한 문장(한국어, 80자 이내) — 대화에서 본 성향을 근거로",
 "ears": ${JSON.stringify(EARS)} 중 하나,
 "tail": ${JSON.stringify(TAILS)} 중 하나,
 "pattern": ${JSON.stringify(PATTERNS)} 중 하나,
 "snout": ${JSON.stringify(SNOUTS)} 중 하나,
 "extras": ${JSON.stringify(EXTRAS)} 의 부분집합,
 "colors": { "fur": "#RRGGBB", "furDark": "#RRGGBB", "belly": "#RRGGBB", "accent": "#RRGGBB",
             "earIn": "#RRGGBB", "eye": "#RRGGBB", "nose": "#RRGGBB" },
 "lines": ["작업 중 멋쩍게 기다려 달라는 말 5개 — 그 동물 말투, 각 16자 이내"],
 "runLines": ["아주 바쁠 때 말 3개, 각 14자 이내"],
 "sleepLine": "쉬는 중 졸며 하는 말, 16자 이내",
 "accessory": ${JSON.stringify(ACCESSORIES)} 중 하나(소품이 없으면 none),
 "accessoryColor": "#RRGGBB",
 "style": ${JSON.stringify(STYLES)} 중 하나(수채화·물감 느낌이면 watercolor, 반짝·광택이면 glossy),
 "eyeSize": 0.8~1.5 사이 숫자(크고 둥근 눈이면 1.3~1.5),
 "aura": "뒤 배경의 은은한 빛무리 색 #RRGGBB, 배경 언급이 없으면 빈 문자열"
}`

function promptFor(prompts: string[], memory: string): { system: string; prompt: string } {
  const system = `당신은 개발자의 작업 성향을 보고 그 사람에게 어울리는 마스코트 동물을 정해 주는 디자이너다.
동물은 자유롭게 고른다(고양이·개 같은 흔한 동물에 얽매이지 말 것). 고른 동물을 아래 부품으로만 표현한다.
반드시 JSON 객체 하나만 답한다. 다른 글은 쓰지 않는다.
${SCHEMA()}`
  const prompt = `아래는 이 사용자가 여러 세션에서 Claude 에게 한 요청(최근 것부터)과 작업 메모 목차다.
말투·관심사·일하는 방식(꼼꼼함, 속도, 집요함, 분석/설계/운영 성향 등)을 보고 어울리는 동물을 정해 줘.

[작업 메모]
${memory || '(없음)'}

[요청들]
${prompts.map(p => '- ' + p).join('\n') || '(기록 없음)'}`
  return { system, prompt }
}

/** 모델 응답에서 첫 JSON 객체를 꺼낸다 */
export function parseCreature(text: string): Creature | null {
  const i = text.indexOf('{')
  const j = text.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try {
    return sanitize(JSON.parse(text.slice(i, j + 1)))
  } catch {
    return null
  }
}

/** 사용자가 직접 적은 설명 → 부품 사양. 설명의 특징(색·눈·소품·화풍·배경)을 최대한 살린다 */
function describeFor(text: string): { system: string; prompt: string } {
  const system = `당신은 사용자가 글로 적은 캐릭터 설명을, 정해진 부품으로 그리는 작은 마스코트 사양으로 옮기는 디자이너다.
설명에 나온 동물·색·눈·소품·화풍·배경을 최대한 그대로 살린다. 부품에 없는 것은 가장 가까운 부품으로 바꾼다.
reason 에는 "설명대로: …" 로 무엇을 어떻게 살렸는지 한 문장으로 적는다.
반드시 JSON 객체 하나만 답한다. 다른 글은 쓰지 않는다.
${SCHEMA()}`
  return { system, prompt: `[캐릭터 설명]\n${text}` }
}

async function choose($: EngineInterface, why: string, text = ''): Promise<void> {
  if (choosing) return
  choosing = true
  const my = ++gen
  const before = await read($, pet)                    // 실패하면 이걸로 되돌린다
  await update($, pet, () => null)
  $.ui.invalidate('ui.render')
  let made: Creature | null = null
  try {
    let ask: { system: string; prompt: string }
    if (text) {
      ask = describeFor(text)
    } else {
      const h = await history($)
      ask = promptFor(h.prompts, h.memory)
    }
    const r = await $.model.complete({ model: 'sonnet', system: ask.system, prompt: ask.prompt, maxTokens: 1400, timeoutMs: 120_000 })
    const parsed = r.isAnswered ? parseCreature(r.text) : null
    made = parsed && text ? { ...parsed, prompt: text.slice(0, 400) } : parsed
  } catch {
    made = null
  }
  try {
    if (my !== gen) return                           // 그 사이 사용자가 다른 걸 골랐다 — 그 선택이 이긴다
    if (made) {
      await update($, pet, () => made)
      // 저장이 실패해도 이번 세션은 정한 캐릭터로 간다(다음 세션에 다시 정한다)
      await $.store.set(STORE_KEY, made).catch(() => undefined)
      $.ui.toast(`🐣 ${made.name} 가(이) 태어났어요 — ${made.reason}`)
    } else {
      // 실패 — 저장된 캐릭터는 건드리지 않고 직전 모습으로 되돌린다(처음이면 검은 고양이)
      await update($, pet, () => before ?? BLACK_CAT)
      $.ui.toast(why === 'first' ? '캐릭터를 정하지 못해 검은 고양이로 시작해요(다음 세션에 다시 정해요)'
        : '캐릭터를 만들지 못했어요 — 이전 캐릭터를 그대로 둘게요')
    }
  } finally {
    choosing = false
    $.ui.invalidate('ui.render')
  }
}

/** 처음 불릴 때 — 저장된 캐릭터가 있으면 쓰고, 없으면 시드(userConfig) 또는 맥락으로 정한다 */
async function loadPet($: EngineInterface, seed: string): Promise<void> {
  const saved = sanitize(await $.store.get(STORE_KEY))
  if (saved) {
    await update($, pet, () => saved)
    return
  }
  if (seed === 'black-cat') {
    await $.store.set(STORE_KEY, BLACK_CAT)
    await update($, pet, () => BLACK_CAT)
    return
  }
  void choose($, 'first')
}

// ── 터미널 애니메이션(Raster 를 프레임마다 바꿔 끼운다) ──────────────
type Term = { requestId: string; cols: number; working: boolean; pace: Pace; kittens: number; pet: Creature | null }
let term: Term | null = null
let termTimer: Timer | undefined
let termTick = 0
let lastCells = ''

const tri = (t: number, span: number) => {
  if (span <= 0) return { x: 0, dir: 1 }
  const m = t % (span * 2)
  return m <= span ? { x: m, dir: 1 } : { x: span * 2 - m, dir: -1 }
}

/** 지금 프레임의 셀 — 캔버스(cols×8px)에 캐릭터·새끼·z 를 찍는다 */
export function termCells(t: Term, tick: number): string {
  const g = canvas(t.cols)
  const overlay: [number, number, string, number][] = []
  if (!t.pet) {
    blitSprite(g, eggSprite(tick % 8 < 2 ? (tick % 2 ? 1 : -1) : 0), 1)
  } else if (!t.working) {
    blitSprite(g, sleepSprite(t.pet), 0)
    const z = Math.floor(tick / 4) % 3
    overlay.push([9 + z, 0, z === 2 ? 'Z' : 'z', 0x8fa7d9])
  } else {
    const run = t.pace === 'run'
    const span = Math.max(0, t.cols - 17)
    const { x, dir } = tri(tick * (run ? 1.5 : 0.5), span)
    blitSprite(g, walkSprite(t.pet, Math.floor(tick / (run ? 1 : 2)) % 2), x, dir < 0)
  }
  if (t.pet) {
    for (let i = 0; i < Math.min(t.kittens, 6); i++) {
      const span = Math.max(0, t.cols - 7)
      const { x, dir } = tri(tick * (1.2 + (i % 3) * 0.4) + i * 11, span)
      blitSprite(g, kittenSprite(t.pet, (tick + i) % 2), x, dir < 0)
    }
  }
  return encodeCells(g, overlay)
}

function startTerm($: EngineInterface): void {
  if (termTimer) return
  termTimer = $.clock.every(150, async () => {
    if (!term) return
    termTick++
    const cells = termCells(term, termTick)
    if (cells === lastCells) return
    lastCells = cells
    const r = await $.ui.blit({ requestId: term.requestId, key: 'pet', cells }).catch(() => ({ deny: 'error' }))
    if (r && 'deny' in r && r.deny) {
      // 띠가 내려갔다(다른 표면으로 바뀜 등) — 다음 그리기에서 다시 켠다
      termTimer?.cancel()
      termTimer = undefined
      term = null
    }
  })
}

// ── 공통 상태 갱신 ────────────────────────────────────────
let timer: Timer | undefined
let beat = 0
let calls: number[] = []

async function setPace($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  calls = calls.filter(t => now - t <= BUSY_WINDOW)
  const next = paceOf(calls, now)
  if ((await read($, pace)) !== next) await update($, pace, () => next)
}

/** 지금 돌고 있는 서브에이전트 수 = 새끼 수 */
async function setKittens($: EngineInterface): Promise<void> {
  let n = 0
  try {
    n = (await $.agent.list()).filter(a => a.status === 'running').length
  } catch {
    return
  }
  if ((await read($, kittens)) !== n) await update($, kittens, () => n)
}

/** 10초마다 엔진의 최신 사용량을 읽고, 남은 시간 문구와 바쁨 정도도 다시 본다.
    엔진의 측정 알림은 턴이 끝날 때·1%p 움직일 때만 와서, 긴 작업 중에는 띠가 멈춰 보였다. */
async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  if (timer && now - beat < 25_000) return
  timer?.cancel()
  beat = now
  timer = $.clock.every(10_000, async () => {
    beat = await $.clock.now()
    await store($, (await $.session.usage()).rateLimits)
    await setPace($)
    await setKittens($)
    $.ui.invalidate('ui.render')
  })
}

// 모듈이 새로 불릴 때(세션 시작·/reload-plugins)마다 처음부터 — 저장소에서 다시 읽는다
let seed = ''
let loaded = false

async function ensurePet($: EngineInterface): Promise<void> {
  if (loaded) return
  loaded = true
  await loadPet($, seed).catch(() => undefined)
}

export const register: Register = (on, options) => {
  seed = typeof options?.character === 'string' ? options.character.trim() : ''
  loaded = false

  on('session.start', async ($, e, next) => {
    const res = await next(e)
    await $.command.register({ name: 'usage-band', description: '띠 캐릭터 보기 (reroll: 지난 대화로 다시 정하기 · pick <이름|"설명">: 직접 고르기 · reset: 검은 고양이)' })
    await ensurePet($)
    await store($, (await $.session.usage()).rateLimits)
    await tick($)
    return res
  })

  on('command.run', { command: 'usage-band' }, async ($, e) => {
    const arg = (e.args || '').trim()
    if (arg === 'pick' || arg.startsWith('pick ')) {
      const what = arg.slice(4).trim().replace(/^["'“”]+|["'“”]+$/g, '').trim()
      if (!what) {
        return { text: '쓰는 법: /usage-band pick black-cat · /usage-band pick "작은 검은 고양이, 크고 둥근 황금빛 눈, 보라색 보타이, 수채화 느낌"\n' +
          `이름으로 고를 수 있는 것: ${Object.keys(PRESETS).join(', ')}` }
      }
      const preset = PRESETS[what.toLowerCase()]
      if (preset) {
        gen++                                        // 진행 중인 정하기가 있으면 그 결과는 버린다
        await $.store.set(STORE_KEY, preset)
        await update($, pet, () => preset)
        $.ui.invalidate('ui.render')
        return { text: `${preset.name}(으)로 바꿨어요.` }
      }
      if (choosing) return { text: '지금 캐릭터를 만드는 중이에요 — 잠시 뒤 다시 해 주세요.' }
      void choose($, 'pick', what)
      return { text: '🎨 설명대로 캐릭터를 만드는 중이에요. 다 되면 알림이 떠요.\n(그림은 부품으로 그리는 작은 SVG 라, 설명의 특징을 최대한 살려 근사하게 그려요)' }
    }
    if (arg === 'reroll') {
      if (choosing) return { text: '지금 캐릭터를 정하는 중이에요 — 잠시 뒤 알이 깨어나요.' }
      void choose($, 'reroll')
      return { text: '🥚 지난 대화들을 읽고 어울리는 동물을 다시 정하는 중이에요. 정해지면 알림이 떠요.' }
    }
    if (arg === 'reset') {
      gen++
      await $.store.set(STORE_KEY, BLACK_CAT)
      await update($, pet, () => BLACK_CAT)
      $.ui.invalidate('ui.render')
      return { text: '검은 고양이로 돌아왔어요.' }
    }
    const c = await read($, pet)
    if (!c) return { text: '🥚 아직 알이에요 — 지난 대화를 읽고 어울리는 동물을 정하는 중이에요.' }
    return {
      text: `지금 캐릭터: ${c.name} (${c.id})\n이유: ${c.reason || '-'}\n` +
        `부품: 귀 ${c.ears} · 꼬리 ${c.tail} · 무늬 ${c.pattern} · 주둥이 ${c.snout}` +
        (c.extras.length ? ` · ${c.extras.join(', ')}` : '') +
        ` · 소품 ${c.accessory}${c.accessory !== 'none' ? `(${c.accessoryColor})` : ''} · 화풍 ${c.style} · 눈 ×${c.eyeSize}` +
        (c.aura ? ` · 배경 ${c.aura}` : '') +
        (c.prompt ? `\n설명: ${c.prompt}` : '') +
        '\n다시 정하기: /usage-band reroll · 직접 고르기: /usage-band pick <이름|설명> · 검은 고양이로: /usage-band reset',
    }
  })

  on('session.measure', async ($, e, next) => {
    await store($, e.rateLimits)
    return next(e)
  })

  // 바쁨은 도구 호출 빈도로 본다 — 값이 바뀔 때만 다시 그린다(그림이 다시 시작되므로)
  on('tool.call', async ($, e, next) => {
    calls.push(await $.clock.now())
    await setPace($).catch(() => undefined)
    return next(e)
  })

  // 서브에이전트가 생기고 끝날 때 새끼 수를 다시 센다
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    await setKittens($)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) await setKittens($)
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    await tick($)
    // 그리는 중에는 상태를 쓸 수 없다 — 캐릭터 불러오기는 그리기가 끝난 뒤 타이머로
    if (!loaded) $.clock.after(0, () => { void ensurePet($) })
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const isWorking = e.props.isWorking
    const xs = withPlaceholders(await read($, limits))
    const p = await read($, pace)
    const k = await read($, kittens)
    const c = await read($, pet)
    const now = await $.clock.now()
    const status = !c ? '알 품는 중… 지난 대화를 읽고 있어요' : ''

    if (e.surface !== 'terminal' && 'Svg' in els && els.Svg) {
      // 데스크톱 — 캐릭터는 왼쪽 끝부터 한도 줄 앞까지의 폭을 다닌다
      const lim = xs.length ? limitsSvg(xs, now) : null
      const rightW = lim ? lim.width : 130
      const catW = Math.max(120, Math.min(1600, e.props.bodyColumns * PX_PER_COL - rightW - 16))
      const name = c ? c.name : '알'
      return (
        <Box flexDirection="row" flexWrap="nowrap" alignItems="center" justifyContent="space-between"
             backgroundColor="transparent">
          <Box flexShrink={1}>
            <els.Svg
              source={!c ? eggSvg(catW, status) : isWorking ? workingSvg(catW, p, c, k) : sleepingSvg(catW, c, k)}
              alt={(!c ? status : isWorking ? `${p === 'run' ? '뛰어다니는' : '걸어다니는'} ${name}` : `졸고 있는 ${name}`)
                   + (c && k ? ` · 새끼 ${k}마리` : '')}
              width={Math.round(catW)}
              height={CAT_HEIGHT}
              isInteractive
            />
          </Box>
          <Box flexShrink={0}>
            {lim
              ? <els.Svg source={lim.source} alt={lim.alt} width={lim.width} height={18} />
              : <Text color="subtle">한도: 첫 응답 뒤에 표시</Text>}
          </Box>
        </Box>
      )
    }

    // 터미널 — 반칸 블록 픽셀아트(Raster)를 프레임마다 바꿔 끼운다
    const right = xs.length ? (
      <Box flexDirection="row" flexWrap="nowrap" flexShrink={0} gap={1}>
        {xs.map((l, i) => {
          const rt = resetText(l, now)
          return (
            <Box key={l.kind} flexDirection="row" flexWrap="nowrap" flexShrink={0}>
              {i ? <Text color="subtle">{'│ '}</Text> : null}
              <Text color="suggestion" bold>{(NAMES[l.kind] ?? l.kind) + ' '}</Text>
              <Text color={pctColor(l.percentUsed)} bold>{pctText(l)}</Text>
              {rt ? <Text color="subtle" dimColor>{` · ${rt}`}</Text> : null}
            </Box>
          )
        })}
      </Box>
    ) : (
      <Text color="subtle">한도: 첫 응답 뒤에 표시</Text>
    )
    const rightCols = xs.reduce((n, l) => n + label(l, now).length + 3, 0) + 2
    const say = !c ? status
      : !isWorking ? c.sleepLine
      : (p === 'run' ? c.runLines : c.lines)[Math.floor(now / 10_000) % (p === 'run' ? c.runLines : c.lines).length]
    const sayCols = Math.min(40, say.length * 2 + 2)
    const cols = Math.max(20, Math.min(160, e.props.bodyColumns - rightCols - sayCols - 4))
    const t: Term = { requestId: e.requestId, cols, working: isWorking, pace: p, kittens: k, pet: c }
    const cells = termCells(t, termTick)
    lastCells = cells
    term = t
    startTerm($)
    const Raster = (els as unknown as Record<string, unknown>).Raster as typeof Box | undefined
    return (
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center" justifyContent="space-between">
        <Box flexDirection="row" flexWrap="nowrap" flexShrink={1} alignItems="center">
          {Raster
            ? <Raster key="pet" columns={cols} rows={TERM_ROWS} cells={cells} />
            : <Text color="claude">{c ? '(=^.^=)' : '(  )'}</Text>}
          <Text color="subtle" dimColor wrap="truncate-end">{' ' + say}</Text>
        </Box>
        {right}
      </Box>
    )
  })
}
