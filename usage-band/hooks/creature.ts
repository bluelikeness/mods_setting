/**
 * 띠의 캐릭터 — 어떤 동물이든 "부품 사양(Creature)"으로 그린다.
 *
 * 캐릭터는 사용자의 지난 대화 맥락으로 모델이 고른다(register.tsx). 모델은 동물을 자유롭게
 * 고르고, 그 동물을 아래 부품(귀·꼬리·무늬·주둥이·덧붙임·색)으로 적는다. 여기서는 그 사양으로
 *  · 데스크톱: SVG(SMIL) — 스크립트 없는 샌드박스라 WebGL 은 못 쓴다. 그라데이션·반사광·그림자로 입체감.
 *  · 터미널  : 반칸 블록(▀▄) 픽셀아트 — Raster 셀로 그리고 프레임을 바꿔 끼워 움직인다.
 * 을 만든다. 자세는 둘: 쉬는 중(엎드려 졸기) · 작업 중(옆모습 걷기/뛰기).
 */

import type { Accessory, Creature, Ears, Extra, Pace, Pattern, Snout, Style, Tail } from '../types'

export type { Creature, Pace }

export const EARS: Ears[] = ['pointed', 'bigPointed', 'floppy', 'long', 'round', 'small', 'horns', 'none']
export const TAILS: Tail[] = ['thin', 'bushy', 'curl', 'pom', 'stub', 'flat', 'none']
export const PATTERNS: Pattern[] = ['none', 'belly', 'mask', 'eyePatch', 'stripes', 'spots']
export const SNOUTS: Snout[] = ['none', 'muzzle', 'long']
export const EXTRAS: Extra[] = ['whiskers', 'mane', 'cheeks', 'tailTip', 'earTips']
export const ACCESSORIES: Accessory[] = ['none', 'bowtie', 'ribbon', 'scarf', 'collar', 'flower', 'hat', 'glasses']
export const STYLES: Style[] = ['plain', 'watercolor', 'glossy']

/** 기본 캐릭터 — 검은 고양이 */
export const BLACK_CAT: Creature = {
  id: 'black-cat', name: '검은 고양이', reason: '기본 캐릭터',
  ears: 'pointed', tail: 'thin', pattern: 'none', snout: 'none', extras: ['whiskers'],
  colors: { fur: '#27272D', furDark: '#09090B', belly: '#3A3A44', accent: '#1A1A1F',
            earIn: '#E9A3AA', eye: '#F2B648', nose: '#E59AA1' },
  lines: ['조금만 기다려 주세요냥…', '열심히 하는 중이에요', '거의 다 됐어요… 아마도요 ^^;',
          '생각보다 오래 걸리네요 (머쓱)', '금방 끝낼게요냥!'],
  runLines: ['바빠요 바빠! 💨', '후다닥 처리 중…', '헉헉, 거의 다 왔어요!'],
  sleepLine: '쿨쿨… 일 생기면 깨워 주세요',
  accessory: 'none', accessoryColor: '#B9A3E3', style: 'plain', eyeSize: 1, aura: '',
}

/** 이름으로 바로 고를 수 있는 캐릭터 */
export const PRESETS: Record<string, Creature> = { 'black-cat': BLACK_CAT }

// ── 색 계산 ──────────────────────────────────────────────
const HEX_RX = /^#?([0-9a-f]{6})$/i

export function okHex(v: unknown, fallback: string): string {
  const m = typeof v === 'string' ? HEX_RX.exec(v.trim()) : null
  return m ? '#' + m[1].toUpperCase() : fallback
}

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}

/** t>0 이면 흰색 쪽, t<0 이면 검은색 쪽으로 섞는다 */
export function shade(h: string, t: number): string {
  const [r, g, b] = rgb(h)
  return t >= 0 ? hex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
    : hex(r * (1 + t), g * (1 + t), b * (1 + t))
}

function luma(h: string): number {
  const [r, g, b] = rgb(h)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** 모델이 준 사양을 믿지 않고 고친다 — 모르는 부품·색은 기본값으로 */
export function sanitize(raw: unknown): Creature | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const pick = <T extends string>(v: unknown, list: T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
  const str = (v: unknown, d: string, max = 40) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : d)
  const arr = (v: unknown, d: string[], max = 30) =>
    Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => (x as string).trim().slice(0, max)).slice(0, 6) : d
  const c = (o.colors && typeof o.colors === 'object' ? o.colors : {}) as Record<string, unknown>
  const fur = okHex(c.fur, '#8C93A3')
  const lines = arr(o.lines, BLACK_CAT.lines)
  const runLines = arr(o.runLines, BLACK_CAT.runLines)
  return {
    id: str(o.id, 'creature', 30).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: str(o.name, '친구', 20),
    reason: str(o.reason, '', 160),
    ears: pick(o.ears, EARS, 'pointed'),
    tail: pick(o.tail, TAILS, 'thin'),
    pattern: pick(o.pattern, PATTERNS, 'none'),
    snout: pick(o.snout, SNOUTS, 'none'),
    extras: (Array.isArray(o.extras) ? o.extras : []).filter((x): x is Extra => EXTRAS.includes(x as Extra)),
    colors: {
      fur,
      furDark: okHex(c.furDark, shade(fur, -0.55)),
      belly: okHex(c.belly, shade(fur, 0.55)),
      accent: okHex(c.accent, shade(fur, -0.4)),
      earIn: okHex(c.earIn, '#E9A3AA'),
      eye: okHex(c.eye, '#F2B648'),
      nose: okHex(c.nose, '#E59AA1'),
    },
    lines: lines.length ? lines : BLACK_CAT.lines,
    runLines: runLines.length ? runLines : BLACK_CAT.runLines,
    sleepLine: str(o.sleepLine, BLACK_CAT.sleepLine, 30),
    accessory: pick(o.accessory, ACCESSORIES, 'none'),
    accessoryColor: okHex(o.accessoryColor, '#B9A3E3'),
    style: pick(o.style, STYLES, 'plain'),
    eyeSize: Math.max(0.8, Math.min(1.5, Number(o.eyeSize) || 1)),
    aura: o.aura ? okHex(o.aura, '') : '',
    ...(typeof o.prompt === 'string' && o.prompt.trim() ? { prompt: o.prompt.trim().slice(0, 400) } : {}),
  }
}

