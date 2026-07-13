import type { JSX } from "@solidjs/web";
import { createSignal, For, Show } from "solid-js";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ChessPawn,
  Ellipsis,
  Plus,
  Settings,
  Upload,
} from "@/components/Icons";
import { EvalBadge } from "@/components/EvalBadge";
import { Button } from "@/components/ui/button";
import { SignupNudgePanel } from "@/components/SignupNudge";
import { Checkbox } from "@/components/ui/checkbox";
import { CloseButton } from "@/components/ui/close-button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { InlineEditInput } from "@/components/ui/inline-edit-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { cn } from "@/lib/utils";

const buttonVariants = ["default", "outline", "ghost", "destructive"] as const;
const buttonSizes = ["default", "sm", "icon", "sm-icon"] as const;
const tokenSwatches = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
  "border",
] as const;

function noop(): void {}

function Section(props: { title: string; children: JSX.Element; class?: string | undefined }) {
  return (
    <section class={cn("grid gap-4 border-t border-border px-4 py-5", props.class)}>
      <h2 class="text-sm font-medium text-muted-foreground">{props.title}</h2>
      {props.children}
    </section>
  );
}

function SampleFrame(props: { children: JSX.Element; class?: string | undefined }) {
  return (
    <div class={cn("rounded-md border border-border bg-background p-3 shadow-sm", props.class)}>
      {props.children}
    </div>
  );
}

function RowLabel(props: { children: JSX.Element }) {
  return <div class="text-xs text-muted-foreground sm:w-24 sm:shrink-0">{props.children}</div>;
}

function VariantRow(props: { label: string; children: JSX.Element }) {
  return (
    <div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <RowLabel>{props.label}</RowLabel>
      <div class="flex min-w-0 flex-wrap items-center gap-2">{props.children}</div>
    </div>
  );
}

function DesignHeader() {
  return (
    <div class="flex h-[3.25rem] flex-shrink-0 items-center gap-2 px-4">
      <div class="min-w-0">
        <h1 class="truncate text-base font-medium">Design</h1>
      </div>
    </div>
  );
}

function ButtonSamples() {
  return (
    <div class="grid gap-3">
      <SampleFrame class="grid gap-3">
        <For each={buttonVariants}>
          {(variant) => (
            <VariantRow label={variant}>
              <Button variant={variant}>{variant}</Button>
              <Button variant={variant} disabled>
                disabled
              </Button>
              <Button variant={variant}>
                <ChessPawn />
                icon
              </Button>
            </VariantRow>
          )}
        </For>
      </SampleFrame>
      <SampleFrame class="flex flex-wrap items-center gap-2">
        <For each={buttonSizes}>
          {(size) => (
            <Button
              variant="outline"
              size={size}
              aria-label={size.includes("icon") ? size : undefined}
            >
              <Show when={size.includes("icon")} fallback={size}>
                <Settings />
              </Show>
            </Button>
          )}
        </For>
      </SampleFrame>
    </div>
  );
}

function FormSamples() {
  const [name, setName] = createSignal("En passant");
  const [notes, setNotes] = createSignal("A focused place for chess repertoire work.");
  const [checked, setChecked] = createSignal(true);
  const [enabled, setEnabled] = createSignal(true);
  const [depth, setDepth] = createSignal(18);
  const [inlineName, setInlineName] = createSignal("Chapter 1");
  const [committedName, setCommittedName] = createSignal("Chapter 1");

  function commitInlineName() {
    setCommittedName(inlineName().trim() || committedName());
  }

  function cancelInlineName() {
    setInlineName(committedName());
  }

  return (
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
      <SampleFrame class="grid gap-3">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input value={name()} onInput={(event) => setName(event.currentTarget.value)} />
        </Field>
        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea value={notes()} onInput={(event) => setNotes(event.currentTarget.value)} />
        </Field>
        <Field>
          <FieldLabel>Error</FieldLabel>
          <Input value="invalid@example" aria-invalid="true" />
          <FieldError>Use a complete email address.</FieldError>
        </Field>
      </SampleFrame>
      <SampleFrame class="grid content-start gap-4">
        <div class="flex items-center gap-2">
          <Checkbox id="design-checkbox" checked={checked()} onCheckedChange={setChecked} />
          <Label for="design-checkbox">Save locally</Label>
        </div>
        <div class="flex items-center gap-2">
          <Switch id="design-switch" checked={enabled()} onCheckedChange={setEnabled} />
          <Label for="design-switch">Computer evaluation</Label>
        </div>
        <div class="grid gap-2">
          <Label for="design-depth">Depth ({depth()})</Label>
          <Slider
            id="design-depth"
            min={1}
            max={30}
            value={[depth()]}
            onValueChange={(value) => setDepth(value[0] ?? depth())}
          />
        </div>
        <div class="rounded-md border border-border bg-muted/30 px-2 py-1 text-sm">
          <InlineEditInput
            aria-label="Inline name"
            autoFocus={false}
            value={inlineName()}
            onValueInput={setInlineName}
            onCommit={commitInlineName}
            onCancel={cancelInlineName}
          />
        </div>
      </SampleFrame>
    </div>
  );
}

