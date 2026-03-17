require('dotenv').config();

function cleanEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return '';

  const value = raw.trim();
  if (!value) return '';

  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function requireEnv(name) {
  const value = cleanEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  CURRENT_SEASON_START: cleanEnv('CURRENT_SEASON_START'),
  DISCORD_TOKEN: requireEnv('DISCORD_TOKEN'),
  RIOT_API_KEY: requireEnv('RIOT_API_KEY'),
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_KEY: requireEnv('SUPABASE_KEY'),
};