// ── 데스크톱 SVG ─────────────────────────────────────────
export const CAT_HEIGHT = 36
const GROUND = 33

function defs(c: Creature): string {
  const k = c.colors
  return `
<defs>
  <radialGradient id="body" cx="35%" cy="25%" r="80%">
    <stop offset="0%" stop-color="${shade(k.fur, 0.28)}"/>
    <stop offset="35%" stop-color="${k.fur}"/>
    <stop offset="100%" stop-color="${k.furDark}"/>
  </radialGradient>
  <radialGradient id="head" cx="38%" cy="28%" r="78%">
    <stop offset="0%" stop-color="${shade(k.fur, 0.32)}"/>
    <stop offset="40%" stop-color="${k.fur}"/>
    <stop offset="100%" stop-color="${k.furDark}"/>
  </radialGradient>
  <radialGradient id="paw" cx="40%" cy="30%" r="80%">
    <stop offset="0%" stop-color="${shade(k.fur, 0.18)}"/>
    <stop offset="100%" stop-color="${shade(k.furDark, -0.1)}"/>
  </radialGradient>
  <radialGradient id="belly" cx="50%" cy="35%" r="65%">
    <stop offset="0%" stop-color="${shade(k.belly, 0.25)}"/>
    <stop offset="100%" stop-color="${shade(k.belly, -0.12)}"/>
  </radialGradient>
  <linearGradient id="earIn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${shade(k.earIn, -0.15)}"/>
    <stop offset="100%" stop-color="${shade(k.earIn, 0.25)}"/>
  </linearGradient>
  <radialGradient id="iris" cx="50%" cy="45%" r="55%">
    <stop offset="0%" stop-color="${shade(k.eye, 0.55)}"/>
    <stop offset="65%" stop-color="${k.eye}"/>
    <stop offset="100%" stop-color="${shade(k.eye, -0.3)}"/>
  </radialGradient>
  <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#000" stop-opacity="0.3"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="aura" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${c.aura || '#FFFFFF'}" stop-opacity="${c.aura ? 0.75 : 0}"/>
    <stop offset="70%" stop-color="${c.aura || '#FFFFFF'}" stop-opacity="${c.aura ? 0.25 : 0}"/>
    <stop offset="100%" stop-color="${c.aura || '#FFFFFF'}" stop-opacity="0"/>
  </radialGradient>
  <filter id="wc" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.35" result="b"/>
    <feComponentTransfer in="b"><feFuncA type="linear" slope="0.93"/></feComponentTransfer>
  </filter>
</defs>`
}

/** 화풍 — 수채화면 물감 번짐 필터를 씌운다 */
const styleAttr = (c: Creature) => (c.style === 'watercolor' ? ' filter="url(#wc)"' : '')

