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

export type PlayerStatsLeaf = {
	wins: string;
	losses: string;
	total: string;
	stats?: unknown;
};

export type PlayerStatsTree = Record<string, Record<string, Record<string, PlayerStatsLeaf>>>;

export type PlayerGame = {
	gameId: string;
	start: string;
	mode: string;
	type: string;
	map: string;
	difficulty: string;
	clientId?: string;
};

export type PlayerProfile = {
	createdAt: string;
	user?: {
		id: string;
		avatar?: string | null;
		username: string;
		global_name?: string | null;
		discriminator?: string;
	};
	games: PlayerGame[];
	stats: PlayerStatsTree;
};

export type PlayerSession = {
	gameId?: string;
	gameStart?: string;
	gameEnd?: string;
	gameType?: string;
	gameMode?: string;
	clientId?: string;
	username?: string;
	clanTag?: string | null;
	hasWon?: boolean;
	[key: string]: unknown;
};
