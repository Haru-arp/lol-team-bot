const riot = require('../riot');
const { parseRiotIdInput } = require('../utils/accounts');
const { activeLobbies } = require('./inhouse');

module.exports = {
  name: '참가인원추가',
  async execute(message, args) {
    const lobby = activeLobbies.get(message.guild.id);
    if (!lobby) return message.reply('❌ 활성 로비가 없습니다. 먼저 `!내전`으로 모집을 시작하세요.');
    if (lobby.participants.size >= 10) return message.reply('❌ 이미 10명입니다.');

    // 멘션된 디스코드 유저 추출
    const mentionedUser = message.mentions.users.first();
    const riotArgs = mentionedUser
      ? args.filter(a => !a.match(/^<@!?\d+>$/))
      : args;

    const parsed = parseRiotIdInput(riotArgs.join(' '));
    if (!parsed) return message.reply('❌ 형식: `!참가인원추가 @유저 소환사명#태그` 또는 `!참가인원추가 소환사명#태그`');

    const account = await riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
    if (!account) return message.reply('❌ 해당 Riot 계정을 찾을 수 없습니다.');

    const riotId = `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`;

    // 이미 같은 puuid로 참가 중인지 확인
    for (const [, p] of lobby.participants) {
      if (p.puuid === account.puuid) return message.reply('❌ 이미 참가 중인 계정입니다.');
    }

    // 멘션이 있으면 디스코드 ID 사용 (음성 이동 가능), 없으면 외부 ID
    const participantId = mentionedUser ? mentionedUser.id : `ext_${account.puuid}`;

    if (lobby.participants.has(participantId)) {
      return message.reply('❌ 이미 참가 중인 유저입니다.');
    }

    lobby.participants.set(participantId, {
      id: participantId,
      displayName: mentionedUser ? `${mentionedUser.displayName} (${riotId})` : riotId,
      isExternal: true,
      puuid: account.puuid,
      riotId,
    });

    // 로비 메시지 업데이트
    try {
      const lobbyMsg = await message.channel.messages.fetch(lobby.messageId);
      if (lobbyMsg) {
        const { lobbyEmbed, lobbyButtons } = require('./inhouse');
        await lobbyMsg.edit({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });
      }
    } catch (_) { /* 메시지 업데이트 실패해도 참가는 유지 */ }

    const voiceNote = mentionedUser ? '' : '\n⚠️ 디스코드 멘션 없이 추가되어 음성 채널 자동 이동이 불가합니다.';
    message.reply(`✅ **${riotId}** 를 참가자로 추가했습니다. (${lobby.participants.size}/10)${voiceNote}`);
  },
};
