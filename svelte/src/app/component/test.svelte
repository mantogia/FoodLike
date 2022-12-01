
<script>
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";

const progress = tweened(0, {
  duration: 4000,
  easing: cubicOut,
});

</script>

 <h1>Click a button and watch the SvelteKit transition magic happen 🌟</h1>

<progress value={$progress} />
<div class="buttons">
 <button on:click={() => progress.set(0)}> 0% </button>
 <button on:click={() => progress.set(0.25)}> 25% </button>
 <button on:click={() => progress.set(0.5)}> 50% </button>
 <button on:click={() => progress.set(0.75)}> 75% </button>    
 <button on:click={() => progress.set(1)}> 100% </button>
</div>