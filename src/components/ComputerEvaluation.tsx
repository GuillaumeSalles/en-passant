import { Eval, EvalMove, AppState, Context, toggleEngine } from "@/lib/AppState";
import { createSignal, Show, For, createMemo } from "solid-js";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Settings } from "./Icons";
import { Slider } from "./ui/slider";
import { EvaluationLineSlot } from "./EvalLine";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";
import { useMutation } from "@/lib/useMutation";
import { useSelector } from "@/lib/useSelector";
import { StoreState } from "@/lib/createStore";

export function getEvaluationLineIndexes(numberOfLines: number): number[] {
  return Array.from({ length: numberOfLines }, (_, index) => index);
}

function toggleShowEvalBar(state: StoreState<AppState>) {
  state.set("engineSettings", {
    ...state.engineSettings,
    showEvalBar: !state.engineSettings.showEvalBar,
  });
}

function toggleShowBestMoveArrow(state: StoreState<AppState>) {
  state.set("engineSettings", {
    ...state.engineSettings,
    showBestMoveArrow: !state.engineSettings.showBestMoveArrow,
  });
}

function updateDepth(state: StoreState<AppState>, _ctx: Context, depth: number) {
  state.set("engineSettings", {
    ...state.engineSettings,
    depth,
  });
}

export function ComputerEvaluation(props: {
  evaluations: Eval[];
  onNumberOfLinesChange: (numberOfLines: number) => void;
  onAddEvalMoves: (moves: EvalMove[]) => void;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const isEnabled = useSelector((state) => state.engineSettings.isEnabled);
  const showEvalBar = useSelector((state) => state.engineSettings.showEvalBar);
  const depth = useSelector((state) => state.engineSettings.depth);
  const showBestMoveArrow = useSelector((state) => state.engineSettings.showBestMoveArrow);
  const numberOfLines = useSelector((state) => state.engineSettings.numberOfLines);
  const onToggleEngine = useMutation(toggleEngine);
  const onToggleShowEvalBar = useMutation(toggleShowEvalBar);
  const onToggleShowBestMoveArrow = useMutation(toggleShowBestMoveArrow);
  const onUpdateDepth = useMutation(updateDepth);
  const evaluationsByIndex = createMemo(
    () => new Map(props.evaluations.map((evaluation) => [evaluation.index, evaluation])),
  );
  const evaluationLineIndexes = createMemo<number[]>(() =>
    getEvaluationLineIndexes(numberOfLines()),
  );

  return (
    <div class="flex flex-col">
      <div class="flex items-center justify-between p-2">
        <div class="flex items-center space-x-2 pl-2">
          <Switch
            id="evaluation"
            checked={isEnabled()}
            onCheckedChange={onToggleEngine}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
          />
          <Label for="evaluation">Computer evaluation</Label>
        </div>
        <Button
          size="icon"
          variant="outline"
          aria-label="Evaluation settings"
          onClick={() => setIsSettingsOpen(!isSettingsOpen())}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          <Settings />
        </Button>
      </div>
      <Show when={isSettingsOpen()}>
        <div class="flex flex-col gap-2 px-4 pb-4 pt-2">
          <div class="flex items-center space-x-2">
            <Checkbox
              id="show-eval-bar"
              checked={showEvalBar()}
              disabled={false}
              onCheckedChange={onToggleShowEvalBar}
            />
            <Label for="show-eval-bar">Show evaluation bar</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox
              id="show-best-move-arrow"
              checked={showBestMoveArrow()}
              disabled={false}
              onCheckedChange={onToggleShowBestMoveArrow}
            />
            <Label for="show-best-move-arrow">Show best move arrow</Label>
          </div>
          <Label for="number-of-lines">Number of lines ({numberOfLines()} / 5)</Label>
          <Slider
            id="number-of-lines"
            min={1}
            max={5}
            value={[numberOfLines()]}
            onValueChange={(value) => {
              const numberOfLines = value[0];
              if (numberOfLines === undefined) return;

              props.onNumberOfLinesChange(numberOfLines);
            }}
          />
          <Label for="depth">Depth ({depth()})</Label>
          <Slider
            id="depth"
            min={1}
            max={30}
            value={[depth()]}
            onValueChange={(value) => {
              const depth = value[0];
              if (depth === undefined) return;

              onUpdateDepth(depth);
            }}
          />
        </div>
      </Show>
      <HorizontalDashedDivider direction="right-to-left" />
      <div class="flex flex-col">
        <Show when={isEnabled()}>
          <For each={evaluationLineIndexes()}>
            {(lineIndex) => (
              <EvaluationLineSlot
                evaluation={evaluationsByIndex().get(lineIndex)}
                onAddEvalMoves={props.onAddEvalMoves}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
