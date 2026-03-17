# ⚔️ 롤 내전 봇 (LoL In-House Bot)

Discord에서 롤 내전을 자동으로 관리해주는 봇입니다.
Riot API 기반 전적 분석 + 최적 팀 매칭 + 음성 채널 자동 분배를 지원합니다.

## 주요 기능

| 명령어 | 설명 |
|---|---|
| `!연동 소환사명#태그` | 디스코드 계정과 롤 계정 연동 |
| `!전적 [소환사명#태그]` | 전적 조회 (티어, KDA, 주 라인, 플레이 스타일) |
| `!라인 [1순위] [2순위]` | 선호 라인 등록 (탑/정글/미드/원딜/서폿) |
| `!내전` | 내전 모집 시작 (버튼으로 참가/시작) |
| `!결과 블루승/레드승` | 내전 결과 기록 |
| `!랭킹` | 서버 내 내전 승률 랭킹 |

## 팀 매칭 알고리즘

10명의 참가자를 5:5로 나눌 때 C(10,5) = 252개 조합을 전수 탐색하여 최적의 팀을 구성합니다.

- **티어 밸런스** — 양 팀 종합 점수 차이 최소화
- **라인 배정** — 유저 선호 라인 우선 배정
- **성향 분산** — 캐리형/탱커형/팀플형이 한쪽에 몰리지 않도록 분배
- **라인별 매칭** — 같은 라인끼리의 실력 차이도 고려

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

Supabase SQL Editor에서 `supabase-schema.sql` 파일의 내용을 실행하세요.

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
