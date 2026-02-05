export type ClanLeaderboardEntry = {
	clanTag: string;
	games: number;
	wins: number;
	losses: number;
	playerSessions: number;
	weightedWins: number;
	weightedLosses: number;
	weightedWLRatio: number;
};

export type ClanLeaderboardResponse = {
	start: string;
	end: string;
	clans: ClanLeaderboardEntry[];
};

export type ClanStatsBreakdown = {
	wl: [number, number];
	weightedWL: [number, number];
};

export type ClanStats = {
	clanTag: string;
	games: number;
	wins: number;
	losses: number;
	playerSessions: number;
	weightedWins: number;
	weightedLosses: number;
	weightedWLRatio: number;
	teamTypeWL: Record<string, ClanStatsBreakdown>;
	teamCountWL: Record<string, ClanStatsBreakdown>;
};

export type ClanStatsResponse = {
	clan: ClanStats;
};

export type ClanSession = {
	gameId?: string;
	clanTag?: string;
	clanPlayerCount?: number;
	hasWon?: boolean;
	numTeams?: number;
	playerTeams?: string | number;
	totalPlayerCount?: number;
	gameStart?: string;
	score?: number;
	[key: string]: unknown;
};
