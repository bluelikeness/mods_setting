# mods_setting — Claude Code 개인 mod 모음

로컬 마켓플레이스 `kckang-mods` 의 원본입니다. 이 폴더(`~/.claude/mods`)를 Claude Code 가 직접 읽습니다.

| mod | 위치 | 하는 일 |
|---|---|---|
| `usage-band` | 프롬프트 바로 위 띠 | 지난 대화 맥락으로 정한 마스코트 동물(쉴 땐 졸고, 일할 땐 걷고, 바쁘면 뛰고, 서브에이전트 수만큼 새끼) + 5시간·주간 한도와 초기화 시각 |
| `session-cost` | 프롬프트 아래 상태 줄 | 이번 세션 비용(원화·달러)과 컨텍스트 사용량 |

## 설치

마켓플레이스(`kckang-mods`)로 등록한 뒤 플러그인을 설치합니다. 공개 저장소라 저장소 호스트 에 닿기만 하면 로그인 없이 받아집니다.

```bash
claude plugin marketplace add <repository-url>
claude plugin install usage-band@kckang-mods --scope user
claude plugin install session-cost@kckang-mods --scope user
```

설치 뒤 Claude Code 입력창에서 `/reload-plugins`.

업데이트:

```bash
claude plugin marketplace update kckang-mods
claude plugin update usage-band@kckang-mods
claude plugin update session-cost@kckang-mods
```

### mod 를 고치는 사람(개발용)

이 저장소를 `~/.claude/mods` 에 두고 로컬 폴더를 마켓플레이스로 등록하면, 고친 내용이 설치 없이 바로 읽힙니다.

```bash
git clone <repository-url> ~/.claude/mods
claude plugin marketplace add ~/.claude/mods
```

- 고친 뒤에는 Claude Code 입력창에서 `/reload-plugins` 를 실행하면 반영됩니다. 다시 설치할 필요는 없습니다.
- 시험: `claude plugin test ~/.claude/mods/usage-band`, `claude plugin test ~/.claude/mods/session-cost`
- 환율 바꾸기: `claude plugin configure session-cost@kckang-mods` 에서 `krwPerUsd` 를 바꿉니다(기본 1400).
- 캐릭터: 설치 후 처음 불릴 때 한 번, 지난 여러 세션의 대화(사용자 질문)와 메모리 목차를 읽고 어울리는 동물을 정해
  이 PC 에 저장합니다(정하는 동안은 알). `/usage-band` 지금 캐릭터와 이유 · `/usage-band reroll` 다시 정하기 ·
  `/usage-band reset` 검은 고양이로. 처음부터 검은 고양이로 쓰려면 `usage-band` 의 userConfig `character` 를 `black-cat` 으로.

## 처음부터 만드는 프롬프트

다른 사람이 같은 mod 를 직접 만들게 할 때 Claude Code 에 그대로 붙여 넣습니다.

