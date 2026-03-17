# 배포 가이드

## 옵션 1: Railway (추천, 가장 쉬움)

### 1. 가입
- https://railway.app 접속
- GitHub 계정으로 로그인

### 2. 프로젝트 생성
- "New Project" 클릭
- "Deploy from GitHub repo" 선택
- `Haru-arp/lol-team-bot` 레포 선택

### 3. 환경변수 설정
- 프로젝트 대시보드 → "Variables" 탭
- 아래 4개 추가:
```
DISCORD_TOKEN=실제토큰값
RIOT_API_KEY=실제키값
SUPABASE_URL=실제URL
SUPABASE_KEY=실제키값
```

### 4. 시작 명령어
- "Settings" 탭 → Start Command:
```
node src/index.js
```

### 5. 완료
- 자동 빌드 & 배포
- 이후 GitHub에 push하면 자동 재배포
- 비용: 무료 크레딧 월 $5 (이 봇은 월 $1~2 수준)

---

## 옵션 2: Fly.io

### 1. CLI 설치 & 로그인
```bash
brew install flyctl
fly auth login
```

### 2. Dockerfile 생성 (프로젝트 루트에)
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/index.js"]
```

### 3. 배포
```bash
fly launch
fly secrets set DISCORD_TOKEN=xxx RIOT_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_KEY=xxx
fly deploy
```

---

## 옵션 3: Oracle Cloud (평생 무료 VM)

### 1. 가입
- https://oracle.com/cloud/free 가입 (카드 등록 필요, 과금 안 됨)

### 2. 인스턴스 생성
- Compute → Create Instance
- Image: Ubuntu 22.04
- Shape: VM.Standard.A1.Flex (ARM, Always Free)
- 1 OCPU / 6GB RAM 선택
- SSH 키 다운로드

### 3. SSH 접속 후 세팅
```bash
# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 프로젝트 클론
git clone https://github.com/Haru-arp/lol-team-bot.git
cd lol-team-bot
npm install

# .env 파일 생성
cat > .env << 'EOF'
DISCORD_TOKEN=실제토큰값
RIOT_API_KEY=실제키값
SUPABASE_URL=실제URL
SUPABASE_KEY=실제키값
EOF

# PM2로 상시 실행
sudo npm install -g pm2
pm2 start src/index.js --name lol-bot
pm2 save
pm2 startup  # 출력되는 명령어 복사해서 실행
```

### 4. 업데이트 시
```bash
cd lol-team-bot
git pull
pm2 restart lol-bot
```

---

## 옵션 4: 로컬 Docker

### 1. Dockerfile 생성 (프로젝트 루트에)
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/index.js"]
```

### 2. 실행
```bash
docker build -t lol-bot .
docker run -d --name lol-bot --env-file .env --restart unless-stopped lol-bot
```

### 3. 관리
```bash
docker logs lol-bot          # 로그 확인
docker restart lol-bot       # 재시작
docker stop lol-bot          # 중지
```

---

## 참고

- Riot API 개발 키는 24시간마다 만료됨
- 장기 운영 시 https://developer.riotgames.com 에서 프로덕션 키 신청 필요 (승인 1~2주)
- Railway / Fly.io는 환경변수를 웹 대시보드에서 바로 수정 가능