/** 수채화의 물감 얼룩 — 캐릭터 뒤에 번진 듯 깐다 */
function wash(c: Creature, cx: number, cy: number, rx: number, ry: number): string {
  if (c.style === 'watercolor')
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${shade(c.colors.fur, 0.35)}" opacity="0.18" filter="url(#wc)"/>`
  return ''
}

/** 소품 — 머리 좌표계(원점 중심, 가로 반지름 20)에 그린다 */
function accessory(c: Creature): string {
  const a = c.accessoryColor
  const d = shade(a, -0.25)
  const l = shade(a, 0.35)
  switch (c.accessory) {
    case 'bowtie': return `<g transform="translate(0 18.5)">
      <path d="M0,0 L-8,-4.6 Q-9.5,0 -8,4.6 Z M0,0 L8,-4.6 Q9.5,0 8,4.6 Z" fill="${a}"/>
      <path d="M-6.5,-2.5 L-2,0 M6.5,-2.5 L2,0" stroke="${l}" stroke-width="0.8" opacity="0.7"/>
      <ellipse rx="2" ry="2.4" fill="${d}"/></g>`
    case 'ribbon': return `<g transform="translate(13 -17) rotate(20)">
      <ellipse cx="-3.8" cy="0" rx="4.2" ry="2.8" fill="${a}"/><ellipse cx="3.8" cy="0" rx="4.2" ry="2.8" fill="${a}"/>
      <path d="M-1,1 L-3,6 M1,1 L3,6" stroke="${a}" stroke-width="1.6" stroke-linecap="round"/>
      <circle r="1.6" fill="${d}"/></g>`
    case 'scarf': return `<path d="M-16,12 Q0,22 16,12 L16,17.5 Q0,27.5 -16,17.5 Z" fill="${a}"/>
      <rect x="6" y="17" width="5.5" height="10" rx="2" fill="${d}"/>
      <path d="M-14,14.5 Q0,23 14,14.5" stroke="${l}" stroke-width="0.8" fill="none" opacity="0.7"/>`
    case 'collar': return `<path d="M-14.5,13.5 Q0,21.5 14.5,13.5" stroke="${a}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="0" cy="20" r="2.8" fill="#F2C94C"/><circle cx="-0.8" cy="19.2" r="0.8" fill="#FFF6C8"/>`
    case 'flower': return `<g transform="translate(-13 -17)">
      ${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-3.2" rx="2.3" ry="3.2" fill="${a}" transform="rotate(${r})"/>`).join('')}
      <circle r="2" fill="#F7D35A"/></g>`
    case 'hat': return `<rect x="-7" y="-31" width="14" height="12" rx="2" fill="${a}"/>
      <rect x="-7" y="-22.5" width="14" height="2.4" fill="${l}"/>
      <rect x="-12" y="-20" width="24" height="3.2" rx="1.6" fill="${d}"/>`
    case 'glasses': return `<g fill="none" stroke="${a}" stroke-width="1.4">
      <circle cx="-8" cy="1" r="7.2"/><circle cx="8" cy="1" r="7.2"/><path d="M-0.8,0 Q0,-1.2 0.8,0"/></g>`
    default: return ''
  }
}

/** 테두리 반사광 색 — 어두운 털은 밝게, 밝은 털은 흰 광택 */
function rim(c: Creature): string {
  if (c.style === 'glossy') return '#FFFFFF'
  return luma(c.colors.fur) < 0.35 ? '#8A8A98' : '#FFFFFF'
}

function eye(x: number, y: number, r: number): string {
  return `
  <g transform="translate(${x} ${y})"><g>
    <animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 0.08;1 1"
      keyTimes="0;0.9;0.95;1" dur="4s" repeatCount="indefinite"/>
    <circle r="${r}" fill="url(#iris)"/>
    <circle r="${(r * 0.72).toFixed(2)}" fill="#140D07"/>
    <circle cx="${(-r * 0.3).toFixed(2)}" cy="${(-r * 0.33).toFixed(2)}" r="${(r * 0.27).toFixed(2)}" fill="#fff"/>
    <circle cx="${(r * 0.33).toFixed(2)}" cy="${(r * 0.3).toFixed(2)}" r="${(r * 0.12).toFixed(2)}" fill="#fff" opacity="0.9"/>
  </g></g>`
}

/** 머리 — 원점 중심, 가로 반지름 20 · 세로 17.5 의 좌표계 */
function head(c: Creature, awake: boolean): string {
  const k = c.colors
  const back: string[] = []
  const front: string[] = []
  const tips = c.extras.includes('earTips')
  if (c.extras.includes('mane')) back.push(`<circle r="25" fill="${k.accent}"/><circle r="23" fill="${shade(k.accent, 0.12)}"/>`)
  switch (c.ears) {
    case 'pointed':
      back.push(`<path d="M-18.5,-7 L-20.5,-27 Q-11.5,-23 -4.5,-16 Z" fill="url(#head)"/>
        <path d="M-16.5,-10 L-17.5,-22.5 Q-12,-20 -7.5,-15.5 Z" fill="url(#earIn)"/>
        <path d="M4.5,-16 Q12.5,-24 20.5,-26 L18.5,-7 Z" fill="url(#head)"/>
        <path d="M7,-15.5 Q13,-21 17.5,-22.4 L16.3,-10 Z" fill="url(#earIn)"/>`)
      if (tips) back.push(`<path d="M-20.5,-27 L-19.6,-21 L-16,-24 Z M20.5,-26 L16.5,-23.5 L19.8,-20 Z" fill="${k.accent}"/>`)
      break
    case 'bigPointed':
      back.push(`<path d="M-20,-4 L-23,-31 Q-10,-24 -3,-16 Z" fill="url(#head)"/>
        <path d="M-17.5,-8 L-20,-25 Q-12,-21 -6,-15.5 Z" fill="url(#earIn)"/>
        <path d="M3,-16 Q10,-24 23,-31 L20,-4 Z" fill="url(#head)"/>
        <path d="M6,-15.5 Q12,-21 20,-25 L17.5,-8 Z" fill="url(#earIn)"/>`)
      if (tips) back.push(`<path d="M-23,-31 L-20.5,-22 L-16,-25 Z M23,-31 L16,-25 L20.5,-22 Z" fill="${k.accent}"/>`)
      break
    case 'long':
      back.push(`<ellipse cx="-7" cy="-27" rx="5.2" ry="15" transform="rotate(-12 -7 -27)" fill="url(#head)"/>
        <ellipse cx="-7" cy="-26" rx="2.6" ry="11" transform="rotate(-12 -7 -26)" fill="url(#earIn)"/>
        <ellipse cx="7" cy="-27" rx="5.2" ry="15" transform="rotate(12 7 -27)" fill="url(#head)"/>
        <ellipse cx="7" cy="-26" rx="2.6" ry="11" transform="rotate(12 7 -26)" fill="url(#earIn)"/>`)
      break
    case 'round':
      back.push(`<circle cx="-15" cy="-14" r="7" fill="${c.pattern === 'eyePatch' ? k.accent : 'url(#head)'}"/>
        <circle cx="15" cy="-14" r="7" fill="${c.pattern === 'eyePatch' ? k.accent : 'url(#head)'}"/>
        ${c.pattern === 'eyePatch' ? '' : '<circle cx="-15" cy="-14" r="3.6" fill="url(#earIn)"/><circle cx="15" cy="-14" r="3.6" fill="url(#earIn)"/>'}`)
      break
    case 'small':
      back.push(`<circle cx="-13" cy="-14" r="4.5" fill="url(#head)"/><circle cx="13" cy="-14" r="4.5" fill="url(#head)"/>
        <circle cx="-13" cy="-14" r="2.2" fill="url(#earIn)"/><circle cx="13" cy="-14" r="2.2" fill="url(#earIn)"/>`)
      break
    case 'horns':
      back.push(`<path d="M-9,-14 Q-14,-26 -6,-30 Q-9,-22 -4,-16 Z M9,-14 Q14,-26 6,-30 Q9,-22 4,-16 Z" fill="${shade(k.belly, 0.2)}"/>
        <path d="M-17,-6 Q-26,-8 -24,-2 Q-20,-1 -16,-2 Z M17,-6 Q26,-8 24,-2 Q20,-1 16,-2 Z" fill="url(#head)"/>`)
      break
    case 'floppy':
      front.push(`<ellipse cx="-17" cy="-2" rx="6.5" ry="12" transform="rotate(18 -17 -2)" fill="${k.furDark}"/>
        <ellipse cx="17" cy="-2" rx="6.5" ry="12" transform="rotate(-18 17 -2)" fill="${k.furDark}"/>`)
      break
  }
  const faceMarks: string[] = []
  if (c.pattern === 'mask') faceMarks.push(`<ellipse cx="0" cy="0.5" rx="17" ry="5.2" fill="${k.accent}"/>`)
  if (c.pattern === 'eyePatch') faceMarks.push(`<ellipse cx="-8" cy="1.5" rx="7" ry="5.5" transform="rotate(-25 -8 1.5)" fill="${k.accent}"/>
      <ellipse cx="8" cy="1.5" rx="7" ry="5.5" transform="rotate(25 8 1.5)" fill="${k.accent}"/>`)
  if (c.pattern === 'stripes') faceMarks.push(`<path d="M-4,-17 L-2,-11 M0,-17.5 L0,-11 M4,-17 L2,-11" stroke="${k.accent}" stroke-width="1.6" stroke-linecap="round"/>`)
  if (c.extras.includes('cheeks')) faceMarks.push(`<ellipse cx="-13" cy="6" rx="5.5" ry="4.2" fill="url(#belly)"/><ellipse cx="13" cy="6" rx="5.5" ry="4.2" fill="url(#belly)"/>`)
  if (c.snout === 'muzzle') faceMarks.push(`<ellipse cx="0" cy="7.8" rx="7.5" ry="5.2" fill="url(#belly)"/>`)
  if (c.snout === 'long') faceMarks.push(`<ellipse cx="0" cy="8.5" rx="9" ry="6.6" fill="url(#belly)"/>`)
  const eyes = awake
    ? eye(-8, 1, 5.8 * c.eyeSize) + eye(8, 1, 5.8 * c.eyeSize)
    : `<path d="M-13,1.5 q5,3.6 10,0 M3,1.5 q5,3.6 10,0" stroke="${luma(c.colors.fur) < 0.35 ? '#A0A0AE' : '#4A4A55'}"
         stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  const big = c.snout === 'long'
  const whisk = c.extras.includes('whiskers') ? `
  <g stroke="${luma(k.fur) < 0.45 ? '#C9C9D6' : '#6A6A76'}" stroke-width="0.5" opacity="0.75" stroke-linecap="round">
    <path d="M-7.5,7.5 L-22.5,6"/><path d="M-7.5,8.8 L-22,10"/><path d="M-7,10 L-20.5,13.5"/>
    <path d="M7.5,7.5 L22.5,6"/><path d="M7.5,8.8 L22,10"/><path d="M7,10 L20.5,13.5"/>
  </g>` : ''
  return `
  ${back.join('')}
  <ellipse rx="20" ry="17.5" fill="url(#head)"/>
  <path d="M-17.5,-5 Q-10.5,-16.5 3.5,-16.5" stroke="${rim(c)}" stroke-width="1" fill="none" opacity="0.35"/>
  ${faceMarks.join('')}
  ${front.join('')}
  ${eyes}
  <path d="M${big ? -2.6 : -1.5},7.2 L${big ? 2.6 : 1.5},7.2 L0,${big ? 10 : 9} Z" fill="${k.nose}"/>
  <path d="M0,${big ? 10 : 9} q-1.8,2 -3.6,0.6 M0,${big ? 10 : 9} q1.8,2 3.6,0.6" stroke="${shade(k.furDark, 0.25)}" stroke-width="0.6" fill="none"/>
  ${whisk}
  ${accessory(c)}`
}