```text
/plugin-authoring 아래 두 mod 를 만들어줘. 둘 다 모든 세션에서 쓰도록 로컬 마켓플레이스에 넣고
사용자 범위로 설치하고, 고친 뒤엔 /reload-plugins 로 반영되게 해줘.
각각 claude plugin validate 와 테스트를 통과시켜줘.

════════════════════════════════════════════
① usage-band — 프롬프트 바로 위 띠(AbovePrompt)
════════════════════════════════════════════
[레이아웃]
- 한 줄짜리 띠. 바깥 Box 는 row · flexWrap nowrap · alignItems center · justifyContent space-between,
  배경은 transparent. 칸을 % 폭으로 나누지 말 것(작은 Text 들이 한 글자씩 세로로 꺾인다).
- 왼쪽: 고양이 영역(왼쪽 끝 ~ 한도 줄 바로 앞). 오른쪽 끝: 한도 한 줄(flexShrink 0).
- 표면은 e.surface 로 가른다. 터미널에서도 `'Svg' in els` 가 참으로 나오므로 그걸로 가르면 안 된다.

[캐릭터 — 지난 대화 맥락으로 정하는 마스코트 동물]
- 설치 후 처음 불릴 때 한 번 정해 $.store('creature')에 저장한다(세션이 바뀌어도 그대로). 정하는 동안은 흔들리는 알.
- 근거: ~/.claude/projects/*/*.jsonl 최근 25개(4MiB 미만)에서 사용자 질문만(도구 결과·명령 메아리·<…> 알림 제외,
  한 개 200자, 최대 120개) + 각 프로젝트 memory/MEMORY.md 앞부분(합계 3000자). ~/.claude 는 $.plugin.root 에서 찾는다.
- $.model.complete(sonnet)에 보내 동물을 **자유롭게** 고르게 하고(흔한 동물에 얽매이지 말 것), 그 동물을 부품 사양 JSON 으로 받는다:
  ears(pointed·bigPointed·floppy·long·round·small·horns·none) · tail(thin·bushy·curl·pom·stub·flat·none) ·
  pattern(none·belly·mask·eyePatch·stripes·spots) · snout(none·muzzle·long) · extras(whiskers·mane·cheeks·tailTip·earTips) ·
  colors(fur·furDark·belly·accent·earIn·eye·nose, #RRGGBB) · 이름·이유·말투 문구(lines 5·runLines 3·sleepLine).
  응답은 믿지 않고 고친다(모르는 부품·색은 기본값). 실패하면 검은 고양이.
- 명령: /usage-band(지금 캐릭터·이유) · reroll(다시 정하기) · reset(검은 고양이). userConfig character=black-cat 이면 그걸로 시작.
- 그리는 중(ui.render)에는 상태를 쓸 수 없다 — 불러오기·정하기는 $.clock.after 로 그리기 뒤에 돈다.

[왼쪽 — 캐릭터 그림 (데스크톱은 Svg + SMIL)]
- 데스크톱 Svg 는 스크립트 없는 샌드박스라 Three.js/WebGL 은 불가 → 방사형 그라데이션(위 왼쪽 광원),
  테두리 반사광, 바닥 그림자로 입체감. 높이 36px, viewBox 를 px 단위로. 그라데이션 id 는 캐릭터마다 다르게(한 화면에서 덮인다).
- 부품 사양으로 그린다: 머리(원점 기준 좌표계에 귀·갈기·무늬·주둥이·볼·눈·코·수염), 몸통·꼬리·다리는 자세별 좌표계.
  큰 눈(홍채 그라데이션·큰 동공·흰 하이라이트 2개), 둥근 앞발.
- 쉬는 중(isWorking=false): 앞발 모은 식빵 자세로 왼쪽 끝에서 존다(감은 눈, 숨쉬듯 들썩, z 3개 떠오름), 옆에 sleepLine.
- 작업 중: 옆모습으로 왼쪽 끝 ↔ 한도 줄 앞까지 왕복, 끝에서 몸을 돌린다(이동 g → 중심 기준 scale -1 discrete 뒤집기).
  다리 4개 대각선 교대, 몸 통통 튐, 꼬리 흔들기, 눈 깜빡임.
  말풍선은 캐릭터 오른쪽에 붙어 함께 움직이되 뒤집기 바깥에 둔다(글자가 거울상이 되지 않게).
  이동 거리 = 캐릭터 영역 폭 − 캐릭터 폭 − 말풍선 폭.
- 바쁨: 최근 20초에 도구 호출(tool.call)이 4번 이상이면 뛰기(다리 0.32초 주기·튐 크게·약 95px/초,
  말풍선 runLines), 아니면 걷기(0.62초·약 32px/초, 말풍선 lines 를 4초마다 discrete opacity 로 교대).
  바쁨이 바뀔 때만 상태를 갱신한다(그림이 처음부터 다시 시작되므로).
- 새끼: $.agent.list() 중 status 가 running 인 서브에이전트 수만큼(최대 6) 같은 동물의 새끼(0.5~0.6배)가
  각자 다른 속도·출발점으로 폭 전체를 깡총깡총 뛰논다. 엄마가 졸고 있어도 서브에이전트가 돌면 논다.
  agent.spawn 뒤, 서브에이전트의 turn.complete(e.agentId 있음) 뒤, 10초 틱마다 다시 센다.
- 고양이 영역 폭은 e.props.bodyColumns × 7.2px − 한도 줄 폭 − 16 으로 어림(최소 120).
- 터미널은 반칸 블록(▀▄) 픽셀아트: Raster(4줄=세로 8픽셀, 셀=[글자, 앞색, 뒷색] u32 base64)에 같은 부품 사양으로
  16×8 걷기 2장·졸기 1장·새끼 6×4·알을 찍고, 150ms 마다 $.ui.blit 으로 바꿔 끼워 움직인다(셀이 같으면 생략,
  deny 면 타이머 정지 후 다음 그리기에서 재시작). 아주 어두운 털은 터미널 배경에서 보이게 조금 밝힌다. 졸 때는 z 글자를 얹는다.
  옆에 지금 말(sleepLine·lines)을 흐린 글씨로.

[오른쪽 — 한도 한 줄]
- $.session.usage() / session.measure 의 rateLimits(five_hour, seven_day) — 한쪽 값이 아직 없으면 "5시간 -" 로 자리를 지킨다:
  "5시간 17% · 4분 뒤 초기화 │ 주간 27% · 10/18(일) 07:00 초기화".
  초기화 시각은 UTC+9 로 직접 계산(실행 환경 시간대와 무관). 5시간은 남은 시간, 주간은 날짜·시각.
- 데스크톱은 작은 Svg 로 그린다(Text 에는 글자 크기 속성이 없다):
  이름 13px 굵게 파랑(#3B82F6), 사용률 13px 굵게 — 50% 미만 #16A34A · 보통 #6B7280 · 80%↑ #D97706 · 95%↑ #DC2626,
  " · 초기화" 부분은 10.5px 회색(#8A93A0), 구분선 #B0B7C3. 폭은 글자 수로 어림(한글 1em·영숫자 0.62em·공백 0.3em),
  text-anchor end, 공백은 &#160;. alt 에는 같은 문구를 평문으로.
- 터미널은 Text 조각(이름 suggestion 굵게, 사용률 success/warning/error, 초기화 subtle dim).
- 첫 API 응답 전엔 "한도: 첫 응답 뒤에 표시". 설문(hasSurvey)이 뜨면 비켜준다.

[갱신]
- 10초마다 $.session.usage() 를 다시 읽고(값이 바뀐 때만 상태 갱신) 띠를 다시 그린다.
  엔진 측정 알림은 턴 끝·1%p 움직임에만 와서, 이것만으로는 긴 작업 중 멈춰 보인다.
- 타이머가 25초 넘게 안 돌았으면(끊김·거절) 다시 켠다.
- AbovePrompt 는 플러그인 하나만 그린다 — 같은 자리를 그리는 다른 mod 가 있으면 합치거나 끈다.

[테스트]
- 시간 문구·걷기/뛰기 판정·한도 Svg(10.5px 초기화·색).
- 쉬는/걷는/뛰는 고양이, 서브에이전트 3개 → "새끼 고양이 3마리". 테스트 ElementQuery 는 props 로 못 찾으니
  ui.drawn() 의 JSON 에서 alt 를 확인한다.
- 터미널 글자 고양이, 10초 갱신(mock.clock).

════════════════════════════════════════════
② session-cost — 프롬프트 아래 상태 줄
════════════════════════════════════════════
- $.ui.status 로 상태 줄에 한 줄:
  "이번 세션 ₩87,234 ($62.31) · 컨텍스트 44% (439k/1.0M)".
- 비용은 $.session.usage().cost.usd(= /cost 와 같은 세션 합계)를 원화로. 천 단위 쉼표는 Intl 없이 직접.
  환율은 userConfig krwPerUsd(숫자, 기본 1400, 제목 "원/달러 환율")로 받는다.
- 컨텍스트는 usage().context 의 tokens/window/percent. 토큰 수는 짧게(950 · 90k · 1.0M).
  tokens 가 없으면 "컨텍스트 -".
- 갱신: session.start 에서 한 번, session.measure 알림마다, 그리고 30초마다 다시 읽는다
  (측정 알림은 턴이 끝날 때만 와서 긴 작업 중 멈춰 보인다). 문구가 같으면 다시 쓰지 않는다.
- 상태 줄은 글자만 받는다 — 색은 넣을 수 없다(띠와 달리 Text·Svg 를 못 쓴다).
- 띠(AbovePrompt)는 usage-band 가 쓰므로 이 mod 는 상태 줄만 쓴다.
- 테스트: 쉼표·짧은 토큰 문구, line() 문구, 측정 알림과 30초 갱신(mock.clock)으로 상태 줄이 바뀌는지.
```
