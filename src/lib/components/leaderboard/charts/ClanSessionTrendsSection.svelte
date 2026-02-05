<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import { Bar, BarChart, LineChart } from 'layerchart';
	import type { ClanSession } from '$lib/types/openfront';
	import { SvelteMap } from 'svelte/reactivity';
	import GraphHelpSheet from '../GraphHelpSheet.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import {
		chartPadding,
		createLineBrush,
		formatDateLabel,
		formatNumber,
		formatPercent,
		formatRatio,
		helpHeadingClass,
		iconButtonClass,
		roundTo,
		yAxisNoNumbers
	} from './chart-utils';
	import { getSessionClanPlayers, getSessionHasWon, getSessionStart, getSessionTotalPlayers } from './clan-session-utils';

	let { clanSessions = [] } = $props<{
		clanSessions?: ClanSession[];
	}>();

	let dailyWinRateDomain = $state<unknown>(null);
	let activeDailyWinRateDates = $state<Date[] | null>(null);
	let activeParticipationBucket = $state<string | null>(null);
	let activeClanSizeBucket = $state<string | null>(null);

	const dailyWinRate = $derived.by(() => {
		const map = new SvelteMap<
			string,
			{
				date: Date;
				dateLabel: string;
				wins: number;
				losses: number;
			}
		>();

		for (const session of clanSessions) {
			const start = getSessionStart(session);
			if (!start) continue;
			const date = new Date(String(start));
			if (Number.isNaN(date.getTime())) continue;
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const dayOfMonth = String(date.getDate()).padStart(2, '0');
			const key = `${year}-${month}-${dayOfMonth}`;
			const day = new Date(year, date.getMonth(), date.getDate());
			const hasWon = getSessionHasWon(session);
			if (hasWon === null) continue;
			const current = map.get(key) ?? {
				date: day,
				dateLabel: formatDateLabel(day),
				wins: 0,
				losses: 0
			};
			if (hasWon) {
				current.wins += 1;
			} else {
				current.losses += 1;
			}
			map.set(key, current);
		}

		return Array.from(map.values())
			.sort((a, b) => a.date.getTime() - b.date.getTime())
			.map((entry) => {
				const total = entry.wins + entry.losses;
				const rate = total > 0 ? (entry.wins / total) * 100 : 0;
				return {
					date: entry.date,
					dateLabel: entry.dateLabel,
					winRate: roundTo(rate, 1),
					wins: entry.wins,
					losses: entry.losses
				};
			});
	});
	const dailyWinRateSummary = $derived.by(() => {
		if (dailyWinRate.length === 0) return null;
		const avg = dailyWinRate.reduce((sum, entry) => sum + entry.winRate, 0) / dailyWinRate.length;
		const bestDay = dailyWinRate.reduce((best, entry) =>
			entry.winRate > best.winRate ? entry : best
		);
		const worstDay = dailyWinRate.reduce((best, entry) =>
			entry.winRate < best.winRate ? entry : best
		);
		const recentWindow = dailyWinRate.slice(-7);
		const recentAvg =
			recentWindow.reduce((sum, entry) => sum + entry.winRate, 0) / recentWindow.length;
		return { avg, bestDay, worstDay, recentAvg };
	});
	const dailyWinRateTickStep = $derived.by(() => {
		const count = dailyWinRate.length;
		if (count <= 1) return 1;
		return Math.max(2, Math.ceil(count / 7));
	});

	const participationBuckets = $derived.by(() => {
		const bucketSize = 10;
		const buckets = Array.from({ length: 10 }, (_, index) => ({
			bucket: `${index * bucketSize}-${(index + 1) * bucketSize}%`,
			count: 0,
			start: index * bucketSize
		}));

		for (const session of clanSessions) {
			const clanPlayers = Number(getSessionClanPlayers(session));
			const totalPlayers = Number(getSessionTotalPlayers(session));
			if (!Number.isFinite(clanPlayers) || !Number.isFinite(totalPlayers) || totalPlayers <= 0) {
				continue;
			}
			const ratio = Math.max(0, Math.min(1, clanPlayers / totalPlayers));
			const percent = ratio * 100;
			const bucketIndex = Math.min(9, Math.floor(percent / bucketSize));
			buckets[bucketIndex].count += 1;
		}

		return buckets;
	});
	const participationSummary = $derived.by(() => {
		const samples = clanSessions
			.map((session) => {
				const clanPlayers = Number(getSessionClanPlayers(session));
				const totalPlayers = Number(getSessionTotalPlayers(session));
				if (!Number.isFinite(clanPlayers) || !Number.isFinite(totalPlayers) || totalPlayers <= 0) {
					return null;
				}
				return clanPlayers / totalPlayers;
			})
			.filter((value): value is number => value !== null);
		if (samples.length === 0) return null;
		const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
		const aboveHalf = samples.filter((value) => value >= 0.5).length;
		return { avg, aboveHalf, total: samples.length };
	});
	const participationPeak = $derived.by(() => {
		if (participationBuckets.length === 0) return null;
		return participationBuckets.reduce(
			(best, bucket) => (bucket.count > best.count ? bucket : best),
			participationBuckets[0]
		);
	});

	const clanSizeBuckets = $derived.by(() => {
		const buckets = [
			{ bucket: '1-2', min: 1, max: 2, count: 0 },
			{ bucket: '3-4', min: 3, max: 4, count: 0 },
			{ bucket: '5-6', min: 5, max: 6, count: 0 },
			{ bucket: '7-8', min: 7, max: 8, count: 0 },
			{ bucket: '9+', min: 9, max: Infinity, count: 0 }
		];

		for (const session of clanSessions) {
			const clanPlayers = Number(getSessionClanPlayers(session));
			if (!Number.isFinite(clanPlayers) || clanPlayers <= 0) continue;
			const bucket = buckets.find((entry) => clanPlayers >= entry.min && clanPlayers <= entry.max);
			if (bucket) bucket.count += 1;
		}

		return buckets;
	});
	const clanSizeSummary = $derived.by(() => {
		if (clanSizeBuckets.length === 0) return null;
		const total = clanSizeBuckets.reduce((sum, entry) => sum + entry.count, 0);
		if (total === 0) return null;
		const weightedAverage = clanSizeBuckets.reduce((sum, entry) => {
			const midpoint = entry.bucket.includes('+') ? entry.min + 1 : (entry.min + entry.max) / 2;
			return sum + midpoint * entry.count;
		}, 0);
		const avgSize = weightedAverage / total;
		const largeCount = clanSizeBuckets
			.filter((entry) => entry.min >= 5)
			.reduce((sum, entry) => sum + entry.count, 0);
		return { avgSize, largeCount, total };
	});
	const clanSizePeak = $derived.by(() => {
		if (clanSizeBuckets.length === 0) return null;
		return clanSizeBuckets.reduce(
			(best, bucket) => (bucket.count > best.count ? bucket : best),
			clanSizeBuckets[0]
		);
	});
	const hasClanSizeData = $derived.by(() => clanSizeBuckets.some((bucket) => bucket.count > 0));

	const dailyWinRateConfig = {
		winRate: { label: 'Win Rate', color: 'var(--chart-4)' }
	} satisfies Chart.ChartConfig;

	const participationConfig = {
		count: { label: 'Sessions', color: 'var(--chart-3)' }
	} satisfies Chart.ChartConfig;

	const clanSizeConfig = {
		count: { label: 'Sessions', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="group lg:col-span-2">
		{#snippet dailyWinRateChart()}
			{#if dailyWinRate.length === 0}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No daily trend yet</h3>
					<p class="text-sm text-muted-foreground">More games are needed to show trends.</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={dailyWinRateConfig} class="aspect-auto h-[240px] w-full">
					<LineChart
						data={dailyWinRate}
						x="date"
						xDomain={dailyWinRateDomain ?? undefined}
						brush={createLineBrush((value) => (dailyWinRateDomain = value))}
						padding={chartPadding}
						series={[
							{
								key: 'winRate',
								value: 'winRate',
								label: dailyWinRateConfig.winRate.label,
								color: dailyWinRateConfig.winRate.color
							}
						]}
						props={{
							xAxis: {
								format: (value) => {
									const dateValue = value instanceof Date ? value : new Date(value);
									if (Number.isNaN(dateValue.getTime())) return String(value);
									return formatDateLabel(dateValue);
								},
								ticks: dailyWinRateTickStep
							},
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet aboveMarks({ context })}
							{#if activeDailyWinRateDates && activeDailyWinRateDates.length > 0}
								{@const yMin = Math.min(...context.yRange)}
								{@const yMax = Math.max(...context.yRange)}
								{#each activeDailyWinRateDates as dateValue (dateValue.getTime())}
									{@const xValue = context.xScale(dateValue)}
									{#if Number.isFinite(xValue)}
										<line
											x1={xValue}
											x2={xValue}
											y1={yMin}
											y2={yMax}
											class="stroke-foreground/60"
											stroke-dasharray="4 4"
											stroke-width="1"
											opacity="0.9"
											pointer-events="none"
										/>
									{/if}
								{/each}
							{/if}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip
								labelKey="dateLabel"
								labelFormatter={(value, payload) => {
									const payloadValue = payload?.[0]?.payload as { dateLabel?: string };
									if (payloadValue?.dateLabel) return payloadValue.dateLabel;
									if (typeof value === 'string') return value;
									if (value instanceof Date) return formatDateLabel(value);
									const parsed = new Date(String(value));
									if (!Number.isNaN(parsed.getTime())) return formatDateLabel(parsed);
									return String(value);
								}}
							/>
						{/snippet}
					</LineChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet dailyWinRateSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Daily win rate</Card.Title>
					<Card.Description>Wins versus losses grouped by day.</Card.Description>
				</div>
				{#if showHelp || dailyWinRateDomain != null}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						{#if dailyWinRateDomain != null}
							<button
								type="button"
								class={iconButtonClass}
								aria-label="Clear zoom"
								onclick={() => (dailyWinRateDomain = null)}
							>
								<XIcon class="h-4 w-4" />
							</button>
						{/if}
						{#if showHelp}
							<GraphHelpSheet
								title="Daily win rate"
								preview={dailyWinRatePreview}
								class={iconButtonClass}
							>
								<p class={helpHeadingClass}>How to read</p>
								<p>
									Each point is a day and the line is the win percentage for that day. It makes
									streaks and slumps obvious at a glance.
								</p>
								<p>Use the brush to zoom into specific time windows.</p>
								<ul class="list-disc pl-4">
									<li>Upward moves mean better daily results.</li>
									<li>Flat lines mean consistency.</li>
								</ul>
								{#if dailyWinRateSummary}
									<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
									<p>Average daily win rate: {formatPercent(dailyWinRateSummary.avg)}.</p>
									<p>Recent 7-day average: {formatPercent(dailyWinRateSummary.recentAvg)}.</p>
									<p>
										Best day:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() =>
												(activeDailyWinRateDates = [dailyWinRateSummary.bestDay.date])}
											onmouseleave={() => (activeDailyWinRateDates = null)}
											onfocus={() =>
												(activeDailyWinRateDates = [dailyWinRateSummary.bestDay.date])}
											onblur={() => (activeDailyWinRateDates = null)}
										>
											{dailyWinRateSummary.bestDay.dateLabel}
										</button>
										at {formatPercent(dailyWinRateSummary.bestDay.winRate)}. Worst day:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() =>
												(activeDailyWinRateDates = [dailyWinRateSummary.worstDay.date])}
											onmouseleave={() => (activeDailyWinRateDates = null)}
											onfocus={() =>
												(activeDailyWinRateDates = [dailyWinRateSummary.worstDay.date])}
											onblur={() => (activeDailyWinRateDates = null)}
										>
											{dailyWinRateSummary.worstDay.dateLabel}
										</button>
										at {formatPercent(dailyWinRateSummary.worstDay.winRate)}.
									</p>
								{/if}
							</GraphHelpSheet>
						{/if}
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render dailyWinRateChart()}
			</Card.Content>
		{/snippet}
		{#snippet dailyWinRatePreview()}
			{@render dailyWinRateSection({ showHelp: false })}
		{/snippet}
		{@render dailyWinRateSection({ showHelp: true })}
	</Card.Root>

	<Card.Root class="group">
		{#snippet participationChart()}
			<Chart.Container config={participationConfig} class="min-h-[220px] w-full">
				<BarChart
					data={participationBuckets}
					x="bucket"
					bandPadding={0.2}
					padding={chartPadding}
					series={[
						{
							key: 'count',
							label: participationConfig.count.label,
							color: participationConfig.count.color
						}
					]}
					props={{
						bars: { stroke: 'none' },
						yAxis: { ...yAxisNoNumbers }
					}}
				>
					{#snippet marks({ context, visibleSeries, getBarsProps })}
						{#if visibleSeries.length}
							{@const barProps = getBarsProps(visibleSeries[0], 0)}
							{#each context.flatData as d, i (d.bucket ?? i)}
								{@const isActive =
									activeParticipationBucket !== null && d.bucket === activeParticipationBucket}
								<Bar
									class="lc-bars-bar"
									data={d}
									x={barProps.x}
									y={barProps.y}
									x1={barProps.x1}
									y1={barProps.y1}
									radius={barProps.radius}
									rounded={barProps.rounded}
									insets={barProps.insets}
									fill={barProps.fill}
									opacity={barProps.opacity ?? 1}
									stroke="none"
									strokeWidth={0}
									style={isActive
										? 'filter: drop-shadow(0 -1px 0 var(--foreground)) drop-shadow(1px 0 0 var(--foreground)) drop-shadow(-1px 0 0 var(--foreground));'
										: undefined}
								/>
							{/each}
						{/if}
					{/snippet}
					{#snippet tooltip()}
						<Chart.Tooltip />
					{/snippet}
				</BarChart>
			</Chart.Container>
		{/snippet}
		{#snippet participationSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Clan participation</Card.Title>
					<Card.Description>Lobby share for clan members.</Card.Description>
				</div>
				{#if showHelp}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<GraphHelpSheet
							title="Clan participation"
							preview={participationPreview}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each bar is a bucket of lobby share (0–10%, 10–20%, etc.). It shows how much of the
								lobby was made up of clan members.
							</p>
							<p>Use this to see whether the clan usually queues small or as a big stack.</p>
							<ul class="list-disc pl-4">
								<li>Right-side buckets mean higher clan presence.</li>
								<li>Left-heavy bars mean the clan is a smaller share.</li>
							</ul>
							{#if participationPeak || participationSummary}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								{#if participationPeak}
									<p>
										Most common range:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() => (activeParticipationBucket = participationPeak.bucket)}
											onmouseleave={() => (activeParticipationBucket = null)}
											onfocus={() => (activeParticipationBucket = participationPeak.bucket)}
											onblur={() => (activeParticipationBucket = null)}
										>
											{participationPeak.bucket}
										</button>
										({formatNumber(participationPeak.count)} sessions).
									</p>
								{/if}
								{#if participationSummary}
									<p>
										Average participation is about {formatPercent(participationSummary.avg * 100)}
										of the lobby.
									</p>
									<p>
										{formatPercent(
											(participationSummary.aboveHalf / participationSummary.total) * 100
										)} of sessions have the clan making up at least half the lobby.
									</p>
								{/if}
							{/if}
						</GraphHelpSheet>
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render participationChart()}
			</Card.Content>
		{/snippet}
		{#snippet participationPreview()}
			{@render participationSection({ showHelp: false })}
		{/snippet}
		{@render participationSection({ showHelp: true })}
	</Card.Root>

	<Card.Root class="group">
		{#snippet clanSizeChart()}
			{#if !hasClanSizeData}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No roster data</h3>
					<p class="text-sm text-muted-foreground">
						Clan player counts are missing for these sessions.
					</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={clanSizeConfig} class="min-h-[220px] w-full">
					<BarChart
						data={clanSizeBuckets}
						x="bucket"
						bandPadding={0.3}
						padding={chartPadding}
						series={[
							{
								key: 'count',
								label: clanSizeConfig.count.label,
								color: clanSizeConfig.count.color
							}
						]}
						props={{
							bars: { stroke: 'none' },
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet marks({ context, visibleSeries, getBarsProps })}
							{#if visibleSeries.length}
								{@const barProps = getBarsProps(visibleSeries[0], 0)}
								{#each context.flatData as d, i (d.bucket ?? i)}
									{@const isActive =
										activeClanSizeBucket !== null && d.bucket === activeClanSizeBucket}
									<Bar
										class="lc-bars-bar"
										data={d}
										x={barProps.x}
										y={barProps.y}
										x1={barProps.x1}
										y1={barProps.y1}
										radius={barProps.radius}
										rounded={barProps.rounded}
										insets={barProps.insets}
										fill={barProps.fill}
										opacity={barProps.opacity ?? 1}
										stroke="none"
										strokeWidth={0}
										style={isActive
											? 'filter: drop-shadow(0 -1px 0 var(--foreground)) drop-shadow(1px 0 0 var(--foreground)) drop-shadow(-1px 0 0 var(--foreground));'
											: undefined}
									/>
								{/each}
							{/if}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet clanSizeSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Clan roster size</Card.Title>
					<Card.Description>Sessions grouped by clan players per match.</Card.Description>
				</div>
				{#if showHelp}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<GraphHelpSheet
							title="Clan roster size"
							preview={clanSizePreview}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each bar groups sessions by how many clan players joined the match. It shows if the
								clan usually plays as a small squad or a big group.
							</p>
							<p>Use this to understand typical party size.</p>
							<ul class="list-disc pl-4">
								<li>Left bars mean smaller parties.</li>
								<li>Right bars mean fuller stacks.</li>
							</ul>
							{#if clanSizePeak || clanSizeSummary}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								{#if clanSizePeak}
									<p>
										Most common roster size:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() => (activeClanSizeBucket = clanSizePeak.bucket)}
											onmouseleave={() => (activeClanSizeBucket = null)}
											onfocus={() => (activeClanSizeBucket = clanSizePeak.bucket)}
											onblur={() => (activeClanSizeBucket = null)}
										>
											{clanSizePeak.bucket}
										</button>
										players ({formatNumber(clanSizePeak.count)} sessions).
									</p>
								{/if}
								{#if clanSizeSummary}
									<p>Average roster size is about {formatRatio(clanSizeSummary.avgSize)}.</p>
									<p>
										{formatPercent((clanSizeSummary.largeCount / clanSizeSummary.total) * 100)} of
										sessions have 5+ clan members.
									</p>
								{/if}
							{/if}
						</GraphHelpSheet>
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render clanSizeChart()}
			</Card.Content>
		{/snippet}
		{#snippet clanSizePreview()}
			{@render clanSizeSection({ showHelp: false })}
		{/snippet}
		{@render clanSizeSection({ showHelp: true })}
	</Card.Root>
