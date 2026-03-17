# ⚔️ 롤 내전 봇 (LoL In-House Bot)

Discord에서 롤 내전을 자동으로 관리해주는 봇입니다.
Riot API 기반 전적 분석 + 최적 팀 매칭 + 음성 채널 자동 분배를 지원합니다.

## 주요 기능

| 명령어                    | 설명                                             |
| ------------------------- | ------------------------------------------------ |
| `!연동 소환사명#태그`     | Riot 계정 추가 연동                              |
| `!연동목록`               | 내가 연동한 Riot 계정 목록 조회                  |
| `!대표 소환사명#태그`     | 대표 계정 변경                                   |
| `!연동해제 소환사명#태그` | 특정 Riot 계정 연동 해제                         |
| `!전적 [소환사명#태그]`   | 전적 조회, 인자 있으면 아무 Riot 계정이나 조회   |
| `!라인 [1순위] [2순위]`   | 선호 라인 등록 (탑/정글/미드/원딜/서폿)          |
| `!티어세팅 ...`           | 계정별 수동 티어 보정 / 해제                     |
| `!내전`                   | 내전 모집 시작, 참가자는 대표 계정 기준으로 분석 |
| `!결과 블루승/레드승`     | 내전 결과 기록                                   |
| `!랭킹`                   | 서버 내 내전 승률 랭킹                           |

## 다계정 연동 방식

- 디스코드 유저 1명은 여러 Riot 계정을 연동할 수 있습니다.
- 처음 연동한 계정은 자동으로 `대표 계정`이 됩니다.
- `!전적` 처럼 계정을 따로 지정하지 않는 명령어는 대표 계정을 사용합니다.
- `!내전` 팀 분석도 각 참가자의 대표 계정을 기준으로 진행됩니다.
- 언랭이거나 실제 랭크가 팀 밸런스에 맞지 않는 경우 `!티어세팅`으로 계정별 수동 티어를 지정할 수 있습니다.

## 팀 매칭 알고리즘

10명의 참가자를 5:5로 나눌 때 C(10,5) = 252개 조합을 전수 탐색하여 최적의 팀을 구성합니다.

### 1. 유저별 종합 점수 산출

Riot API에서 가져온 데이터로 각 유저의 점수를 계산합니다:

```
score = 티어 점수 × 0.4 + 주 라인 숙련도 × 0.2 + 챔피언 풀 × 0.15
```

- **티어 점수** — UNRANKED(0) ~ CHALLENGER(10), 디비전별 +0~0.75
  `!티어세팅 골드2` 또는 `!티어세팅 Hide on bush#KR1 골드2` 형태로 수동 보정 가능
- **주 라인 숙련도** — 주 라인 플레이 비율
- **챔피언 풀** — 숙련도 상위 챔피언 수

KDA 기반 플레이 스타일도 분석합니다:

- 🗡️ 캐리형 — 킬 비중 높고 딜량 높음
- 🛡️ 탱커형 — 받은 피해량이 딜량보다 높음
- 🤝 팀플형 — 어시스트 비중 높음

### 2. 252개 조합 전수 탐색

각 조합마다 3가지 기준으로 점수를 매깁니다:

```
총점 = (팀 총점 차이 × 5) + (라인별 점수 차이 합 × 2) + (성향 불균형 패널티)
```

- **팀 총점 차이** — 블루팀 합산 vs 레드팀 합산 (가중치 5, 가장 중요)
- **라인별 차이** — 탑 vs 탑, 미드 vs 미드 등 같은 라인끼리 점수 차이 (가중치 2)
- **성향 불균형** — 캐리형/탱커형/팀플형이 한쪽에 몰리면 패널티

### 3. 라인 배정

5명에게 TOP/JG/MID/ADC/SUP을 배정할 때 5! = 120가지 배치를 모두 시도합니다:

- 주 라인 배정 → 패널티 0
- 부 라인 배정 → 패널티 0.5
- 그 외 라인 → 패널티 1

`!라인` 명령어로 등록한 선호 라인이 우선 반영됩니다.

### 4. 최적 조합 선택

252개 조합 × 120가지 라인 배치 ≈ 30,000번 계산 후, 총점이 가장 낮은 조합이 최종 팀이 됩니다.

## 음성 채널 자동 분배

팀이 확정되면 봇이 자동으로 음성 채널을 관리합니다:

1. "내전" 카테고리 생성 (없으면)
2. "🔵 블루팀", "🔴 레드팀" 음성 채널 생성 (없으면)
3. 각 팀원을 해당 음성 채널로 자동 이동

> ⚠️ 참가자가 아무 음성 채널에도 접속해 있지 않으면 이동이 불가합니다. 내전 시작 전에 음성 채널에 미리 접속해주세요.

## 기술 스택

- **Runtime** — Node.js
- **Discord** — discord.js v14
- **Database** — Supabase (PostgreSQL)
- **API** — Riot Games API

## 설치

```bash
git clone https://github.com/Haru-arp/lol-team-bot.git
cd lol-team-bot
npm install
```

## 환경 변수

`.env` 파일을 생성하고 아래 값을 입력하세요:

```
DISCORD_TOKEN=your_discord_bot_token
RIOT_API_KEY=your_riot_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

- **DISCORD_TOKEN** — [Discord Developer Portal](https://discord.com/developers/applications)에서 봇 생성 후 발급
- **RIOT_API_KEY** — [Riot Developer Portal](https://developer.riotgames.com)에서 발급
- **SUPABASE_URL / KEY** — [Supabase](https://supabase.com) 프로젝트 생성 후 Settings > API에서 확인

## 데이터베이스 설정

- 새로 설치하는 경우: Supabase SQL Editor에서 `supabase-schema.sql` 파일을 실행하세요.
- 기존 설치에 수동 티어 보정을 추가하는 경우: `supabase-migration-v3.sql` 을 실행하세요.
- 기존 1인 1계정 스키마를 쓰는 경우: `supabase-migration-v2.sql` 을 먼저 실행한 뒤 최신 `supabase-schema.sql` 내용을 기준으로 확인하세요.

## 실행

```bash
node src/index.js
```

## 봇 권한

Discord 봇에 아래 권한이 필요합니다:

- Send Messages, Embed Links, Read Message History, Use External Emojis
- Connect, Move Members, Manage Channels

Privileged Gateway Intents:

- Presence Intent, Server Members Intent, Message Content Intent

## 라이선스

MIT

https://discord.com/oauth2/authorize?client_id=1483312568281075864&permissions=137725560848&integration_type=0&scope=bot
