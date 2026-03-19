const { parseRiotIdInput } = require('../utils/accounts');
const { activeLobbies, lobbyEmbed, lobbyButtons } = require('./inhouse');

module.exports = {
  name: '참가인원제거',
  async execute(interaction) {
    const lobby = activeLobbies.get(interaction.guild.id);
    if (!lobby) return interaction.reply('❌ 활성 로비가 없습니다.');

    const mentionedUser = interaction.options.getUser('유저');
    const riotIdInput = interaction.options.getString('riot_id');

    if (mentionedUser) {
      if (!lobby.participants.has(mentionedUser.id)) return interaction.reply('❌ 해당 유저는 참가자 목록에 없습니다.');
      lobby.participants.delete(mentionedUser.id);
    } else if (riotIdInput) {
      const parsed = parseRiotIdInput(riotIdInput);
      if (!parsed) return interaction.reply('❌ 형식: `소환사명#태그`');

      let found = false;
      for (const [key, p] of lobby.participants) {
        if (p.riotId?.toLowerCase() === parsed.riotId.toLowerCase()) {
          lobby.participants.delete(key);
          found = true;
          break;
        }
      }
      if (!found) return interaction.reply('❌ 해당 계정은 참가자 목록에 없습니다.');
    } else {
      return interaction.reply('❌ 유저 또는 riot_id 중 하나를 입력하세요.');
    }

    try {
      const lobbyMsg = await interaction.channel.messages.fetch(lobby.messageId);
      if (lobbyMsg) await lobbyMsg.edit({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });
    } catch (_) {}

    interaction.reply(`✅ 참가자를 제거했습니다. (${lobby.participants.size}/10)`);
  },
};
