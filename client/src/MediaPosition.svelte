<script lang="ts">
  export let pos: number
  export let duration: number
  export let sendMessage: (data: object) => void

  let indicatorPosition = 0
  $: indicatorPosition = pos / duration

  let progressBarWidth: number

  function progressClick({ offsetX }: MouseEvent) {
    const newIndicatorPosition = offsetX / progressBarWidth
    const newPos = duration * newIndicatorPosition
    sendMessage({ type: 'seek', value: newPos })
  }
</script>

<style lang="scss">
  section {
    width: 100%;
    align-items: center;
    justify-content: center;
    height: 2rem;
    padding: 0rem 1rem;

    .progress-container {
      flex-grow: 1;
      position: relative;
      height: 100%;
      justify-content: center;
      align-items: center;
      $indicator-radius: 12px;

      .indicator-container {
        position: absolute;
        height: $indicator-radius * 2;
        width: $indicator-radius * 2;
        top: calc(50% - $indicator-radius);

        .indicator {
          position: relative;
          left: -50%;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
          background-color: black;
          border-radius: 50%;
        }

        .indicator-inner {
          display: inline-block;
          $inner-radius: $indicator-radius - 3px;
          height: $inner-radius * 2;
          width: $inner-radius * 2;
          background-color: white;
          border-radius: 50%;

          &:hover {
            background-color: #ddd;
          }
        }
      }

      progress {
        flex-grow: 1;
      }
    }
  }
</style>

<section>
  <div class="progress-container" on:click={progressClick} bind:clientWidth={progressBarWidth}>
    <div class="indicator-container" style="left: {indicatorPosition * 100}%">
      <div class="indicator">
        <div class="indicator-inner"></div>
      </div>
    </div>
    <progress value={pos} max={duration} />
  </div>
</section>