/** 엎드린 자세의 꼬리(원본 0~95 × 0~66 좌표) */
function loafTail(c: Creature, wag: string): string {
  const k = c.colors
  const tip = c.extras.includes('tailTip')
  switch (c.tail) {
    case 'thin': return `<path d="M74,55 C92,52 96,63 64,62" stroke="url(#body)" stroke-width="7" fill="none" stroke-linecap="round">${wag}</path>`
    case 'bushy': return `<g>${wag}<path d="M72,54 C98,44 102,64 66,62" stroke="url(#body)" stroke-width="13" fill="none" stroke-linecap="round"/>
      ${tip ? '<circle cx="67" cy="61.5" r="5.5" fill="url(#belly)"/>' : ''}</g>`
    case 'curl': return `<path d="M82,42 q11,-6 4,-15 q-6,-2 -6,4" stroke="url(#body)" stroke-width="7" fill="none" stroke-linecap="round">${wag}</path>`
    case 'pom': return `<circle cx="86" cy="47" r="6.5" fill="url(#belly)"/>`
    case 'stub': return `<ellipse cx="87" cy="46" rx="4.5" ry="3.5" fill="url(#body)"/>`
    case 'flat': return `<ellipse cx="90" cy="54" rx="10" ry="4.5" fill="${k.accent}"/>`
    default: return ''
  }
}

