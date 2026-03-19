require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { DISCORD_TOKEN } = require('./config');

const commands = [
  new SlashCommandBuilder().setName('도움말').setDescription('명령어 안내'),
  new SlashCommandBuilder().setName('연동').setDescription('Riot 계정 연동')
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그').setRequired(true)),
  new SlashCommandBuilder().setName('연동목록').setDescription('내 연동 계정 목록 조회'),
  new SlashCommandBuilder().setName('대표').setDescription('대표 계정 변경')
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그').setRequired(true)),
  new SlashCommandBuilder().setName('연동해제').setDescription('계정 연동 해제')
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그').setRequired(true)),
  new SlashCommandBuilder().setName('전적').setDescription('전적 조회')
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그 (생략 시 대표 계정)')),
  new SlashCommandBuilder().setName('라인').setDescription('선호 라인 조회/설정')
    .addStringOption(o => o.setName('1순위').setDescription('1순위 라인 (탑/정글/미드/원딜/서폿)'))
    .addStringOption(o => o.setName('2순위').setDescription('2순위 라인 (탑/정글/미드/원딜/서폿)')),
  new SlashCommandBuilder().setName('티어세팅').setDescription('수동 티어 보정')
    .addStringOption(o => o.setName('설정값').setDescription('티어 (예: 골드2) 또는 해제').setRequired(true))
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그 (생략 시 대표 계정)')),
  new SlashCommandBuilder().setName('내전').setDescription('내전 모집 시작'),
  new SlashCommandBuilder().setName('참가인원추가').setDescription('외부 참가자 추가')
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그').setRequired(true))
    .addUserOption(o => o.setName('유저').setDescription('디스코드 유저 (멘션 시 음성 이동 가능)')),
  new SlashCommandBuilder().setName('참가인원제거').setDescription('참가자 제거')
    .addStringOption(o => o.setName('riot_id').setDescription('소환사명#태그'))
    .addUserOption(o => o.setName('유저').setDescription('디스코드 유저')),
  new SlashCommandBuilder().setName('결과').setDescription('내전 결과 기록')
    .addStringOption(o => o.setName('승리팀').setDescription('블루승 또는 레드승').setRequired(true)
      .addChoices({ name: '블루승', value: '블루승' }, { name: '레드승', value: '레드승' })),
  new SlashCommandBuilder().setName('랭킹').setDescription('서버 내전 승률 랭킹'),
  new SlashCommandBuilder().setName('팀테스트').setDescription('더미 슬롯으로 팀 결과 미리보기'),
  new SlashCommandBuilder().setName('음성테스트').setDescription('혼자 음성 이동 테스트'),
  new SlashCommandBuilder().setName('공지채널').setDescription('패치노트 공지 채널 설정 (서버 관리 권한 필요)'),
  new SlashCommandBuilder().setName('패치노트').setDescription('패치노트 조회')
    .addStringOption(o => o.setName('버전').setDescription('버전 번호 (생략 시 최신)')),
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const clientId = Buffer.from(DISCORD_TOKEN.split('.')[0], 'base64').toString();

(async () => {
  console.log(`🔄 슬래시 커맨드 등록 중... (clientId: ${clientId})`);
  await rest.put(Routes.applicationCommands(clientId), { body: commands.map(c => c.toJSON()) });
  console.log('✅ 슬래시 커맨드 등록 완료');
})();
