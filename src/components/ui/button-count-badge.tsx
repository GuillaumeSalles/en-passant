export function ButtonCountBadge(props: { count: number }) {
  return (
    <span
      aria-hidden="true"
      class="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-300 px-1 text-[10px] font-semibold leading-none text-sky-950 shadow-sm ring-2 ring-background"
      data-review-count={props.count}
    >
      {props.count > 99 ? "99+" : props.count}
    </span>
  );
}
