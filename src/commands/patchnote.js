const { EmbedBuilder } = require('discord.js');
const { getLatestVersion, getPatchNote, PATCH_NOTES } = require('../utils/patchnotes');

module.exports = {
  name: '패치노트',
  async execute(interaction) {
    const ver = interaction.options.getString('버전') || getLatestVersion();
    const note = getPatchNote(ver);

    if (!note) {
      const versions = Object.keys(PATCH_NOTES).join(', ');
      return interaction.reply(`❌ 해당 버전의 패치노트가 없습니다. 사용 가능: ${versions}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00bfff)
      .setTitle(`📢 패치노트 v${ver}`)
      .setDescription(`**${note.title}**\n\n${note.changes.map(c => `• ${c}`).join('\n')}`)
      .setFooter({ text: note.date });

    interaction.reply({ embeds: [embed] });
  },
};
