import {
	formatNumber,
	formatPercent,
	formatRatio
} from '$lib/components/leaderboard/charts/chart-utils';
import type { ClanLeaderboardEntry } from '$lib/types/openfront';

export const PLACEHOLDER = '—';

export const displayMetric = (value: string | null | undefined) => value ?? PLACEHOLDER;

export const displayNumber = (value: number | null | undefined) =>
	displayMetric(formatNumber(value));

export const displayRatio = (value: number | null | undefined) => displayMetric(formatRatio(value));

export const displayPercent = (value: number | null | undefined) =>
	displayMetric(formatPercent(value));

export const getWinRatePercent = (wins: number, losses: number) => {
	const total = wins + losses;
	if (total <= 0) return 0;
	return (wins / total) * 100;
};

export const getLeaderboardWinRatePercent = (entry: ClanLeaderboardEntry) =>
	getWinRatePercent(entry.wins, entry.losses);
