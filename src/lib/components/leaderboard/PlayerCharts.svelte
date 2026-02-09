<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import type { PlayerSession } from '$lib/types/openfront';
	import { BarChart, Highlight, LineChart } from 'layerchart';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import XIcon from '@lucide/svelte/icons/x';
	import GraphHelpSheet from './GraphHelpSheet.svelte';
	import {
		chartPadding,
		createLineBrush,
		formatDateLabel,
		formatNumber,
		formatPercent,
		helpHeadingClass,
		iconButtonClass,
		yAxisNoNumbers
	} from './charts/chart-utils';

	let {
		playerSessions = [],
		sessionsLoading = false,
		sessionsError = ''
	} = $props<{
		playerSessions?: PlayerSession[];
		sessionsLoading?: boolean;
		sessionsError?: string;
	}>();

	let activityDomain = $state<import('./charts/chart-utils').ChartDomain | null>(null);
	let typeWinRateDomain = $state<import('./charts/chart-utils').ChartDomain | null>(null);
	let activeMode = $state<string | null>(null);
	let activeType = $state<string | null>(null);

	const chartColorPalette = [
		'var(--chart-1)',
		'var(--chart-2)',
		'var(--chart-3)',
		'var(--chart-4)',
		'var(--chart-5)'
	] as const;

	const getSessionDate = (session: PlayerSession) => {
		const raw = session.gameStart;
		if (!raw) return null;
		const parsed = new Date(String(raw));
		if (Number.isNaN(parsed.getTime())) return null;
		return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
	};

	const getSessionMode = (session: PlayerSession) => {
		const value = session.gameMode;
		return value ? String(value) : 'Unknown';
	};

	const getSessionType = (session: PlayerSession) => {
		const value = session.gameType;
		return value ? String(value) : 'Unknown';
	};

	const dailyActivityData = $derived.by(() => {
		const map = new SvelteMap<
			string,
			{
				date: Date;
				dateLabel: string;
				sessions: number;
				wins: number;
				losses: number;
			}
		>();

		for (const session of playerSessions) {
			const date = getSessionDate(session);
			if (!date) continue;
			const key = date.toISOString().slice(0, 10);
			const row = map.get(key) ?? {
				date,
				dateLabel: formatDateLabel(date),
				sessions: 0,
				wins: 0,
				losses: 0
			};
			row.sessions += 1;
			if (session.hasWon === true) row.wins += 1;
			if (session.hasWon === false) row.losses += 1;
			map.set(key, row);
		}

		return Array.from(map.values()).sort(
			(left, right) => left.date.getTime() - right.date.getTime()
		);
	});

	const dailyActivitySummary = $derived.by(() => {
		if (dailyActivityData.length === 0) return null;
		const totalSessions = dailyActivityData.reduce((sum, row) => sum + row.sessions, 0);
		const activeDays = dailyActivityData.length;
		const avgPerDay = totalSessions / activeDays;
		const busiestDay = dailyActivityData.reduce((best, row) =>
			row.sessions > best.sessions ? row : best
		);
		return {
			totalSessions,
			activeDays,
			avgPerDay,
			busiestDay
		};
	});

	const typeWinRateByDay = $derived.by(() => {
		const map = new SvelteMap<
			string,
			{
				date: Date;
				dateLabel: string;
				outcomes: SvelteMap<string, { wins: number; losses: number }>;
			}
		>();
		const types = new SvelteSet<string>();

		for (const session of playerSessions) {
			const date = getSessionDate(session);
			if (!date) continue;
			if (session.hasWon !== true && session.hasWon !== false) continue;

			const type = getSessionType(session);
			types.add(type);

			const key = date.toISOString().slice(0, 10);
			const row = map.get(key) ?? {
				date,
				dateLabel: formatDateLabel(date),
				outcomes: new SvelteMap<string, { wins: number; losses: number }>()
			};
			const outcome = row.outcomes.get(type) ?? { wins: 0, losses: 0 };
			if (session.hasWon) {
				outcome.wins += 1;
			} else {
				outcome.losses += 1;
			}
			row.outcomes.set(type, outcome);
			map.set(key, row);
		}

		const sortedTypes = Array.from(types.values()).sort((left, right) =>
			left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
		);
		const series = sortedTypes.map((type, index) => ({
			type,
			key: `type_${index + 1}`,
			color: chartColorPalette[index % chartColorPalette.length]
		}));

		const rows = Array.from(map.values())
			.sort((left, right) => left.date.getTime() - right.date.getTime())
			.map((entry) => {
				const row: Record<string, string | number | Date> = {
					date: entry.date,
					dateLabel: entry.dateLabel
				};
				for (const seriesEntry of series) {
					const outcome = entry.outcomes.get(seriesEntry.type);
					const total = (outcome?.wins ?? 0) + (outcome?.losses ?? 0);
					if (total > 0) {
						row[seriesEntry.key] = Number(((outcome!.wins / total) * 100).toFixed(1));
					}
				}
				return row;
			});

		return { rows, series };
	});
	const typeWinRateTickStep = $derived.by(() => {
		const count = typeWinRateByDay.rows.length;
		if (count <= 1) return 1;
		return Math.max(2, Math.ceil(count / 7));
	});
	const typeWinRateConfig = $derived.by(() => {
		const config: Chart.ChartConfig = {};
		for (const seriesEntry of typeWinRateByDay.series) {
			config[seriesEntry.key] = { label: seriesEntry.type, color: seriesEntry.color };
		}
		return config;
	});
	const hasTypeWinRateData = $derived.by(
		() => typeWinRateByDay.rows.length > 0 && typeWinRateByDay.series.length > 0
	);

	const modeOutcomeData = $derived.by(() => {
		const map = new SvelteMap<
			string,
			{ mode: string; wins: number; losses: number; total: number }
		>();
		for (const session of playerSessions) {
			const mode = getSessionMode(session);
			const row = map.get(mode) ?? { mode, wins: 0, losses: 0, total: 0 };
			row.total += 1;
			if (session.hasWon === true) row.wins += 1;
			if (session.hasWon === false) row.losses += 1;
			map.set(mode, row);
		}
		return Array.from(map.values())
			.map((row) => ({
				...row,
				winRate: row.total > 0 ? (row.wins / row.total) * 100 : 0
			}))
			.sort((left, right) => right.total - left.total);
	});

	const modeSummary = $derived.by(() => {
		if (modeOutcomeData.length === 0) return null;
		const mostPlayed = modeOutcomeData.reduce((best, row) => (row.total > best.total ? row : best));
		const bestRate = modeOutcomeData.reduce((best, row) =>
			row.winRate > best.winRate ? row : best
		);
		return { mostPlayed, bestRate };
	});

	const typeOutcomeData = $derived.by(() => {
		const map = new SvelteMap<
			string,
			{ type: string; wins: number; losses: number; total: number }
		>();
		for (const session of playerSessions) {
			const type = getSessionType(session);
			const row = map.get(type) ?? { type, wins: 0, losses: 0, total: 0 };
			row.total += 1;
			if (session.hasWon === true) row.wins += 1;
			if (session.hasWon === false) row.losses += 1;
			map.set(type, row);
		}
		return Array.from(map.values())
			.map((row) => ({
				...row,
				winRate: row.total > 0 ? (row.wins / row.total) * 100 : 0
			}))
			.sort((left, right) => right.total - left.total);
	});

	const typeSummary = $derived.by(() => {
		if (typeOutcomeData.length === 0) return null;
		const mostPlayed = typeOutcomeData.reduce((best, row) => (row.total > best.total ? row : best));
		const bestRate = typeOutcomeData.reduce((best, row) =>
			row.winRate > best.winRate ? row : best
		);
		return { mostPlayed, bestRate };
	});

	const activeModeDatum = $derived.by(() =>
		activeMode === null ? undefined : modeOutcomeData.find((row) => row.mode === activeMode)
	);
	const activeTypeDatum = $derived.by(() =>
		activeType === null ? undefined : typeOutcomeData.find((row) => row.type === activeType)
	);

	const activityConfig = {
		sessions: { label: 'Sessions', color: 'var(--chart-4)' }
	} satisfies Chart.ChartConfig;

	const modeConfig = {
		wins: { label: 'Wins', color: 'var(--chart-4)' },
		losses: { label: 'Losses', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const typeConfig = {
		wins: { label: 'Wins', color: 'var(--chart-4)' },
		losses: { label: 'Losses', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const hasSessionData = $derived.by(() => playerSessions.length > 0);
</script>

<div class="grid gap-6">
	<div class="text-base font-semibold">Session trends</div>
	{#if sessionsError && !hasSessionData}
		<Empty.Root class="border-muted-foreground/30">
			<h3 class="text-base font-semibold">Session data unavailable</h3>
			<p class="text-sm text-muted-foreground">{sessionsError}</p>
		</Empty.Root>
	{:else if sessionsLoading && !hasSessionData}
		<Empty.Root class="border-muted-foreground/30">
			<h3 class="text-base font-semibold">Loading session data...</h3>
			<p class="text-sm text-muted-foreground">Recent games are on the way.</p>
		</Empty.Root>
	{:else if !hasSessionData}
		<Empty.Root class="border-muted-foreground/30">
			<h3 class="text-base font-semibold">No session data available</h3>
			<p class="text-sm text-muted-foreground">This player has no public sessions.</p>
		</Empty.Root>
	{:else}
		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root class="group lg:col-span-2">
				{#snippet activityChart()}
					<Chart.Container config={activityConfig} class="aspect-auto h-[260px] w-full">
						<LineChart
							data={dailyActivityData}
							x="date"
							xDomain={activityDomain ?? undefined}
							brush={createLineBrush((value) => (activityDomain = value))}
							padding={chartPadding}
							series={[
								{
									key: 'sessions',
									value: 'sessions',
									label: activityConfig.sessions.label,
									color: activityConfig.sessions.color
								}
							]}
							props={{
								xAxis: {
									format: (value) => {
										const dateValue = value instanceof Date ? value : new Date(value);
										if (Number.isNaN(dateValue.getTime())) return String(value);
										return formatDateLabel(dateValue);
									},
									ticks: Math.max(2, Math.ceil(dailyActivityData.length / 7))
								},
								yAxis: { ...yAxisNoNumbers }
							}}
						>
							{#snippet tooltip()}
								<Chart.Tooltip labelKey="dateLabel" />
							{/snippet}
						</LineChart>
					</Chart.Container>
				{/snippet}
				{#snippet activitySection({ showHelp }: { showHelp: boolean })}
					<Card.Header class="flex items-start justify-between gap-3">
						<div>
							<Card.Title class="text-base">Daily activity</Card.Title>
							<Card.Description>Session volume over time.</Card.Description>
						</div>
						{#if showHelp || activityDomain != null}
							<div
								class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
							>
								{#if activityDomain != null}
									<button
										type="button"
										class={iconButtonClass}
										aria-label="Clear zoom"
										onclick={() => (activityDomain = null)}
									>
										<XIcon class="h-4 w-4" />
									</button>
								{/if}
								{#if showHelp}
									<GraphHelpSheet
										title="Daily activity"
										preview={activityPreview as import('svelte').Snippet<[]>}
										class={iconButtonClass}
									>
										<p class={helpHeadingClass}>How to read</p>
										<p>
											Each point is the number of sessions played on that day. Use it to spot active
											streaks and quiet periods.
										</p>
										<p>Drag on the chart to zoom into a specific date window.</p>
										{#if dailyActivitySummary}
											<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
											<p>
												{formatNumber(dailyActivitySummary.totalSessions)} sessions across
												{formatNumber(dailyActivitySummary.activeDays)} active days.
											</p>
											<p>
												Average activity is {dailyActivitySummary.avgPerDay.toFixed(1)} sessions/day.
											</p>
											<p>
												Busiest day:
												{dailyActivitySummary.busiestDay.dateLabel}
												({formatNumber(dailyActivitySummary.busiestDay.sessions)} sessions).
											</p>
										{/if}
									</GraphHelpSheet>
								{/if}
							</div>
						{/if}
					</Card.Header>
					<Card.Content>
						{@render (activityChart as import('svelte').Snippet<[]>)()}
					</Card.Content>
				{/snippet}
				{#snippet activityPreview()}
					{@render (activitySection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
						showHelp: false
					})}
				{/snippet}
				{@render (activitySection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
					showHelp: true
				})}
			</Card.Root>

			<Card.Root class="group lg:col-span-2">
				{#snippet typeWinRateChart()}
					{#if !hasTypeWinRateData}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-base font-semibold">No game-type win-rate trends yet</h3>
							<p class="text-sm text-muted-foreground">
								More games are needed to compare win rate by type over time.
							</p>
						</Empty.Root>
					{:else}
						<Chart.Container config={typeWinRateConfig} class="aspect-auto h-[260px] w-full">
							<LineChart
								data={typeWinRateByDay.rows}
								x="date"
								xDomain={typeWinRateDomain ?? undefined}
								brush={createLineBrush((value) => (typeWinRateDomain = value))}
								padding={chartPadding}
								series={typeWinRateByDay.series.map((seriesEntry) => ({
									key: seriesEntry.key,
									value: seriesEntry.key,
									label: seriesEntry.type,
									color: seriesEntry.color
								}))}
								props={{
									xAxis: {
										format: (value) => {
											const dateValue = value instanceof Date ? value : new Date(value);
											if (Number.isNaN(dateValue.getTime())) return String(value);
											return formatDateLabel(dateValue);
										},
										ticks: typeWinRateTickStep
									},
									yAxis: { ...yAxisNoNumbers }
								}}
							>
								{#snippet tooltip()}
									<Chart.Tooltip labelKey="dateLabel" />
								{/snippet}
							</LineChart>
						</Chart.Container>
					{/if}
				{/snippet}
				{#snippet typeWinRateSection({ showHelp }: { showHelp: boolean })}
					<Card.Header class="flex items-start justify-between gap-3">
						<div>
							<Card.Title class="text-base">Win rate by game type</Card.Title>
							<Card.Description>Layered daily win-rate lines split by game type.</Card.Description>
						</div>
						{#if showHelp || typeWinRateDomain != null}
							<div
								class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
							>
								{#if typeWinRateDomain != null}
									<button
										type="button"
										class={iconButtonClass}
										aria-label="Clear zoom"
										onclick={() => (typeWinRateDomain = null)}
									>
										<XIcon class="h-4 w-4" />
									</button>
								{/if}
								{#if showHelp}
									<GraphHelpSheet
										title="Win rate by game type"
										preview={typeWinRatePreview as import('svelte').Snippet<[]>}
										class={iconButtonClass}
									>
										<p class={helpHeadingClass}>How to read</p>
										<p>
											Each line tracks daily win rate for one game type. This shows how performance
											changes over time in each queue.
										</p>
										<p>Drag on the chart to zoom into a smaller date range.</p>
										{#if typeSummary}
											<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
											<p>
												Most played type:
												{typeSummary.mostPlayed.type}
												with {formatNumber(typeSummary.mostPlayed.total)} games.
											</p>
											<p>
												Best overall type win rate:
												{typeSummary.bestRate.type}
												at {formatPercent(typeSummary.bestRate.winRate)}.
											</p>
										{/if}
									</GraphHelpSheet>
								{/if}
							</div>
						{/if}
					</Card.Header>
					<Card.Content>
						{@render (typeWinRateChart as import('svelte').Snippet<[]>)()}
					</Card.Content>
				{/snippet}
				{#snippet typeWinRatePreview()}
					{@render (typeWinRateSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
						showHelp: false
					})}
				{/snippet}
				{@render (typeWinRateSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
					showHelp: true
				})}
			</Card.Root>

			<Card.Root class="group">
				{#snippet modeChart()}
					<Chart.Container config={modeConfig} class="min-h-[220px] w-full">
						<BarChart
							data={modeOutcomeData}
							x="mode"
							highlight={false}
							bandPadding={0.3}
							seriesLayout="stack"
							padding={chartPadding}
							series={[
								{ key: 'wins', label: modeConfig.wins.label, color: modeConfig.wins.color },
								{ key: 'losses', label: modeConfig.losses.label, color: modeConfig.losses.color }
							]}
							props={{
								bars: { stroke: 'none' },
								yAxis: { ...yAxisNoNumbers }
							}}
						>
							{#snippet belowMarks()}
								<Highlight data={activeModeDatum} area={{ class: 'fill-muted' }} />
							{/snippet}
							{#snippet tooltip()}
								<Chart.Tooltip />
							{/snippet}
						</BarChart>
					</Chart.Container>
				{/snippet}
				{#snippet modeSection({ showHelp }: { showHelp: boolean })}
					<Card.Header class="flex items-start justify-between gap-3">
						<div>
							<Card.Title class="text-base">Wins vs losses by mode</Card.Title>
							<Card.Description>Performance split across game modes.</Card.Description>
						</div>
						{#if showHelp}
							<div
								class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
							>
								<GraphHelpSheet
									title="Wins vs losses by mode"
									preview={modePreview as import('svelte').Snippet<[]>}
									class={iconButtonClass}
								>
									<p class={helpHeadingClass}>How to read</p>
									<p>Each bar stacks wins and losses for one mode. Total height is total games.</p>
									<ul class="list-disc pl-4">
										<li>More dark area means stronger results in that mode.</li>
										<li>Taller bars mean larger sample size.</li>
									</ul>
									{#if modeSummary}
										<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
										<p>
											Most played mode:
											<button
												type="button"
												class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
												onmouseenter={() => (activeMode = modeSummary.mostPlayed.mode)}
												onmouseleave={() => (activeMode = null)}
												onfocus={() => (activeMode = modeSummary.mostPlayed.mode)}
												onblur={() => (activeMode = null)}
											>
												{modeSummary.mostPlayed.mode}
											</button>
											with {formatNumber(modeSummary.mostPlayed.total)} games.
										</p>
										<p>
											Best mode win rate:
											{modeSummary.bestRate.mode}
											at {formatPercent(modeSummary.bestRate.winRate)}.
										</p>
									{/if}
								</GraphHelpSheet>
							</div>
						{/if}
					</Card.Header>
					<Card.Content>
						{@render (modeChart as import('svelte').Snippet<[]>)()}
					</Card.Content>
				{/snippet}
				{#snippet modePreview()}
					{@render (modeSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
						showHelp: false
					})}
				{/snippet}
				{@render (modeSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
					showHelp: true
				})}
			</Card.Root>

			<Card.Root class="group">
				{#snippet typeChart()}
					<Chart.Container config={typeConfig} class="min-h-[220px] w-full">
						<BarChart
							data={typeOutcomeData}
							x="type"
							highlight={false}
							bandPadding={0.3}
							seriesLayout="stack"
							padding={chartPadding}
							series={[
								{ key: 'wins', label: typeConfig.wins.label, color: typeConfig.wins.color },
								{ key: 'losses', label: typeConfig.losses.label, color: typeConfig.losses.color }
							]}
							props={{
								bars: { stroke: 'none' },
								yAxis: { ...yAxisNoNumbers }
							}}
						>
							{#snippet belowMarks()}
								<Highlight data={activeTypeDatum} area={{ class: 'fill-muted' }} />
							{/snippet}
							{#snippet tooltip()}
								<Chart.Tooltip />
							{/snippet}
						</BarChart>
					</Chart.Container>
				{/snippet}
				{#snippet typeSection({ showHelp }: { showHelp: boolean })}
					<Card.Header class="flex items-start justify-between gap-3">
						<div>
							<Card.Title class="text-base">Wins vs losses by type</Card.Title>
							<Card.Description>Performance split across game types.</Card.Description>
						</div>
						{#if showHelp}
							<div
								class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
							>
								<GraphHelpSheet
									title="Wins vs losses by type"
									preview={typePreview as import('svelte').Snippet<[]>}
									class={iconButtonClass}
								>
									<p class={helpHeadingClass}>How to read</p>
									<p>Each bar stacks wins and losses for a game type (Public, Private, etc.).</p>
									<ul class="list-disc pl-4">
										<li>Use this to compare where you perform best.</li>
										<li>Check sample size before trusting a high win rate.</li>
									</ul>
									{#if typeSummary}
										<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
										<p>
											Most played type:
											<button
												type="button"
												class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
												onmouseenter={() => (activeType = typeSummary.mostPlayed.type)}
												onmouseleave={() => (activeType = null)}
												onfocus={() => (activeType = typeSummary.mostPlayed.type)}
												onblur={() => (activeType = null)}
											>
												{typeSummary.mostPlayed.type}
											</button>
											with {formatNumber(typeSummary.mostPlayed.total)} games.
										</p>
										<p>
											Best type win rate:
											{typeSummary.bestRate.type}
											at {formatPercent(typeSummary.bestRate.winRate)}.
										</p>
									{/if}
								</GraphHelpSheet>
							</div>
						{/if}
					</Card.Header>
					<Card.Content>
						{@render (typeChart as import('svelte').Snippet<[]>)()}
					</Card.Content>
				{/snippet}
				{#snippet typePreview()}
					{@render (typeSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
						showHelp: false
					})}
				{/snippet}
				{@render (typeSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
					showHelp: true
				})}
			</Card.Root>
		</div>
	{/if}
</div>