function loafBodyMarks(c: Creature): string {
  const k = c.colors
  if (c.pattern === 'belly' || c.snout !== 'none') return `<ellipse cx="50" cy="53" rx="22" ry="7.5" fill="url(#belly)" opacity="0.9"/>`
  if (c.pattern === 'stripes') return `<path d="M48,30 q-3,8 0,14 M60,29 q-3,8 0,15 M72,31 q-3,8 0,13" stroke="${k.accent}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
  if (c.pattern === 'spots') return `<ellipse cx="50" cy="36" rx="4" ry="3" fill="${k.accent}"/><ellipse cx="66" cy="40" rx="5" ry="3.5" fill="${k.accent}"/><ellipse cx="76" cy="48" rx="3.5" ry="2.6" fill="${k.accent}"/>`
  if (c.pattern === 'eyePatch') return `<ellipse cx="44" cy="44" rx="12" ry="14" fill="${k.accent}"/>`
  return ''
}

function loaf(c: Creature): string {
  const wag = `<animateTransform attributeName="transform" type="rotate" values="0 78 54;-4 78 54;0 78 54" dur="5s" repeatCount="indefinite"/>`
  const pawFill = c.pattern === 'eyePatch' ? c.colors.accent : 'url(#paw)'
  return `
  ${c.aura ? '<ellipse cx="52" cy="38" rx="56" ry="34" fill="url(#aura)"/>' : ''}
  <ellipse cx="50" cy="61" rx="40" ry="4" fill="url(#shadow)"/>
  ${wash(c, 54, 42, 44, 26)}
  <g${styleAttr(c)}>
  ${loafTail(c, wag)}
  <ellipse cx="56" cy="45" rx="32" ry="17" fill="url(#body)"/>
  ${loafBodyMarks(c)}
  <path d="M30,36 Q52,24 82,34" stroke="${rim(c)}" stroke-width="1.1" fill="none" opacity="0.35"/>
  <ellipse cx="29" cy="58" rx="8" ry="4.6" fill="${pawFill}"/>
  <ellipse cx="45" cy="59" rx="8" ry="4.4" fill="${pawFill}"/>
  <g transform="translate(32.5 31)">${head(c, false)}</g>
  </g>`
}

const LOAF_SCALE = 0.52


/** 그라데이션 이름을 캐릭터마다 다르게 — 한 화면에 SVG 가 여럿이면 같은 id 가 서로 덮는다 */
const GRAD = ['body', 'head', 'paw', 'belly', 'earIn', 'iris', 'shadow', 'egg', 'aura', 'wc']
function uniq(svg: string, c: Creature | null): string {
  const tag = (c ? c.id + c.colors.fur : 'egg').replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'x'
  let out = svg
  for (const g of GRAD) out = out.split(`id="${g}"`).join(`id="${g}-${tag}"`).split(`url(#${g})`).join(`url(#${g}-${tag})`)
  return out
}

export function sleepingSvg(width: number, c: Creature = BLACK_CAT, kittens = 0): string {
  const w = Math.max(60, Math.round(width))
  const z = (x: number, y: number, s: number, d: number) => `
  <text x="${x}" y="${y}" font-size="${s}" font-weight="700" fill="#8FA7D9" opacity="0" font-family="Arial, sans-serif">z
    <animate attributeName="opacity" values="0;1;0" dur="3s" begin="${d}s" repeatCount="indefinite"/>
    <animateTransform attributeName="transform" type="translate" values="0 0;4 -6" dur="3s" begin="${d}s" repeatCount="indefinite"/>
  </text>`
  return uniq(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${CAT_HEIGHT}" viewBox="0 0 ${w} ${CAT_HEIGHT}">${defs(c)}
  <g transform="translate(2 1) scale(${LOAF_SCALE})">
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.4;0 0" dur="3.2s" repeatCount="indefinite"/>
      ${loaf(c)}
    </g>
  </g>
  ${z(30, 12, 7, 0)}${z(35, 9, 8.5, 1)}${z(41, 7, 10, 2)}
  ${kittensLayer(w, kittens, c)}
  <text x="64" y="22" font-size="11" fill="#9AA4B2" font-family="Malgun Gothic, sans-serif">${esc(c.sleepLine)}</text>
</svg>`, c)
}

// ── 작업 중: 옆모습(오른쪽을 본 모습, x 0~40) ──
const CAT_W = 42
const CENTER = 20
const BUBBLE_W = 165

function legs(c: Creature, swing: number, cycle: number): string {
  const far = c.pattern === 'eyePatch' ? c.colors.accent : shade(c.colors.furDark, -0.15)
  const near = c.pattern === 'eyePatch' ? c.colors.accent : 'url(#paw)'
  const leg = (x: number, phase: number, fill: string) => `
  <rect x="${x - 1.7}" y="21" width="3.4" height="${GROUND - 21}" rx="1.7" fill="${fill}">
    <animateTransform attributeName="transform" type="rotate"
      values="${phase * swing} ${x} 22;${-phase * swing} ${x} 22;${phase * swing} ${x} 22"
      dur="${cycle}s" repeatCount="indefinite"/>
  </rect>`
  return leg(11, -1, far) + leg(27, 1, far) + leg(8, 1, near) + leg(24, -1, near)
}

function walkTail(c: Creature, run: boolean): string {
  const wag = `<animateTransform attributeName="transform" type="rotate" values="-8 6 19;12 6 19;-8 6 19"
        dur="${run ? 0.5 : 1.2}s" repeatCount="indefinite"/>`
  const tip = c.extras.includes('tailTip')
  switch (c.tail) {
    case 'thin': return `<path d="M6,19 C-1,14 0,4 5,3" stroke="url(#body)" stroke-width="3.4" fill="none" stroke-linecap="round">${wag}</path>`
    case 'bushy': return `<g>${wag}<path d="M7,18 C-3,16 -6,7 0,5" stroke="url(#body)" stroke-width="6.5" fill="none" stroke-linecap="round"/>
      ${tip ? '<circle cx="0" cy="5.5" r="2.8" fill="url(#belly)"/>' : ''}</g>`
    case 'curl': return `<path d="M6,15 q-6,-2 -3,-8 q3,-1 3,2" stroke="url(#body)" stroke-width="3.4" fill="none" stroke-linecap="round">${wag}</path>`
    case 'pom': return `<circle cx="4" cy="16.5" r="3.4" fill="url(#belly)"/>`
    case 'stub': return `<ellipse cx="4.5" cy="16" rx="2.4" ry="1.8" fill="url(#body)"/>`
    case 'flat': return `<ellipse cx="2" cy="22" rx="5" ry="2.2" fill="${c.colors.accent}">${wag}</ellipse>`
    default: return ''
  }
}

function walkBodyMarks(c: Creature): string {
  const k = c.colors
  if (c.pattern === 'belly' || c.snout !== 'none') return `<ellipse cx="18" cy="23" rx="8" ry="3.2" fill="url(#belly)" opacity="0.9"/>`
  if (c.pattern === 'stripes') return `<path d="M12,12 q-1,4 0,8 M17,11.5 q-1,4 0,8.5 M22,12 q-1,4 0,8" stroke="${k.accent}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  if (c.pattern === 'spots') return `<ellipse cx="12" cy="16" rx="2" ry="1.5" fill="${k.accent}"/><ellipse cx="19" cy="15" rx="2.4" ry="1.7" fill="${k.accent}"/><ellipse cx="15" cy="21" rx="1.8" ry="1.3" fill="${k.accent}"/>`
  if (c.pattern === 'eyePatch') return `<ellipse cx="23" cy="19" rx="5" ry="7.4" fill="${k.accent}"/>`
  return ''
}

function walker(c: Creature, pace: Pace, kitten = false): string {
  const run = pace === 'run'
  const cycle = kitten ? 0.26 : run ? 0.32 : 0.62
  const swing = run ? 34 : 18
  const bounce = kitten ? 5 : run ? 2.6 : 1.1
  return `
  ${c.aura && !kitten ? `<ellipse cx="${CENTER + 4}" cy="17" rx="27" ry="17" fill="url(#aura)"/>` : ''}
  <ellipse cx="${CENTER}" cy="${GROUND + 1}" rx="15" ry="2" fill="url(#shadow)"/>
  ${kitten ? '' : wash(c, CENTER + 2, 16, 22, 14)}
  <g${styleAttr(c)}>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 ${-bounce};0 0"
      dur="${cycle / 2}s" repeatCount="indefinite"/>
    ${walkTail(c, run)}
    ${legs(c, swing, cycle)}
    <ellipse cx="17" cy="19" rx="12.5" ry="7.5" fill="url(#body)"/>
    ${walkBodyMarks(c)}
    <path d="M7,15 Q16,10 27,13" stroke="${rim(c)}" stroke-width="0.8" fill="none" opacity="0.35"/>
    <g transform="translate(31 12.5) scale(0.48)">${head(c, true)}</g>
  </g>`
}

/** 새끼 n 마리 — 서브에이전트 수만큼. 각자 다른 속도·출발점으로 폭 전체를 뛰논다 */
export function kittensLayer(width: number, n: number, c: Creature = BLACK_CAT): string {
  const out: string[] = []
  const count = Math.min(Math.max(0, n), 6)
  for (let i = 0; i < count; i++) {
    const s = 0.5 + (i % 3) * 0.05
    const kw = CAT_W * s
    const travel = Math.max(0, width - kw - 4)
    const speed = 70 + ((i * 37) % 50)
    const dur = Math.max(1.2, (travel * 2) / speed).toFixed(2)
    const begin = (-(i * 1.7) % Number(dur)).toFixed(2)
    const y = (1 - s) * GROUND + 2
    out.push(`
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 ${y};${travel} ${y};0 ${y}"
      dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
    <g transform="scale(${s})">
      <g transform="translate(${CENTER} 0)"><g>
        <animateTransform attributeName="transform" type="scale" values="1 1;-1 1" keyTimes="0;0.5"
          calcMode="discrete" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
        <g transform="translate(${-CENTER} 0)">${walker(c, 'run', true)}</g>
      </g></g>
    </g>
  </g>`)
  }
  return out.join('')
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 작업 중 — 폭 width(px) 안에서 왼쪽 끝 ↔ 오른쪽 끝을 오가며, 끝에서 몸을 돌린다 */
export function workingSvg(width: number, pace: Pace, c: Creature = BLACK_CAT, kittens = 0): string {
  const w = Math.max(CAT_W + 20, Math.round(width))
  const travel = Math.max(0, w - CAT_W - BUBBLE_W - 4)
  const speed = pace === 'run' ? 95 : 32
  const leg = Math.max(1.2, travel / speed)
  const dur = (leg * 2).toFixed(2)
  const lines = pace === 'run' ? c.runLines : c.lines
  const n = lines.length
  const bubbles = lines.map((t, i) => {
    const a = (i / n).toFixed(3)
    const b = ((i + 1) / n).toFixed(3)
    const [vals, keys] = n === 1 ? ['1', '0'] : i === 0 ? ['1;0', `0;${b}`]
      : i === n - 1 ? ['0;1', `0;${a}`]
      : ['0;1;0', `0;${a};${b}`]
    return `<text x="${CAT_W + 3}" y="15" font-size="10.5" font-weight="600" fill="#E9A15B"
      font-family="Malgun Gothic, sans-serif" opacity="${n === 1 ? 1 : 0}">${esc(t)}<animate attributeName="opacity"
      values="${vals}" keyTimes="${keys}" calcMode="discrete" dur="${n * 4}s" repeatCount="indefinite"/></text>`
  }).join('')
  return uniq(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${CAT_HEIGHT}" viewBox="0 0 ${w} ${CAT_HEIGHT}">${defs(c)}
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 2;${travel} 2;0 2"
      dur="${dur}s" repeatCount="indefinite"/>
    <g transform="translate(${CENTER} 0)"><g>
      <animateTransform attributeName="transform" type="scale" values="1 1;-1 1" keyTimes="0;0.5"
        calcMode="discrete" dur="${dur}s" repeatCount="indefinite"/>
      <g transform="translate(${-CENTER} 0)">${walker(c, pace)}</g>
    </g></g>
    ${bubbles}
  </g>
  ${kittensLayer(w, kittens, c)}
</svg>`, c)
}

/** 캐릭터를 정하는 동안 — 흔들리는 알 */
export function eggSvg(width: number, msg: string): string {
  const w = Math.max(60, Math.round(width))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${CAT_HEIGHT}" viewBox="0 0 ${w} ${CAT_HEIGHT}">
  <defs><radialGradient id="egg" cx="38%" cy="30%" r="75%">
    <stop offset="0%" stop-color="#FFFFFF"/><stop offset="60%" stop-color="#F3ECDD"/><stop offset="100%" stop-color="#CDBF9F"/>
  </radialGradient></defs>
  <ellipse cx="16" cy="33.5" rx="10" ry="1.8" fill="#000" opacity="0.18"/>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="0 16 33;-9 16 33;0 16 33;8 16 33;0 16 33"
      keyTimes="0;0.1;0.2;0.3;1" dur="2.4s" repeatCount="indefinite"/>
    <ellipse cx="16" cy="19" rx="10" ry="13.5" fill="url(#egg)"/>
    <ellipse cx="12" cy="15" rx="2.2" ry="1.6" fill="#E3C79C"/><ellipse cx="19" cy="23" rx="2.6" ry="1.9" fill="#E3C79C"/>
    <ellipse cx="11.5" cy="11" rx="2.6" ry="3.6" fill="#fff" opacity="0.6"/>
  </g>
  <text x="34" y="22" font-size="11" fill="#9AA4B2" font-family="Malgun Gothic, sans-serif">${esc(msg)}</text>
</svg>`
}

// ── 터미널 픽셀아트 ─────────────────────────────────────
// 셀 하나 = 위·아래 두 픽셀(▀ 앞색=위, 뒷색=아래). 4줄 = 세로 8픽셀.
export const TERM_ROWS = 4
const PX_H = TERM_ROWS * 2
const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584

type Px = (number | null)[][]          // [y][x] = 0xRRGGBB 또는 null(투명)

function grid(w: number): Px {
  return Array.from({ length: PX_H }, () => Array<number | null>(w).fill(null))
}

const toNum = (h: string) => parseInt(h.slice(1), 16)

/** 터미널 배경(대개 검정)에서 보이게 — 아주 어두운 털은 조금 밝힌다 */
function termPalette(c: Creature) {
  const k = c.colors
  const lift = (h: string) => (luma(h) < 0.2 ? shade(h, 0.28) : h)
  return {
    F: toNum(lift(k.fur)), D: toNum(lift(k.furDark)), B: toNum(k.belly), A: toNum(lift(k.accent)),
    P: toNum(k.earIn), E: toNum(k.eye), N: toNum(k.nose), K: 0x15151a, C: toNum(c.accessoryColor),
  }
}

function ellipse(g: Px, cx: number, cy: number, rx: number, ry: number, color: number) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1) g[y][x] = color
    }
}

function put(g: Px, x: number, y: number, color: number) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = color
}

