<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import type { PlayerSession } from '$lib/types/openfront';
	import { BarChart, Highlight } from 'layerchart';
	import { SvelteMap } from 'svelte/reactivity';
	import GraphHelpSheet from './GraphHelpSheet.svelte';
	import {
		chartPadding,
		formatNumber,
		formatPercent,
		helpHeadingClass,
		iconButtonClass,
		yAxisNoNumbers
	} from './charts/chart-utils';

	let { playerSessions = [] } = $props<{
		playerSessions?: PlayerSession[];
	}>();
	let activeUsername = $state<string | null>(null);
	let activeClan = $state<string | null>(null);

	const maxBars = 20;
	const normalizeUsername = (value: string) =>
		value
			.replace(/\[[A-Za-z0-9]{2,5}\]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();

	const usernameCounts = $derived.by(() => {
		const map = new SvelteMap<string, number>();
		for (const session of playerSessions) {
			const username = normalizeUsername(String(session.username ?? '').trim()) || 'Unknown';
			map.set(username, (map.get(username) ?? 0) + 1);
		}

		const entries = Array.from(map.entries())
			.map(([username, count]) => ({ username, count }))
			.sort((left, right) => {
				if (left.count !== right.count) return right.count - left.count;
				return left.username.localeCompare(right.username, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
		const totalSessions = entries.reduce((sum, row) => sum + row.count, 0);
		const top = entries[0] ?? null;

		return {
			uniqueCount: entries.length,
			totalSessions,
			top,
			rows: entries.slice(0, maxBars)
		};
	});
	const activeUsernameDatum = $derived.by(() =>
		activeUsername === null
			? undefined
			: usernameCounts.rows.find((row) => row.username === activeUsername)
	);

	const clanCounts = $derived.by(() => {
		const map = new SvelteMap<string, number>();
		for (const session of playerSessions) {
			const clanRaw = String(session.clanTag ?? '').trim();
			const clan = clanRaw ? clanRaw.toUpperCase() : 'No clan';
			map.set(clan, (map.get(clan) ?? 0) + 1);
		}

		const entries = Array.from(map.entries())
			.map(([clan, count]) => ({ clan, count }))
			.sort((left, right) => {
				if (left.count !== right.count) return right.count - left.count;
				return left.clan.localeCompare(right.clan, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
		const totalSessions = entries.reduce((sum, row) => sum + row.count, 0);
		const top = entries[0] ?? null;

		return {
			uniqueCount: entries.length,
			totalSessions,
			top,
			rows: entries.slice(0, maxBars)
		};
	});
	const activeClanDatum = $derived.by(() =>
		activeClan === null ? undefined : clanCounts.rows.find((row) => row.clan === activeClan)
	);

	const usernameConfig = {
		count: { label: 'Sessions', color: 'var(--chart-4)' }
	} satisfies Chart.ChartConfig;

	const clanConfig = {
		count: { label: 'Sessions', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;
</script>

<div class="grid gap-4">
	<Card.Root class="group">
		{#snippet usernameChart()}
			{#if usernameCounts.rows.length === 0}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No username frequency data</h3>
					<p class="text-sm text-muted-foreground">
						No public sessions are available for this player.
					</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={usernameConfig} class="aspect-auto h-[260px] w-full">
					<BarChart
						data={usernameCounts.rows}
						x="username"
						highlight={false}
						bandPadding={0.2}
						padding={chartPadding}
						series={[
							{
								key: 'count',
								label: usernameConfig.count.label,
								color: usernameConfig.count.color
							}
						]}
						props={{
							bars: { stroke: 'none' },
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet belowMarks()}
							<Highlight data={activeUsernameDatum} area={{ class: 'fill-muted' }} />
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet usernameSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-xl">Username frequency</Card.Title>
					<Card.Description>
						Top {formatNumber(maxBars)} usernames by public-session count ({formatNumber(
							usernameCounts.uniqueCount
						)} unique).
					</Card.Description>
				</div>
				{#if showHelp}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<GraphHelpSheet
							title="Username frequency"
							preview={usernamePreview as import('svelte').Snippet<[]>}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each bar is a normalized display name and its session count. This shows which names are
								used most often.
							</p>
							<p>
								When one bar dominates, it means the player is usually consistent with a single visible
								name.
							</p>
							{#if usernameCounts.top}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								<p>
									Most used name:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeUsername = usernameCounts.top?.username ?? null)}
										onmouseleave={() => (activeUsername = null)}
										onfocus={() => (activeUsername = usernameCounts.top?.username ?? null)}
										onblur={() => (activeUsername = null)}
									>
										{usernameCounts.top.username}
									</button>
									with {formatNumber(usernameCounts.top.count)} sessions.
								</p>
								<p>
									This top name is {formatPercent((usernameCounts.top.count / usernameCounts.totalSessions) * 100)}
									of tracked sessions.
								</p>
							{/if}
						</GraphHelpSheet>
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render (usernameChart as import('svelte').Snippet<[]>)()}
			</Card.Content>
		{/snippet}
		{#snippet usernamePreview()}
			{@render (usernameSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
				showHelp: false
			})}
		{/snippet}
		{@render (usernameSection as import('svelte').Snippet<[{ showHelp: boolean }]> )({
			showHelp: true
		})}
	</Card.Root>

	<Card.Root class="group">
		{#snippet clanChart()}
			{#if clanCounts.rows.length === 0}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No clan frequency data</h3>
					<p class="text-sm text-muted-foreground">
						No public sessions are available for this player.
					</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={clanConfig} class="aspect-auto h-[260px] w-full">
					<BarChart
						data={clanCounts.rows}
						x="clan"
						highlight={false}
						bandPadding={0.2}
						padding={chartPadding}
						series={[
							{
								key: 'count',
								label: clanConfig.count.label,
								color: clanConfig.count.color
							}
						]}
						props={{
							bars: { stroke: 'none' },
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet belowMarks()}
							<Highlight data={activeClanDatum} area={{ class: 'fill-muted' }} />
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet clanSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-xl">Clan frequency</Card.Title>
					<Card.Description>
						Top {formatNumber(maxBars)} clans by public-session count ({formatNumber(
							clanCounts.uniqueCount
						)} unique).
					</Card.Description>
				</div>
				{#if showHelp}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<GraphHelpSheet
							title="Clan frequency"
							preview={clanPreview as import('svelte').Snippet<[]>}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each bar is a clan tag (or No clan) and session count. This shows how often the player
								appears under each clan.
							</p>
							<p>
								Use this to spot frequent clan switches and whether one tag still dominates recent
								history.
							</p>
							{#if clanCounts.top}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								<p>
									Most common clan:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeClan = clanCounts.top?.clan ?? null)}
										onmouseleave={() => (activeClan = null)}
										onfocus={() => (activeClan = clanCounts.top?.clan ?? null)}
										onblur={() => (activeClan = null)}
									>
										{clanCounts.top.clan}
									</button>
									with {formatNumber(clanCounts.top.count)} sessions.
								</p>
								<p>
									This tag appears in {formatPercent((clanCounts.top.count / clanCounts.totalSessions) * 100)}
									of tracked sessions.
								</p>
							{/if}
						</GraphHelpSheet>
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render (clanChart as import('svelte').Snippet<[]>)()}
			</Card.Content>
		{/snippet}
		{#snippet clanPreview()}
			{@render (clanSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
				showHelp: false
			})}
		{/snippet}
		{@render (clanSection as import('svelte').Snippet<[{ showHelp: boolean }]> )({
			showHelp: true
		})}
	</Card.Root>
</div>
