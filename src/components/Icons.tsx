import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";

type IconProps = Omit<
  JSX.SvgSVGAttributes<SVGSVGElement>,
  "color" | "height" | "stroke-width" | "width"
> & {
  color?: string;
  size?: number | string;
  strokeWidth?: number | string;
};

type IconBaseProps = IconProps & {
  children: JSX.Element;
  name: string;
};

function IconBase(props: IconBaseProps): JSX.Element {
  const svgProps = omit(props, "children", "color", "name", "size", "strokeWidth");
  const size = () => props.size ?? 24;
  const strokeWidth = () => props.strokeWidth ?? 2;

  return (
    <svg
      {...svgProps}
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.color ?? "currentColor"}
      stroke-width={strokeWidth()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`lucide lucide-${props.name}${props.class ? ` ${props.class}` : ""}`}
    >
      {props.children}
    </svg>
  );
}

export function ArrowLeft(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="arrow-left">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </IconBase>
  );
}

export function ArrowLeftToLine(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="arrow-left-to-line">
      <path d="M3 19V5" />
      <path d="m13 6-6 6 6 6" />
      <path d="M7 12h14" />
    </IconBase>
  );
}

export function ArrowRight(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="arrow-right">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </IconBase>
  );
}

export function ArrowRightToLine(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="arrow-right-to-line">
      <path d="M17 12H3" />
      <path d="m11 18 6-6-6-6" />
      <path d="M21 5v14" />
    </IconBase>
  );
}

export function Book(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="book">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </IconBase>
  );
}

export function Brain(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="brain">
      <path d="M12 18V5" />
      <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
      <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
      <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
      <path d="M18 18a4 4 0 0 0 2-7.464" />
      <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
      <path d="M6 18a4 4 0 0 1-2-7.464" />
      <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
    </IconBase>
  );
}

export function Check(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="check">
      <path d="M20 6 9 17l-5-5" />
    </IconBase>
  );
}

export function ChevronDown(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="chevron-down">
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function ChessPawn(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="chess-pawn">
      <path d="M12 4.8c-1.18 0-2.13.95-2.13 2.13 0 .47.15.91.42 1.27-1.04.6-1.75 1.71-1.75 3 0 1.08.5 2.05 1.29 2.68-1.6.57-3.95 2.96-3.95 7.18h12.27c0-4.22-2.35-6.61-3.95-7.18.78-.63 1.29-1.6 1.29-2.68 0-1.29-.71-2.4-1.75-3 .26-.36.42-.8.42-1.27 0-1.18-.95-2.13-2.13-2.13z" />
    </IconBase>
  );
}

export function Ellipsis(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="ellipsis">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </IconBase>
  );
}

export function Info(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="info">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </IconBase>
  );
}

export function LogIn(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="log-in">
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </IconBase>
  );
}

export function LogOut(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="log-out">
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </IconBase>
  );
}

export function Menu(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="menu">
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <path d="M4 6h16" />
    </IconBase>
  );
}

export function Moon(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="moon">
      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </IconBase>
  );
}

export function Plus(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="plus">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </IconBase>
  );
}

export function Pencil(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="pencil">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </IconBase>
  );
}

export function Repeat2(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="repeat-2">
      <path d="m2 9 3-3 3 3" />
      <path d="M13 18H7a2 2 0 0 1-2-2V6" />
      <path d="m22 15-3 3-3-3" />
      <path d="M11 6h6a2 2 0 0 1 2 2v10" />
    </IconBase>
  );
}

export function Settings(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="settings">
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function Sun(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="sun">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </IconBase>
  );
}

export function Trash(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="trash">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </IconBase>
  );
}

export function Upload(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="upload">
      <path d="M12 3v12" />
      <path d="m17 8-5-5-5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </IconBase>
  );
}

export function X(props: IconProps): JSX.Element {
  return (
    <IconBase {...props} name="x">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}
