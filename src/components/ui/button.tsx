import { omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { A } from "@solidjs/router";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-emil-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        icon: "h-8 w-8",
        "sm-icon": "h-6 w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type ButtonElementProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantProps & {
    href?: undefined;
  };
export type ButtonLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonVariantProps & {
    href: string;
  };
export type ButtonProps = ButtonElementProps | ButtonLinkProps;

function buttonClass(
  props: ButtonVariantProps & { class?: JSX.HTMLAttributes<HTMLElement>["class"] },
) {
  return cn(
    buttonVariants({
      variant: props.variant,
      size: props.size,
      className: props.class as string,
    }),
  );
}

function ButtonElement(props: { buttonProps: ButtonElementProps }) {
  const rest = omit(props.buttonProps, "class", "variant", "size", "href");
  return <button class={buttonClass(props.buttonProps)} {...rest} />;
}

function ButtonLink(props: { linkProps: ButtonLinkProps }) {
  const rest = omit(props.linkProps, "class", "variant", "size");
  return <A class={buttonClass(props.linkProps)} {...rest} />;
}

function Button(props: ButtonProps) {
  return (
    <Show
      when={props.href !== undefined}
      fallback={<ButtonElement buttonProps={props as ButtonElementProps} />}
    >
      <ButtonLink linkProps={props as ButtonLinkProps} />
    </Show>
  );
}

export { Button, buttonVariants };