/** 옆모습 걷기 한 장(오른쪽을 봄) — 16×8 픽셀, legFrame 0/1 */
export function walkSprite(c: Creature, legFrame: number): Px {
  const p = termPalette(c)
  const g = grid(16)
  // 꼬리
  switch (c.tail) {
    case 'thin': put(g, 0, 2, p.F); put(g, 1, 3, p.F); put(g, 1, 4, p.F); break
    case 'bushy': ellipse(g, 1.3, 3.2, 1.6, 2, p.F); if (c.extras.includes('tailTip')) put(g, 0, 2, p.B); break
    case 'curl': put(g, 1, 2, p.F); put(g, 0, 3, p.F); put(g, 1, 4, p.F); break
    case 'pom': put(g, 1, 4, p.B); put(g, 0, 4, p.B); break
    case 'stub': put(g, 1, 4, p.F); break
    case 'flat': put(g, 0, 5, p.A); put(g, 1, 5, p.A); put(g, 0, 6, p.A); break
  }
  // 몸통·다리
  const legs = legFrame ? [3, 6, 9, 11] : [2, 5, 8, 10]
  for (const x of legs) put(g, x, 7, c.pattern === 'eyePatch' ? p.A : p.D)
  ellipse(g, 6.5, 5, 5.2, 2, p.F)
  for (let x = 2; x <= 10; x++) if (g[6][x] !== null) g[6][x] = p.D
  if (c.pattern === 'belly' || c.snout !== 'none') for (let x = 4; x <= 9; x++) put(g, x, 6, p.B)
  if (c.pattern === 'stripes') for (const x of [4, 6, 8]) { put(g, x, 4, p.A); put(g, x, 5, p.A) }
  if (c.pattern === 'spots') { put(g, 4, 4, p.A); put(g, 8, 5, p.A); put(g, 6, 4, p.A) }
  if (c.pattern === 'eyePatch') for (let y = 4; y <= 6; y++) { put(g, 9, y, p.A); put(g, 10, y, p.A) }
  // 갈기·머리
  if (c.extras.includes('mane')) ellipse(g, 12.2, 3.4, 4.4, 3.4, p.A)
  switch (c.ears) {
    case 'pointed': case 'bigPointed':
      put(g, 10, 0, p.F); put(g, 14, 0, p.F)
      if (c.ears === 'bigPointed') { put(g, 10, 1, p.P); put(g, 14, 1, p.P) }
      if (c.extras.includes('earTips')) { put(g, 10, 0, p.A); put(g, 14, 0, p.A) }
      break
    case 'long': put(g, 11, 0, p.F); put(g, 13, 0, p.F); put(g, 11, 1, p.P); put(g, 13, 1, p.P); break
    case 'round': put(g, 10, 1, c.pattern === 'eyePatch' ? p.A : p.F); put(g, 14, 1, c.pattern === 'eyePatch' ? p.A : p.F); break
    case 'small': put(g, 10, 1, p.F); put(g, 14, 1, p.F); break
    case 'horns': put(g, 10, 0, p.B); put(g, 14, 0, p.B); break
  }
  ellipse(g, 12.2, 3.4, 3.5, 2.6, p.F)
  if (c.ears === 'floppy') { put(g, 9, 2, p.D); put(g, 9, 3, p.D); put(g, 15, 2, p.D) }
  if (c.pattern === 'mask') for (let x = 9; x <= 15; x++) if (g[3][x] !== null) g[3][x] = p.A
  if (c.snout !== 'none' || c.extras.includes('cheeks')) { put(g, 14, 4, p.B); put(g, 15, 4, p.B); put(g, 13, 5, p.B) }
  if (c.pattern === 'eyePatch') { put(g, 10, 3, p.A); put(g, 14, 3, p.A) }
  put(g, 11, 3, p.E); put(g, 13, 3, p.E)
  put(g, 15, 4, p.N)
  switch (c.accessory) {
    case 'bowtie': case 'scarf': case 'collar': put(g, 12, 6, p.C); put(g, 13, 6, p.C); break
    case 'ribbon': put(g, 14, 0, p.C); put(g, 15, 0, p.C); break
    case 'flower': put(g, 10, 0, p.C); break
    case 'hat': put(g, 11, 0, p.C); put(g, 12, 0, p.C); put(g, 13, 0, p.C); break
    case 'glasses': put(g, 12, 3, p.C); break
  }
  return g
}

