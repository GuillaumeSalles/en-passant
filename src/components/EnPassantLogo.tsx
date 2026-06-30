import { createUniqueId } from "solid-js";

export function EnPassantLogo(props: { class?: string }) {
  const boardClipId = createUniqueId();

  return (
    <svg
      class={props.class}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={boardClipId}>
          <rect x="3" y="3" width="18" height="18" />
        </clipPath>
      </defs>
      <g clip-path={`url(#${boardClipId})`}>
        <rect x="3" y="3" width="9" height="9" fill="white" />
        <rect x="12" y="3" width="9" height="9" fill="hsl(var(--secondary))" />
        <rect x="3" y="12" width="9" height="9" fill="hsl(var(--secondary))" />
        <rect x="12" y="12" width="9" height="9" fill="white" />
      </g>
    </svg>
  );
}
