import type { PageLoad } from './$types';
import type {
	ClanLeaderboardResponse,
	ClanSession,
	ClanStats,
	ClanStatsResponse
} from '$lib/types/openfront';

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

	try {
		const response = await fetch('/api/clans/leaderboard');
		if (!response.ok) {
			throw new Error(`Leaderboard request failed ${response.status}`);
		}
		leaderboard = (await response.json()) as ClanLeaderboardResponse;
	} catch (err) {
		console.error('Failed to load clan leaderboard', err);
		errors.leaderboard = 'Unable to load leaderboard details.';
	}

	try {
		const response = await fetch(`/api/clans/${encodeURIComponent(clanTag)}`);
		if (!response.ok) {
			throw new Error(`Clan stats request failed ${response.status}`);
		}
		const json = (await response.json()) as ClanStatsResponse;
		clanStats = json?.clan ?? null;
	} catch (err) {
		console.error(`Failed to load clan stats for ${clanTag}`, err);
		errors.stats = 'Unable to load clan stats.';
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
