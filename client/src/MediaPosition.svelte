<script>
  export let pos
  export let duration
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
