<script lang="ts">
  import type { DenseOverlapDisplay } from '@application/calendar/denseOverlapPresentation';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';

  interface Props {
    display: DenseOverlapDisplay;
    onOpen: () => void;
  }
  let { display, onOpen }: Props = $props();
</script>

<button
  type="button"
  class="dense-overlap"
  onclick={onOpen}
  aria-label={`View ${display.segments.length} events in busy period, ${formatCalendarMinute(display.startMinute)}–${formatCalendarMinute(display.endMinute)}`}
>
  <strong>{display.segments.length} events · Details</strong>
</button>

<style>
  .dense-overlap {
    display: block;
    width: 100%;
    height: 100%;
    padding: 3px 7px;
    border: 1px solid #1d4ed8;
    border-radius: 5px;
    background: #1d4ed8;
    color: white;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    font-size: 0.65rem;
    line-height: 1.4;
    box-shadow: 0 1px 3px #0f172a30;
  }
  .dense-overlap:hover { background: #1e40af; }
  .dense-overlap:focus-visible { outline: 3px solid #0f172a; outline-offset: 2px; }
</style>
