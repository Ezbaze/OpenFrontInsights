import type { ClanSession } from '$lib/types/openfront';

export const getSessionStart = (session: ClanSession) =>
	session.gameStart ??
	session.start ??
	session.startedAt ??
	session.startTime ??
	session.createdAt;

export const getSessionHasWon = (session: ClanSession) => {
	if (typeof session.hasWon === 'boolean') return session.hasWon;
	const result = session.result ?? session.outcome ?? session.status;
	if (!result) return null;
	const normalized = String(result).toLowerCase();
	if (normalized === 'win' || normalized === 'won') return true;
	if (normalized === 'loss' || normalized === 'lost') return false;
	return null;
};

export const getSessionNumTeams = (session: ClanSession) => session.numTeams ?? session.teams;
export const getSessionClanPlayers = (session: ClanSession) =>
	session.clanPlayerCount ?? session.clanPlayers;
export const getSessionTotalPlayers = (session: ClanSession) =>
	session.totalPlayerCount ?? session.playerCount ?? session.players;
export const getSessionScore = (session: ClanSession) => session.score;
export const getSessionGameCode = (session: ClanSession) =>
	session.gameId ?? session.game ?? session.id ?? session.sessionId ?? session.matchId;
export const getSessionKey = (session: ClanSession) => {
	const candidate =
		getSessionGameCode(session) ??
		session.sessionId ??
		session.matchId ??
		getSessionStart(session);
	if (candidate !== undefined && candidate !== null && candidate !== '') return String(candidate);
	return JSON.stringify(session);
};
