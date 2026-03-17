const supabase = require('../supabase');

const TIER_POINTS = {
  UNRANKED: 0,
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10,
};

const DIV_BONUS = { I: 0.75, II: 0.5, III: 0.25, IV: 0 };

const TIER_ALIASES = {
  UNRANKED: 'UNRANKED',
  언랭: 'UNRANKED',
  언랭크: 'UNRANKED',
  IRON: 'IRON',
  아이언: 'IRON',
  BRONZE: 'BRONZE',
  브론즈: 'BRONZE',
  SILVER: 'SILVER',
  실버: 'SILVER',
  GOLD: 'GOLD',
  골드: 'GOLD',
  PLATINUM: 'PLATINUM',
  플래티넘: 'PLATINUM',
  플레티넘: 'PLATINUM',
  EMERALD: 'EMERALD',
  에메랄드: 'EMERALD',
  DIAMOND: 'DIAMOND',
  다이아: 'DIAMOND',
  다이아몬드: 'DIAMOND',
  MASTER: 'MASTER',
  마스터: 'MASTER',
  GRANDMASTER: 'GRANDMASTER',
  그랜드마스터: 'GRANDMASTER',
  GM: 'GRANDMASTER',
  CHALLENGER: 'CHALLENGER',
  챌린저: 'CHALLENGER',
};

const DIVISION_ALIASES = {
  1: 'I',
  I: 'I',
  2: 'II',
  II: 'II',
  3: 'III',
  III: 'III',
  4: 'IV',
  IV: 'IV',
};

const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

function normalizeTier(input) {
  if (!input) return null;
  return TIER_ALIASES[input.trim().toUpperCase().replace(/\s+/g, '')] || null;
}

function normalizeDivision(input) {
  if (!input) return null;
  return DIVISION_ALIASES[input.trim().toUpperCase()] || null;
}

function getDefaultDivision(tier) {
  return APEX_TIERS.has(tier) ? 'I' : 'IV';
}

function parseTierSettingArgs(args) {
  if (!args.length) {
    return { error: '❌ 형식: `!티어세팅 [소환사명#태그] [티어] [티어구간] [LP]` 또는 `!티어세팅 해제`' };
  }

  const firstHashIndex = args.findIndex((arg) => arg.includes('#'));
  let riotIdInput = null;
  let tierArgs = args;

  if (firstHashIndex >= 0) {
    riotIdInput = args.slice(0, firstHashIndex + 1).join(' ');
    tierArgs = args.slice(firstHashIndex + 1);
  }

  if (!tierArgs.length) {
    return { error: '❌ 형식: `!티어세팅 [소환사명#태그] [티어] [티어구간] [LP]` 또는 `!티어세팅 해제`' };
  }

  const action = tierArgs[0].trim().toLowerCase();
  if (['해제', '삭제', '초기화', 'reset', 'clear'].includes(action)) {
    return { riotIdInput, reset: true };
  }

  const tier = normalizeTier(tierArgs[0]);
  if (!tier || tier === 'UNRANKED') {
    return { error: '❌ 티어는 아이언~챌린저 범위로 입력하세요. 예: `!티어세팅 골드 2 50`' };
  }

  let rank = normalizeDivision(tierArgs[1]);
  let lpIndex = 2;

  if (!rank) {
    rank = getDefaultDivision(tier);
    lpIndex = 1;
  }

  const lpRaw = tierArgs[lpIndex];
  const lp = lpRaw == null ? 0 : Number.parseInt(lpRaw, 10);
  if (!Number.isInteger(lp) || lp < 0 || lp > 999) {
    return { error: '❌ LP는 0~999 사이 숫자로 입력하세요.' };
  }

  return {
    riotIdInput,
    reset: false,
    tier,
    rank,
    lp,
  };
}

function resolveTierInfo(rankData, tierOverride) {
  if (tierOverride) {
    return {
      tier: tierOverride.tier,
      rank: tierOverride.rank,
      lp: tierOverride.lp || 0,
      tierSource: 'manual',
    };
  }

  if (!rankData) {
    return {
      tier: 'UNRANKED',
      rank: null,
      lp: 0,
      tierSource: 'riot',
    };
  }

  return {
    tier: rankData.tier || 'UNRANKED',
    rank: rankData.rank || getDefaultDivision(rankData.tier),
    lp: rankData.leaguePoints || 0,
    tierSource: 'riot',
  };
}

async function getTierOverrideByPuuid(puuid) {
  const { data, error } = await supabase
    .from('tier_overrides')
    .select('puuid, tier, rank, lp, updated_at')
    .eq('puuid', puuid)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function listTierOverridesByPuuids(puuids) {
  if (!puuids.length) return [];

  const { data, error } = await supabase
    .from('tier_overrides')
    .select('puuid, tier, rank, lp, updated_at')
    .in('puuid', puuids);

  if (error) throw error;
  return data || [];
}

function formatTierDisplay({ tier, rank, lp }) {
  if (!tier || tier === 'UNRANKED') {
    return 'UNRANKED';
  }

  return `${tier} ${rank} (${lp}LP)`;
}

module.exports = {
  DIV_BONUS,
  TIER_POINTS,
  formatTierDisplay,
  getDefaultDivision,
  getTierOverrideByPuuid,
  listTierOverridesByPuuids,
  normalizeDivision,
  normalizeTier,
  parseTierSettingArgs,
  resolveTierInfo,
};
