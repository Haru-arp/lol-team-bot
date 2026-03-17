const { ChannelType } = require('discord.js');

const CATEGORY_NAME = '내전';
const BLUE = '🔵 블루팀';
const RED = '🔴 레드팀';

async function getOrCreateCategory(guild) {
  return guild.channels.cache.find(c => c.name === CATEGORY_NAME && c.type === ChannelType.GuildCategory)
    || guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
}

async function getOrCreateVC(guild, name, category) {
  return guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildVoice && c.parentId === category.id)
    || guild.channels.create({ name, type: ChannelType.GuildVoice, parent: category.id });
}

async function moveTeamsToVoice(guild, team1, team2) {
  const category = await getOrCreateCategory(guild);
  const [blueVC, redVC] = await Promise.all([
    getOrCreateVC(guild, BLUE, category),
    getOrCreateVC(guild, RED, category),
  ]);

  const move = async (team, vc) => {
    for (const { discordId } of team) {
      try {
        const member = await guild.members.fetch(discordId);
        if (member.voice.channel) await member.voice.setChannel(vc);
      } catch (e) { console.error(`${discordId} 이동 실패:`, e.message); }
    }
  };

  await Promise.all([move(team1, blueVC), move(team2, redVC)]);
  return { blueVC, redVC, category };
}

async function cleanup(blueVC, redVC, category) {
  try {
    if (blueVC?.deletable) await blueVC.delete();
    if (redVC?.deletable) await redVC.delete();
    if (category?.deletable) await category.delete();
  } catch (e) { console.error('정리 실패:', e.message); }
}

module.exports = { moveTeamsToVoice, cleanup };
