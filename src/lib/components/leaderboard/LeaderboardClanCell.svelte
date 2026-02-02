<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	let {
		tag,
		isTop = false,
		rankAccent = null
	} = $props<{
		tag: string;
		isTop?: boolean;
		rankAccent?: string | null;
	}>();
</script>

<Badge
	variant="outline"
	class={isTop ? 'border-[rgb(var(--rank-accent)/0.45)] text-[rgb(var(--rank-accent)/1)]' : ''}
	style={isTop && rankAccent ? `--rank-accent: ${rankAccent}` : ''}
>
	{tag}
</Badge>
