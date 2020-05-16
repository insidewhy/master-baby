<script>
  export let watching
  export let queued
</script>

<style type="text/scss">
  .duration {
    margin-left: auto;
    white-space: nowrap;
    padding-left: 0.7em;
  }
</style>

<li class:watching={watching}>
  {queued.displayTitle}
  {#if queued.duration}
    <span class="duration">
      {#if queued.position}
        {queued.position} /
      {/if}

      {queued.duration}
    </span>
  {/if}
</li>
