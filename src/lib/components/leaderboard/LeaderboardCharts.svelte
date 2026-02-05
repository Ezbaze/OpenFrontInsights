<script lang="ts">
	import type { ClanLeaderboardEntry } from '$lib/types/openfront';
	import LeaderboardScatterSection from './charts/LeaderboardScatterSection.svelte';
	import LeaderboardTop10Section from './charts/LeaderboardTop10Section.svelte';
	import LeaderboardWinRateSection from './charts/LeaderboardWinRateSection.svelte';

	let { entries = [], onClanFocus } = $props<{
		entries?: ClanLeaderboardEntry[];
		onClanFocus?: (clanTag: string) => void;
	}>();
</script>

<div class="grid gap-4 lg:grid-cols-2">
	<LeaderboardTop10Section {entries} />
	<LeaderboardWinRateSection {entries} />
	<LeaderboardScatterSection {entries} {onClanFocus} />
</div>
