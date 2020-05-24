<script>
  export let watching
  export let queued
  export let queueSelections

  const onClickQueueEntry = queueEntry => {
    if (queueSelections.has(queued.location)) {
      queueSelections.delete(queued.location)
    } else {
      queueSelections.add(queued.location)
    }
    // sigh svelte
    queueSelections = queueSelections
  }
</script>

<style type="text/scss">
  li {
    &.selected {
      background-color: #ffdddd;

      &:hover {
        background-color: #ffbbbb;
      }
    }
  }
</style>

<li
  class:watching={watching}
  class:selected={queueSelections.has(queued.location)}
  on:click={onClickQueueEntry}
>
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
