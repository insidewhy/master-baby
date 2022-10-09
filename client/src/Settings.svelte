<script>
  export let sortOrder
</script>
<style lang="scss">
  section {
    width: 100%;
    justify-content: center;
    align-items: center;
    padding: 0.5rem;
  }

  label {
    align-items: center;
  }

  select {
    margin-left: 1rem;
    font-size: 0.8rem;
    padding: 0.5rem 0.3rem;
  }
</style>
<section>
  <label>
    Sort order:
    <select bind:value={sortOrder}>
      <option value="location">Media location</option>
      <option value="mtime">Last Modified</option>
    </select>
  </label>
</section>
