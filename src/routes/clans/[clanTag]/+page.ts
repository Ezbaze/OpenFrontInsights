import type { PageLoad } from './$types';
import type {
	ClanLeaderboardResponse,
	ClanSession,
	ClanStats,
	ClanStatsResponse
} from '$lib/types/openfront';
import { extractSessions } from '$lib/components/leaderboard/charts/clan-session-utils';

export const load: PageLoad = async ({ fetch, params }) => {
	const clanTag = String(params.clanTag ?? '').trim();
	const errors: {
		leaderboard?: string;
		stats?: string;
		sessions?: string;
	} = {};

	let leaderboard: ClanLeaderboardResponse | null = null;
	let clanStats: ClanStats | null = null;
	let clanSessions: ClanSession[] = [];

	const [leaderboardResult, statsResult, sessionsResult] = await Promise.allSettled([
		fetch('/api/clans/leaderboard'),
		fetch(`/api/clans/${encodeURIComponent(clanTag)}`),
		fetch(`/api/clans/${encodeURIComponent(clanTag)}/sessions`)
	]);

	if (leaderboardResult.status === 'fulfilled') {
		try {
			const response = leaderboardResult.value;
			if (!response.ok) {
				throw new Error(`Leaderboard request failed ${response.status}`);
			}
			leaderboard = (await response.json()) as ClanLeaderboardResponse;
		} catch (err) {
			console.error('Failed to load clan leaderboard', err);
			errors.leaderboard = 'Unable to load leaderboard details.';
		}
	} else {
		console.error('Failed to load clan leaderboard', leaderboardResult.reason);
		errors.leaderboard = 'Unable to load leaderboard details.';
	}

	if (statsResult.status === 'fulfilled') {
		try {
			const response = statsResult.value;
			if (!response.ok) {
				throw new Error(`Clan stats request failed ${response.status}`);
			}
			const json = (await response.json()) as ClanStatsResponse;
			clanStats = json?.clan ?? null;
		} catch (err) {
			console.error(`Failed to load clan stats for ${clanTag}`, err);
			errors.stats = 'Unable to load clan stats.';
		}
	} else {
		console.error(`Failed to load clan stats for ${clanTag}`, statsResult.reason);
		errors.stats = 'Unable to load clan stats.';
	}

	if (sessionsResult.status === 'fulfilled') {
		try {
			const response = sessionsResult.value;
			if (!response.ok) {
				throw new Error(`Clan sessions request failed ${response.status}`);
			}
			clanSessions = extractSessions((await response.json()) as unknown);
		} catch (err) {
			console.error(`Failed to load clan sessions for ${clanTag}`, err);
			errors.sessions = 'Unable to load clan sessions.';
		}
	} else {
		console.error(`Failed to load clan sessions for ${clanTag}`, sessionsResult.reason);
		errors.sessions = 'Unable to load clan sessions.';
	}

	return {
		clanTag,
		leaderboard,
		clanStats,
		clanSessions,
		errors,
		loadedAt: new Date().toISOString()
	};
};
