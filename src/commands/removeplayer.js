const { parseRiotIdInput } = require('../utils/accounts');
const { activeLobbies, lobbyEmbed, lobbyButtons } = require('./inhouse');

module.exports = {
  name: '참가인원제거',
  async execute(message, args) {
    const lobby = activeLobbies.get(message.guild.id);
    if (!lobby) return message.reply('❌ 활성 로비가 없습니다.');

    // 멘션으로 제거
    const mentionedUser = message.mentions.users.first();
    if (mentionedUser) {
      if (!lobby.participants.has(mentionedUser.id)) {
        return message.reply('❌ 해당 유저는 참가자 목록에 없습니다.');
      }
      lobby.participants.delete(mentionedUser.id);
    } else {
      // Riot ID로 제거 (외부 참가자)
      const parsed = parseRiotIdInput(args.join(' '));
      if (!parsed) return message.reply('❌ 형식: `!참가인원제거 @유저` 또는 `!참가인원제거 소환사명#태그`');

      let found = false;
      for (const [key, p] of lobby.participants) {
        if (p.riotId?.toLowerCase() === parsed.riotId.toLowerCase()) {
          lobby.participants.delete(key);
          found = true;
          break;
        }
      }
      if (!found) return message.reply('❌ 해당 계정은 참가자 목록에 없습니다.');
    }

    try {
      const lobbyMsg = await message.channel.messages.fetch(lobby.messageId);
      if (lobbyMsg) await lobbyMsg.edit({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });
    } catch (_) {}

    message.reply(`✅ 참가자를 제거했습니다. (${lobby.participants.size}/10)`);
  },
};
