const axios = require('axios');
const { RIOT_API_KEY } = require('./config');

const asia = axios.create({ baseURL: 'https://asia.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const kr = axios.create({ baseURL: 'https://kr.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const ddragon = axios.create({ baseURL: 'https://ddragon.leagueoflegends.com' });
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RETRIES = 3;
const CACHE_TTL_MS = {
  account: 60 * 60 * 1000,
  summoner: 10 * 60 * 1000,
  rank: 2 * 60 * 1000,
  matchIds: 60 * 1000,
  match: 30 * 60 * 1000,
  mastery: 10 * 60 * 1000,
};

let championNameMapPromise = null;
let activeRequests = 0;
const requestQueue = [];
const responseCache = new Map();
const pendingCacheRequests = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dequeueRequest() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) return;
  const next = requestQueue.shift();
  if (!next) return;

  activeRequests += 1;
  next()
    .finally(() => {
      activeRequests -= 1;
      dequeueRequest();
    });
}

function scheduleRequest(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        resolve(await fn());
      } catch (error) {
        reject(error);
      }
    });
    dequeueRequest();
  });
}

function getCachedValue(key) {
  const cached = responseCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  return cached.value;
}

function setCachedValue(key, value, ttlMs) {
  if (value == null) return;
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function safe(fn, attempt = 0) {
  try {
    return await scheduleRequest(fn);
  } catch (e) {
    const status = e.response?.status;
    if (status === 429 && attempt < MAX_RETRIES) {
      const retryAfterSeconds = Number(e.response?.headers?.['retry-after']);
      const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : 1000 * (attempt + 1);
      await sleep(waitMs);
      return safe(fn, attempt + 1);
    }

    console.error(e.response?.data || e.message);
    return null;
  }
}

function cachedSafe(key, ttlMs, fn) {
  const cached = getCachedValue(key);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const pending = pendingCacheRequests.get(key);
  if (pending) {
    return pending;
  }

  const request = safe(fn)
    .then((value) => {
      setCachedValue(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      pendingCacheRequests.delete(key);
    });

  pendingCacheRequests.set(key, request);
  return request;
}

async function loadChampionNameMap() {
  const { data: versions } = await scheduleRequest(() => ddragon.get('/api/versions.json'));
  const latestVersion = versions?.[0];
  if (!latestVersion) return {};

  const { data } = await scheduleRequest(() => ddragon.get(`/cdn/${latestVersion}/data/ko_KR/champion.json`));
  const champions = Object.values(data?.data || {});

  return champions.reduce((map, champion) => {
    map[Number(champion.key)] = champion.name;
    return map;
  }, {});
}

module.exports = {
  getAccountByRiotId: (gameName, tagLine) =>
    cachedSafe(
      `account:${gameName}:${tagLine}`,
      CACHE_TTL_MS.account,
      () => asia.get(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`).then(r => r.data),
    ),

  getSummonerByPuuid: (puuid) =>
    cachedSafe(
      `summoner:${puuid}`,
      CACHE_TTL_MS.summoner,
      () => kr.get(`/lol/summoner/v4/summoners/by-puuid/${puuid}`).then(r => r.data),
    ),

  getRankByPuuid: (puuid) =>
    cachedSafe(
      `rank:${puuid}`,
      CACHE_TTL_MS.rank,
      async () => {
        const { data } = await kr.get(`/lol/league/v4/entries/by-puuid/${puuid}`);
        return data.find(e => e.queueType === 'RANKED_SOLO_5x5') || null;
      },
    ),

  getMatchIds: (puuid, options = 20) => {
    const params = typeof options === 'number'
      ? { count: options }
      : { count: options.count ?? 20, start: options.start, startTime: options.startTime, endTime: options.endTime, queue: options.queue, type: options.type };

    return cachedSafe(
      `matchIds:${puuid}:${JSON.stringify(params)}`,
      CACHE_TTL_MS.matchIds,
      () => asia.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, { params }).then(r => r.data),
    );
  },

  getMatch: (matchId) =>
    cachedSafe(
      `match:${matchId}`,
      CACHE_TTL_MS.match,
      () => asia.get(`/lol/match/v5/matches/${matchId}`).then(r => r.data),
    ),

  getChampionMastery: (puuid, count = 5) =>
    cachedSafe(
      `mastery:${puuid}:${count}`,
      CACHE_TTL_MS.mastery,
      () => kr.get(`/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top`, { params: { count } }).then(r => r.data),
    ),

  getChampionNameMap: async () => {
    if (!championNameMapPromise) {
      championNameMapPromise = loadChampionNameMap().catch((error) => {
        championNameMapPromise = null;
        console.error(error.response?.data || error.message);
        return {};
      });
    }
    return championNameMapPromise;
  },
};
