const { EmbedBuilder } = require('discord.js');
const { getLatestVersion, getPatchNote, PATCH_NOTES } = require('../utils/patchnotes');

module.exports = {
  name: '패치노트',
  aliases: ['patchnote', 'patchnotes'],
  async execute(message, args) {
    const ver = args[0] || getLatestVersion();
    const note = getPatchNote(ver);

    if (!note) {
      const versions = Object.keys(PATCH_NOTES).join(', ');
      return message.reply(`❌ 해당 버전의 패치노트가 없습니다. 사용 가능: ${versions}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00bfff)
      .setTitle(`📢 패치노트 v${ver}`)
      .setDescription(`**${note.title}**\n\n${note.changes.map(c => `• ${c}`).join('\n')}`)
      .setFooter({ text: note.date });

    message.reply({ embeds: [embed] });
  },
};
