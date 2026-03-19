const LANES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

function assignLanes(players) {
  // Try all permutations of lane assignments, return best fit
  let best = null, bestPenalty = Infinity;

  function permute(remaining, assigned, penalty) {
    const idx = assigned.length;
    if (idx === players.length) {
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = players.map((p, i) => ({ discordId: p.discordId, assignedLane: assigned[i], score: p.score }));
      }
      return;
    }
    for (const lane of LANES) {
      if (remaining.has(lane)) continue;
      const p = players[idx];
      const lanePenalty = p.mainLane === lane ? 0 : (p.subLane === lane ? 0.5 : 1);
      remaining.add(lane);
      permute(remaining, [...assigned, lane], penalty + lanePenalty);
      remaining.delete(lane);
    }
  }

  permute(new Set(), [], 0);
  return { assignment: best, penalty: bestPenalty };
}

function combinations(arr, k) {
  const result = [];
  function go(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      go(i + 1, combo);
      combo.pop();
    }
  }
  go(0, []);
  return result;
}

function findOptimalTeams(players) {
  if (players.length !== 10) throw new Error('10명이 필요합니다');

  let bestResult = null, bestScore = Infinity;

  for (const team1Players of combinations(players, 5)) {
    const team1Set = new Set(team1Players.map(p => p.discordId));
    const team2Players = players.filter(p => !team1Set.has(p.discordId));

    const t1 = assignLanes(team1Players);
    const t2 = assignLanes(team2Players);
    if (!t1.assignment || !t2.assignment) continue;

    const t1Score = t1.assignment.reduce((s, p) => s + p.score, 0);
    const t2Score = t2.assignment.reduce((s, p) => s + p.score, 0);
    const teamDiff = Math.abs(t1Score - t2Score);

    // Lane-by-lane diff
    const laneDiff = LANES.reduce((sum, lane) => {
      const s1 = t1.assignment.find(p => p.assignedLane === lane)?.score || 0;
      const s2 = t2.assignment.find(p => p.assignedLane === lane)?.score || 0;
      return sum + Math.abs(s1 - s2);
    }, 0);

    // Play style imbalance
    const styleCount = (team) => {
      const counts = {};
      team.forEach(p => {
        const orig = players.find(o => o.discordId === p.discordId);
        counts[orig.playStyle] = (counts[orig.playStyle] || 0) + 1;
      });
      return counts;
    };
    const s1 = styleCount(t1.assignment), s2 = styleCount(t2.assignment);
    const allStyles = new Set([...Object.keys(s1), ...Object.keys(s2)]);
    const stylePenalty = [...allStyles].reduce((sum, s) => sum + Math.abs((s1[s] || 0) - (s2[s] || 0)), 0);

    const totalScore = teamDiff * 5 + laneDiff * 3 + stylePenalty;

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestResult = {
        team1: t1.assignment.map(({ discordId, assignedLane }) => ({ discordId, assignedLane })),
        team2: t2.assignment.map(({ discordId, assignedLane }) => ({ discordId, assignedLane })),
        scoreDiff: +teamDiff.toFixed(2),
      };
    }
  }

  return bestResult;
}

module.exports = { findOptimalTeams };
