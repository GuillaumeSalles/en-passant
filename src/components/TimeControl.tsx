export function formatTimeControl(value: string): string {
  const trimmedValue = value.trim();
  const match = /^(\d+)[+-](\d+)$/.exec(trimmedValue);
  if (match === null) return trimmedValue;

  const initialSeconds = Number(match[1]);
  const incrementSeconds = Number(match[2]);
  const minutes = Math.floor(initialSeconds / 60);
  const remainingSeconds = initialSeconds % 60;
  const initialTime =
    remainingSeconds === 0
      ? String(minutes)
      : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;

  return `${initialTime}+${incrementSeconds}`;
}

export function TimeControl(props: { value: string; class?: string }) {
  return <span class={props.class}>{formatTimeControl(props.value)}</span>;
}
