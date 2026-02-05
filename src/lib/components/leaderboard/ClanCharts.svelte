<script lang="ts">
	import * as Empty from '$lib/components/ui/empty';
	import type { ClanSession, ClanStats } from '$lib/types/openfront';
	import ClanOutcomeScoreSection from './charts/ClanOutcomeScoreSection.svelte';
	import ClanPerformanceSection from './charts/ClanPerformanceSection.svelte';
	import ClanSessionTrendsSection from './charts/ClanSessionTrendsSection.svelte';

	let {
		clanStats = null,
		clanSessions = [],
		sessionsLoading = false,
		sessionsComplete = true,
		sessionsError = '',
		hideSessions = false,
		onSessionFocus
	} = $props<{
		clanStats?: ClanStats | null;
		clanSessions?: ClanSession[];
		sessionsLoading?: boolean;
		sessionsComplete?: boolean;
		sessionsError?: string;
		hideSessions?: boolean;
		onSessionFocus?: (sessionKey: string) => void;
	}>();

	const hasSessionData = $derived.by(() => clanSessions.length > 0);
	const hasStatsData = $derived.by(() => {
		const teamType = clanStats?.teamTypeWL;
		const teamCount = clanStats?.teamCountWL;
		return (
			(teamType && Object.keys(teamType).length > 0) ||
			(teamCount && Object.keys(teamCount).length > 0)
		);
	});
</script>

<div class="grid gap-6">
	<div class="text-base font-semibold">Clan performance</div>
	{#if !clanStats || !hasStatsData}
		<Empty.Root class="border-muted-foreground/30">
			<h3 class="text-base font-semibold">No clan stats available</h3>
			<p class="text-sm text-muted-foreground">Check back after more clan games are recorded.</p>
		</Empty.Root>
	{:else}
		<ClanPerformanceSection {clanStats} />
	{/if}

	{#if !hideSessions}
		<div class="text-base font-semibold">Session trends</div>
		{#if sessionsError && !hasSessionData}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">Session data unavailable</h3>
				<p class="text-sm text-muted-foreground">{sessionsError}</p>
			</Empty.Root>
		{:else if sessionsLoading || !sessionsComplete}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">Loading session data...</h3>
				<p class="text-sm text-muted-foreground">Recent games are on the way.</p>
			</Empty.Root>
		{:else if !hasSessionData}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No session data available</h3>
				<p class="text-sm text-muted-foreground">This clan has no recent public sessions.</p>
			</Empty.Root>
		{:else}
			<div class="grid gap-4 lg:grid-cols-2">
				<ClanSessionTrendsSection {clanSessions} />
				<ClanOutcomeScoreSection {clanSessions} {onSessionFocus} />
			</div>
		{/if}
	{/if}
</div>
