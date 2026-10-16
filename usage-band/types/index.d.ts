/** 한 사용량 창: 5시간(five_hour)·주간(seven_day) 등 */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Pace = 'walk' | 'run'
export type Ears = 'pointed' | 'bigPointed' | 'floppy' | 'long' | 'round' | 'small' | 'horns' | 'none'
export type Tail = 'thin' | 'bushy' | 'curl' | 'pom' | 'stub' | 'flat' | 'none'
export type Pattern = 'none' | 'belly' | 'mask' | 'eyePatch' | 'stripes' | 'spots'
export type Snout = 'none' | 'muzzle' | 'long'
export type Extra = 'whiskers' | 'mane' | 'cheeks' | 'tailTip' | 'earTips'
export type Accessory = 'none' | 'bowtie' | 'ribbon' | 'scarf' | 'collar' | 'flower' | 'hat' | 'glasses'
export type Style = 'plain' | 'watercolor' | 'glossy'

/** 띠의 캐릭터 — 지난 대화 맥락으로 모델이 고른 동물을 부품으로 적은 것 */
export type Creature = {
  id: string
  name: string
  reason: string
  ears: Ears
  tail: Tail
  pattern: Pattern
  snout: Snout
  extras: Extra[]
  colors: { fur: string; furDark: string; belly: string; accent: string; earIn: string; eye: string; nose: string }
  lines: string[]
  runLines: string[]
  sleepLine: string
  /** 소품과 그 색 — 보타이·리본·목도리·목걸이(방울)·꽃·모자·안경 */
  accessory: Accessory
  accessoryColor: string
  /** 화풍 — plain(기본) · watercolor(물감 번짐) · glossy(광택) */
  style: Style
  /** 눈 크기 배율(0.8~1.5) */
  eyeSize: number
  /** 뒤에 은은한 빛무리 색(없으면 '') — "꿈꾸는 듯한 파스텔 배경" 같은 것 */
  aura: string
  /** 사용자가 직접 적은 설명(있으면) */
  prompt?: string
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { limits: Limit[]; pace: Pace; kittens: number; pet: Creature | null }
  }
}
