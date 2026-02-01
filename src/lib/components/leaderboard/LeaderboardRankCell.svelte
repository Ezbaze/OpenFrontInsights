<script lang="ts">
	let { rank, rankImage = null, rankAccent = null } = $props<{
		rank: number;
		rankImage?: string | null;
		rankAccent?: string | null;
	}>();
</script>

{#if rank <= 3 && rankImage}
	<span
		class="rank-number inline-flex items-center justify-center gap-2"
		style={rankAccent ? `--rank-accent: ${rankAccent}` : ""}
	>
		<img
			src={rankImage}
			alt={`Rank ${rank}`}
			class="rank-icon h-4 w-4"
			loading="lazy"
		/>
		<span>{rank}</span>
	</span>
{:else}
	{rank}
{/if}
