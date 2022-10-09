<script>
  import FaSpinner from 'svelte-icons/fa/FaSpinner.svelte'
</script>

<style lang="scss">
  .loading {
    color: #888;
    height: 4.5rem;
    width: 100%;
    justify-content: center;
    align-items: center;
    overflow: hidden;

    div {
      $width: 3.5rem;
      width: $width;
      height: $width;
      animation-name: spin;
      animation-duration: 4000ms;
      animation-iteration-count: infinite;
      animation-timing-function: linear;
      flex-basis: auto;
    }
  }
</style>

<div class="loading">
  <div>
    <FaSpinner />
  </div>
</div>
