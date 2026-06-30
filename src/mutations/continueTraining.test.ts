import { describe, expect, test } from "vitest";
import { continueTraining } from "./continueTraining";
import { createMutationContext } from "@/tests/mocks";

describe("continueTraining", () => {
  test("advances to the next variation and resets drill state", () => {
    const context = createMutationContext({
      selectedMoveId: 12,
      preselectedVariation: 15,
      animation: {
        id: 1,
        movements: [{ piece: "P", from: "e2", to: "e4" }],
        captures: [],
        promotion: null,
      },
      training: {
        status: "success",
        variationIndex: 0,
        variation: contextlessVariation(),
        session: null,
      },
    });

    continueTraining(context.state, context.route, 3);

    expect(context.state.training.status).toBe("in-progress");
    expect(context.state.training.variationIndex).toBe(1);
    expect(context.state.selectedMoveId).toBeNull();
    expect(context.state.preselectedVariation).toBeNull();
    expect(context.state.animation).toBeNull();
  });

  test("wraps from the last variation back to the first", () => {
    const context = createMutationContext({
      training: {
        status: "success",
        variationIndex: 2,
        variation: contextlessVariation(),
        session: null,
      },
    });

    continueTraining(context.state, context.route, 3);

    expect(context.state.training.variationIndex).toBe(0);
  });

  test("does nothing when there are no variations", () => {
    const context = createMutationContext({
      training: {
        status: "success",
        variationIndex: 2,
        variation: contextlessVariation(),
        session: null,
      },
    });

    continueTraining(context.state, context.route, 0);

    expect(context.state.training.status).toBe("success");
    expect(context.state.training.variationIndex).toBe(2);
  });
});

function contextlessVariation() {
  return {
    rootMoveIds: [],
    moves: {},
    moveIdCounter: 1,
  };
}