function OverlaySamples() {
  return (
    <SampleFrame class="grid gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button variant="outline">Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Inspect details</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipIconButton aria-label="Upload" icon={<Upload />} tooltip="Upload PGN" />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline">
              Menu
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <Plus />
              Create chapter
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Check />
              Mark complete
            </DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ContextMenu>
          <ContextMenuTrigger>
            <Button variant="outline">Context menu</Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Comment before</ContextMenuItem>
            <ContextMenuItem>Comment after</ContextMenuItem>
            <ContextMenuItem>Promote variation</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <Dialog>
          <DialogTrigger>
            <Button>Dialog</Button>
          </DialogTrigger>
          <DialogContent class="max-w-sm">
            <DialogHeader>
              <DialogTitle>Load PGN</DialogTitle>
              <DialogDescription>Paste a PGN to load a game.</DialogDescription>
            </DialogHeader>
            <Textarea value={"1. e4 e5 2. Nf3 Nc6"} />
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Load</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div class="relative h-8 w-8 rounded-md border border-border">
          <CloseButton label="Close sample" class="absolute right-1 top-1" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2" data-testid="tooltip-boundary-samples">
        <div class="flex justify-start">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button aria-label="Left edge tooltip" variant="outline" size="sm">
                  Left edge
                </Button>
              </TooltipTrigger>
              <TooltipContent>Left edge tooltip remains within the viewport</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="flex justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button aria-label="Right edge tooltip" variant="outline" size="sm">
                  Right edge
                </Button>
              </TooltipTrigger>
              <TooltipContent>Right edge tooltip remains within the viewport</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div class="relative h-32 overflow-hidden rounded-md border border-border bg-muted/20">
        <SignupNudgePanel onDismiss={noop} onSignUp={noop} />
      </div>
    </SampleFrame>
  );
}

function DisplaySamples() {
  return (
    <SampleFrame class="grid gap-4">
      <div class="grid gap-2">
        <ProgressBar progress={0.68} />
        <div class="flex flex-wrap items-center gap-2">
          <EvalBadge score={{ type: "cp", value: 42 }} />
          <EvalBadge score={{ type: "cp", value: -118 }} />
          <EvalBadge score={{ type: "mate-in", value: 3 }} />
          <EvalBadge score={{ type: "stalemate" }} />
        </div>
      </div>
      <HorizontalDashedDivider animate={false} />
      <div class="flex h-16 items-stretch gap-3">
        <VerticalDashedDivider />
        <div class="grid content-center gap-1 text-sm">
          <div class="font-medium">Divider pair</div>
          <div class="text-xs text-muted-foreground">Horizontal and vertical rules</div>
        </div>
      </div>
    </SampleFrame>
  );
}

function TokenSamples() {
  return (
    <SampleFrame class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <For each={tokenSwatches}>
        {(token) => (
          <div class="grid gap-2">
            <div
              class={cn(
                "h-12 rounded-md border border-border",
                token === "background" && "bg-background",
                token === "foreground" && "bg-foreground",
                token === "card" && "bg-card",
                token === "popover" && "bg-popover",
                token === "primary" && "bg-primary",
                token === "secondary" && "bg-secondary",
                token === "muted" && "bg-muted",
                token === "accent" && "bg-accent",
                token === "destructive" && "bg-destructive",
                token === "border" && "bg-border",
              )}
            />
            <div class="text-xs text-muted-foreground">{token}</div>
          </div>
        )}
      </For>
    </SampleFrame>
  );
}

function IconSamples() {
  const icons = [
    { label: "ArrowLeft", icon: <ArrowLeft /> },
    { label: "ArrowRight", icon: <ArrowRight /> },
    { label: "Brain", icon: <Brain /> },
    { label: "ChessPawn", icon: <ChessPawn /> },
    { label: "Settings", icon: <Settings /> },
    { label: "Upload", icon: <Upload /> },
  ] as const;

  return (
    <SampleFrame class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <For each={icons}>
        {(item) => (
          <div class="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-2 text-sm">
            {item.icon}
            <span class="truncate">{item.label}</span>
          </div>
        )}
      </For>
    </SampleFrame>
  );
}

export function Design() {
  return (
    <main class="flex h-screen min-w-0 flex-col overflow-hidden bg-black text-foreground">
      <DesignHeader />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Section title="Buttons">
          <ButtonSamples />
        </Section>
        <Section title="Forms">
          <FormSamples />
        </Section>
        <Section title="Overlays">
          <OverlaySamples />
        </Section>
        <Section title="Display">
          <DisplaySamples />
        </Section>
        <Section title="Icons">
          <IconSamples />
        </Section>
        <Section title="Tokens" class="pb-8">
          <TokenSamples />
        </Section>
      </div>
    </main>
  );
}
