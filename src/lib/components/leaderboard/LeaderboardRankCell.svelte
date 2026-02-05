<script lang="ts">
	let {
		rank,
		rankImage = null,
		rankAccent = null
	} = $props<{
		rank: number;
		rankImage?: string | null;
		rankAccent?: string | null;
	}>();
</script>

{#if rank <= 3 && rankImage}
	<span
		class="inline-flex items-center justify-center gap-2 text-[rgb(var(--rank-accent)/1)]"
		style={rankAccent ? `--rank-accent: ${rankAccent}` : ''}
	>
		<img
			src={rankImage}
			alt={`Rank ${rank}`}
			class="h-4 w-4 origin-center scale-[1.35] object-cover opacity-100"
			loading="lazy"
		/>
		<span>{rank}</span>
	</span>
{:else}
	{rank}
{/if}
