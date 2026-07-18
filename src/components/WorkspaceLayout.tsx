import type { JSX } from "@solidjs/web";
import { children } from "solid-js";
import { PageHeader } from "./PageHeader";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";

export function WorkspaceLayout(props: {
  title: JSX.Element;
  chessboard: JSX.Element;
  evalBar: JSX.Element;
  panelChildren: JSX.Element;
}) {
  const title = children(() => props.title);
  const chessboard = children(() => props.chessboard);
  const evalBar = children(() => props.evalBar);
  const panelChildren = children(() => props.panelChildren);

  return (
    <div class="flex h-full min-w-0 flex-1 flex-col">
      <PageHeader title={title()} reserveRightSlot />
      <div class="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden xl:flex-row xl:overflow-hidden">
        <div class="relative flex min-w-0 flex-none items-center justify-center xl:flex-1">
          <div class="flex max-h-full max-w-full flex-col-reverse items-stretch xl:flex-row xl:p-4">
            {chessboard()}
            {evalBar()}
          </div>
        </div>
        <HorizontalDashedDivider class="xl:hidden" animation="none" />
        <div class="relative flex min-h-0 w-full min-w-0 flex-none flex-col xl:w-[400px] xl:min-w-[400px] xl:max-w-[400px] xl:flex-1 xl:flex-shrink-0">
          {panelChildren()}
        </div>
      </div>
    </div>
  );
}
