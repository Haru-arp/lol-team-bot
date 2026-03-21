const riot = require('../riot');
const { parseRiotIdInput } = require('../utils/accounts');
const { activeLobbies, lobbyEmbed, lobbyButtons } = require('./inhouse');

module.exports = {
  name: '참가인원추가',
  async execute(interaction) {
    const lobby = activeLobbies.get(interaction.guild.id);
    if (!lobby) return interaction.reply('❌ 활성 로비가 없습니다. 먼저 `/내전`으로 모집을 시작하세요.');
    if (lobby.participants.size >= 10) return interaction.reply('❌ 이미 10명입니다.');

    const mentionedUser = interaction.options.getUser('유저');
    const input = interaction.options.getString('riot_id');

    const parsed = parseRiotIdInput(input);
    if (!parsed) return interaction.reply('❌ 형식: `소환사명#태그`');

    await interaction.deferReply();

    const account = await riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
    if (!account) return interaction.editReply('❌ 해당 Riot 계정을 찾을 수 없습니다.');

    const riotId = `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`;

    for (const [, p] of lobby.participants) {
      if (p.puuid === account.puuid) return interaction.editReply('❌ 이미 참가 중인 계정입니다.');
    }

    const participantId = mentionedUser ? mentionedUser.id : `ext_${account.puuid}`;
    if (lobby.participants.has(participantId)) return interaction.editReply('❌ 이미 참가 중인 유저입니다.');

    lobby.participants.set(participantId, {
      id: participantId,
      displayName: mentionedUser ? `${mentionedUser.displayName} (${riotId})` : riotId,
      isExternal: true,
      puuid: account.puuid,
      riotId,
    });

    try {
      const channel = interaction.channel;
      const lobbyMsg = await channel.messages.fetch(lobby.messageId);
      if (lobbyMsg) await lobbyMsg.edit({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });
    } catch (_) {}

    const voiceNote = mentionedUser ? '' : '\n⚠️ 디스코드 유저 지정 없이 추가되어 음성 채널 자동 이동이 불가합니다.';
    return interaction.editReply(`✅ **${riotId}** 를 참가자로 추가했습니다. (${lobby.participants.size}/10)${voiceNote}`);
  },
};
