export function ProgressBar(props: { progress: number }) {
  return (
    <div class="relative h-0.5 w-full rounded-full">
      <div
        class="absolute left-0 top-0 h-full w-full origin-left rounded-full bg-blue-500 transition-transform duration-200 ease-emil-out motion-reduce:transition-none dark:bg-blue-500"
        style={{ transform: `scaleX(${props.progress})` }}
      />
    </div>
  );
}