/** 엎드려 졸기 — 16×8 픽셀(머리 왼쪽, 감은 눈) */
export function sleepSprite(c: Creature): Px {
  const p = termPalette(c)
  const g = grid(16)
  if (c.tail === 'thin' || c.tail === 'bushy' || c.tail === 'curl') { put(g, 15, 6, p.F); put(g, 15, 5, p.F); put(g, 14, 7, p.F) }
  else if (c.tail === 'pom') put(g, 15, 5, p.B)
  else if (c.tail === 'stub') put(g, 15, 5, p.F)
  else if (c.tail === 'flat') { put(g, 15, 7, p.A); put(g, 14, 7, p.A) }
  ellipse(g, 9.6, 5.6, 5.9, 2.3, p.F)
  for (let x = 6; x <= 14; x++) if (g[7][x] !== null) g[7][x] = p.D
  if (c.pattern === 'stripes') for (const x of [9, 11, 13]) put(g, x, 4, p.A)
  if (c.pattern === 'spots') { put(g, 10, 4, p.A); put(g, 13, 5, p.A) }
  if (c.pattern === 'eyePatch') for (let y = 4; y <= 7; y++) put(g, 7, y, p.A)
  if (c.extras.includes('mane')) ellipse(g, 4.6, 4.3, 4.4, 3.6, p.A)
  switch (c.ears) {
    case 'pointed': case 'bigPointed': put(g, 2, 1, p.F); put(g, 7, 1, p.F); break
    case 'long': put(g, 3, 0, p.F); put(g, 6, 0, p.F); put(g, 3, 1, p.P); put(g, 6, 1, p.P); break
    case 'round': case 'small': put(g, 2, 2, c.pattern === 'eyePatch' ? p.A : p.F); put(g, 7, 2, c.pattern === 'eyePatch' ? p.A : p.F); break
    case 'horns': put(g, 3, 1, p.B); put(g, 6, 1, p.B); break
  }
  ellipse(g, 4.6, 4.5, 3.7, 2.9, p.F)
  if (c.ears === 'floppy') { put(g, 1, 4, p.D); put(g, 8, 4, p.D) }
  if (c.pattern === 'mask') for (let x = 1; x <= 8; x++) if (g[4][x] !== null) g[4][x] = p.A
  if (c.snout !== 'none') { put(g, 4, 6, p.B); put(g, 5, 6, p.B) }
  if (c.extras.includes('cheeks')) { put(g, 2, 6, p.B); put(g, 7, 6, p.B) }
  put(g, 3, 4, p.K); put(g, 6, 4, p.K)          // 감은 눈
  put(g, 4, 5, p.N)
  put(g, 3, 7, p.B); put(g, 5, 7, p.B)          // 앞발
  switch (c.accessory) {
    case 'bowtie': case 'scarf': case 'collar': put(g, 4, 7, p.C); break
    case 'ribbon': put(g, 7, 0, p.C); put(g, 8, 0, p.C); break
    case 'flower': put(g, 2, 0, p.C); break
    case 'hat': put(g, 3, 0, p.C); put(g, 4, 0, p.C); put(g, 5, 0, p.C); break
    case 'glasses': put(g, 4, 4, p.C); put(g, 5, 4, p.C); break
  }
  return g
}

