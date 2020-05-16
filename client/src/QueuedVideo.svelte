<script>
  export let watching
  export let queued
  export let queueSelections

  const onClickQueueEntry = queueEntry => {
    if (queueSelections.has(queued.video)) {
      queueSelections.delete(queued.video)
    } else {
      queueSelections.add(queued.video)
    }
    // sigh svelte
    queueSelections = queueSelections
  }
</script>

<style type="text/scss">
  li {
    .duration {
      margin-left: auto;
      white-space: nowrap;
      padding-left: 0.7em;
    }

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
  class:selected={queueSelections.has(queued.video)}
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
