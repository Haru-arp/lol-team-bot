const supabase = require('../supabase');

function parseRiotIdInput(input) {
  const text = input.trim();
  const separatorIndex = text.lastIndexOf('#');
  if (separatorIndex <= 0 || separatorIndex === text.length - 1) {
    return null;
  }

  const gameName = text.slice(0, separatorIndex).trim();
  const tagLine = text.slice(separatorIndex + 1).trim();
  if (!gameName || !tagLine) {
    return null;
  }

  return { gameName, tagLine, riotId: `${gameName}#${tagLine}` };
}

async function listAccountsByDiscordId(discordId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, discord_id, riot_id, puuid, summoner_name, is_primary, created_at')
    .eq('discord_id', discordId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getPrimaryAccountByDiscordId(discordId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, discord_id, riot_id, puuid, summoner_name, is_primary, created_at')
    .eq('discord_id', discordId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAccountByDiscordAndRiotId(discordId, riotId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, discord_id, riot_id, puuid, summoner_name, is_primary, created_at')
    .eq('discord_id', discordId)
    .eq('riot_id', riotId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAccountByPuuid(puuid) {
  const { data, error } = await supabase
    .from('users')
    .select('id, discord_id, riot_id, puuid, summoner_name, is_primary, created_at')
    .eq('puuid', puuid)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function setPrimaryAccount(discordId, accountId) {
  const { error: resetError } = await supabase
    .from('users')
    .update({ is_primary: false })
    .eq('discord_id', discordId);
  if (resetError) throw resetError;

  const { error: setError } = await supabase
    .from('users')
    .update({ is_primary: true })
    .eq('id', accountId)
    .eq('discord_id', discordId);
  if (setError) throw setError;
}

async function promoteOldestAccount(discordId) {
  const accounts = await listAccountsByDiscordId(discordId);
  if (!accounts.length) return null;

  await setPrimaryAccount(discordId, accounts[0].id);
  return accounts[0];
}

module.exports = {
  getAccountByDiscordAndRiotId,
  getAccountByPuuid,
  getPrimaryAccountByDiscordId,
  listAccountsByDiscordId,
  parseRiotIdInput,
  promoteOldestAccount,
  setPrimaryAccount,
};