export function eggSprite(wobble: number): Px {
  const g = grid(8)
  ellipse(g, 4 + wobble * 0.4, 4.2, 2.8, 3.8, 0xf3ecdd)
  put(g, 3 + wobble, 3, 0xe3c79c); put(g, 5, 5, 0xe3c79c)
  return g
}

/** 새끼 — 6×4 픽셀(아래쪽 절반에 붙인다) */
export function kittenSprite(c: Creature, legFrame: number): Px {
  const p = termPalette(c)
  const g = grid(6)
  ellipse(g, 2.2, 6, 2, 1.1, p.F)
  ellipse(g, 4.3, 5, 1.4, 1.2, p.F)
  put(g, 4, 3, p.F); put(g, 5, 3, p.F)
  put(g, 5, 5, p.E)
  put(g, legFrame ? 1 : 0, 7, p.D); put(g, legFrame ? 4 : 3, 7, p.D)
  put(g, 0, 5, p.F)
  return g
}

/** 스프라이트를 캔버스에 찍는다(flip 이면 좌우 뒤집기) */
export function blitSprite(canvas: Px, s: Px, x0: number, flip = false) {
  const w = s[0].length
  for (let y = 0; y < s.length; y++)
    for (let x = 0; x < w; x++) {
      const v = s[y][flip ? w - 1 - x : x]
      if (v !== null) put(canvas, Math.round(x0) + x, y, v)
    }
}

export function canvas(cols: number): Px {
  return grid(cols)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? B64[n & 63] : '='
  }
  return out
}

/** 픽셀 → Raster 셀(base64). overlay 는 [열, 줄, 글자, 색] — 'z' 같은 글자를 얹는다 */
export function encodeCells(g: Px, overlay: [number, number, string, number][] = []): string {
  const cols = g[0].length
  const words = new Uint32Array(cols * TERM_ROWS * 3)
  for (let r = 0; r < TERM_ROWS; r++)
    for (let x = 0; x < cols; x++) {
      const top = g[r * 2][x]
      const bot = g[r * 2 + 1][x]
      let cp = 0x20, fg = DEFAULT, bg = DEFAULT
      if (top !== null && bot !== null) { cp = UPPER; fg = top; bg = bot }
      else if (top !== null) { cp = UPPER; fg = top }
      else if (bot !== null) { cp = LOWER; fg = bot }
      const i = (r * cols + x) * 3
      words[i] = cp; words[i + 1] = fg; words[i + 2] = bg
    }
  for (const [x, r, ch, color] of overlay) {
    if (x < 0 || x >= cols || r < 0 || r >= TERM_ROWS) continue
    const i = (r * cols + x) * 3
    if (words[i] !== 0x20) continue                 // 그림 위에는 얹지 않는다
    words[i] = ch.codePointAt(0) ?? 0x20; words[i + 1] = color; words[i + 2] = DEFAULT
  }
  // 리틀엔디언 u32 — 실행 환경과 무관하게 직접 바이트로
  const bytes = new Uint8Array(words.length * 4)
  for (let i = 0; i < words.length; i++) {
    const v = words[i]
    bytes[i * 4] = v & 255; bytes[i * 4 + 1] = (v >>> 8) & 255
    bytes[i * 4 + 2] = (v >>> 16) & 255; bytes[i * 4 + 3] = (v >>> 24) & 255
  }
  return base64(bytes)
}
