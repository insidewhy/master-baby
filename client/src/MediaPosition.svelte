<script lang="ts">
  export let pos: number
  export let duration: number
</script>

<style lang="scss">
  section {
    width: 100%;
    align-items: center;
    justify-content: center;
    height: 2rem;
    padding: 0rem 1rem;
  }

  progress {
    flex-grow: 1;
  }
</style>

<section>
  <progress value={pos} max={duration} />
</section>
