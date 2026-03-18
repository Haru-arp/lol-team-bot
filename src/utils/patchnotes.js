const { version } = require('../../package.json');

const PATCH_NOTES = {
  '1.2.0': {
    date: '2026-03-18',
    title: '패치노트 자동 공지 기능',
    changes: [
      '`!공지채널` — 현재 채널을 패치노트 공지 채널로 설정 (서버 관리 권한 필요)',
      '봇 업데이트 시 설정된 채널에 패치노트가 자동으로 전송됩니다',
    ],
  },
  '1.1.0': {
    date: '2026-03-18',
    title: '외부 참가자 추가 기능',
    changes: [
      '`!참가인원추가 @유저 소환사명#태그` — 멘션 + Riot ID로 추가 (음성 이동 ✅)',
      '`!참가인원추가 소환사명#태그` — Riot ID만으로 추가 (음성 이동 ❌)',
      '`!참가인원제거 @유저` 또는 `!참가인원제거 소환사명#태그` — 참가자 제거',
      '외부 참가자도 전적 분석, 팀 매칭, 밴 추천 동일 적용',
      '멘션 없이 추가된 참가자는 내전 승패 랭킹에 미기록',
    ],
  },
};

function getLatestVersion() {
  return version;
}

function getPatchNote(ver) {
  return PATCH_NOTES[ver] || null;
}

module.exports = { getLatestVersion, getPatchNote, PATCH_NOTES };
