import { cleanup, render, screen, within } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { type TrainingLineListItem } from "./TrainingLineList";
import { TrainingQueueList, type TrainingQueueRepertoireGroup } from "./TrainingQueueList";

afterEach(cleanup);

function trainingLine(id: string, label: string): TrainingLineListItem {
  return {
    id,
    label,
    opening: undefined,
    intervalIndex: 1,
    isAlternative: false,
    isLearned: true,
    dueAt: 1_000,
    primaryHref: `/app/repertoire/chapter/${id}/train`,
    readHref: `/app/repertoire/chapter/${id}`,
    viewHref: `/chapter/${id}`,
    trainingStatus: "due",
  };
}

test("groups training lines under repertoire and chapter headings", () => {
  const groups: TrainingQueueRepertoireGroup[] = [
    {
      id: "black",
      name: "Black repertoire",
      chapters: [
        {
          id: "sicilian",
          name: "Sicilian",
          lines: [trainingLine("sicilian-line", "e4 c5")],
        },
      ],
    },
    {
      id: "white",
      name: "White repertoire",
      chapters: [
        {
          id: "open-games",
          name: "Open games",
          lines: [trainingLine("open-game-line", "e4 e5 Nf3")],
        },
        {
          id: "queens-pawn",
          name: "Queen's pawn",
          lines: [trainingLine("queens-pawn-line", "d4 d5 c4")],
        },
      ],
    },
  ];

  render(() => (
    <TrainingQueueList
      groups={groups}
      emptyMessage="No scheduled lines"
      loading={false}
      now={2_000}
    />
  ));

  const blackRepertoire = screen.getByRole("region", { name: "Black repertoire" });
  const whiteRepertoire = screen.getByRole("region", { name: "White repertoire" });
  expect(within(blackRepertoire).getByText("e4 c5")).not.toBeNull();
  expect(within(blackRepertoire).queryByText("d4 d5 c4")).toBeNull();

  const openGames = within(whiteRepertoire).getByRole("region", { name: "Open games" });
  const queensPawn = within(whiteRepertoire).getByRole("region", { name: "Queen's pawn" });
  expect(within(openGames).getByText("e4 e5 Nf3")).not.toBeNull();
  expect(within(queensPawn).getByText("d4 d5 c4")).not.toBeNull();
});

test("shows the shared loading and empty states without empty groups", () => {
  const { unmount } = render(() => (
    <TrainingQueueList groups={[]} emptyMessage="No scheduled lines" loading now={2_000} />
  ));

  expect(screen.getByRole("status", { name: "Loading training lines…" })).not.toBeNull();
  expect(screen.queryByRole("region")).toBeNull();

  unmount();
  render(() => (
    <TrainingQueueList groups={[]} emptyMessage="No scheduled lines" loading={false} now={2_000} />
  ));
  expect(screen.getByText("No scheduled lines")).not.toBeNull();
});
