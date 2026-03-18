const { PermissionsBitField } = require('discord.js');
const supabase = require('../supabase');

module.exports = {
  name: '공지채널',
  async execute(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply('❌ 서버 관리 권한이 필요합니다.');
    }

    const channelId = message.channel.id;
    await supabase.from('bot_settings').upsert({
      guild_id: message.guild.id,
      key: 'patch_channel',
      value: channelId,
    }, { onConflict: 'guild_id, key' });

    message.reply(`✅ 패치노트 공지 채널을 <#${channelId}> 으로 설정했습니다.`);
  },
};
