import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createChessPosition, isMoveLegal } from "@/lib/chess";
import type { Orientation } from "@/lib/AppState";
import { Button, Dialog, styles } from "./ui";
import { SvgXml } from "react-native-svg";
import artwork from "./pieceArtwork.json";

const Square = memo(function Square({
  square,
  piece,
  light,
  selected,
  legal,
  marked,
  onPress,
  onLongPress,
}: {
  square: string;
  piece: string;
  light: boolean;
  selected: boolean;
  legal: boolean;
  marked: boolean;
  onPress(square: string): void;
  onLongPress(square: string): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${square}${piece === "" ? " empty" : ` ${piece}`}`}
      testID={`square-${square}`}
      onPress={() => onPress(square)}
      onLongPress={() => onLongPress(square)}
      style={[
        boardStyles.square,
        {
          backgroundColor: selected
            ? "#b4d284"
            : marked
              ? "#d88c78"
              : light
                ? "#d6dfe5"
                : "#859fb2",
        },
      ]}
    >
      <Text style={boardStyles.coordinate}>{square}</Text>
      {piece !== "" && (
        <SvgXml
          xml={
            artwork[
              (piece.startsWith("w")
                ? piece.slice(1).toUpperCase()
                : piece.slice(1)) as keyof typeof artwork
            ]
          }
          width="94%"
          height="94%"
          pointerEvents="none"
        />
      )}
      {legal && <View style={boardStyles.dot} />}
    </Pressable>
  );
});
export function Board({
  fen,
  orientation,
  onMove,
  onMark,
  marked = [],
  disabled = false,
}: {
  fen: string;
  orientation: Orientation;
  onMove(from: string, to: string, promotion: string): void;
  onMark(square: string): void;
  marked?: string[];
  disabled?: boolean;
}) {
  const position = useMemo(() => createChessPosition(fen), [fen]);
  const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null);
  const selected = selection?.fen === fen ? selection.square : null;
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const squares = useMemo(
    () => Array.from({ length: 64 }, (_, index) => (orientation === "white" ? index : 63 - index)),
    [orientation],
  );
  const press = useCallback(
    (square: string) => {
      if (disabled) return;
      if (
        selected !== null &&
        isMoveLegal(position, { from: selected, to: square, promotion: "q" })
      ) {
        const index = (8 - Number(selected[1])) * 8 + selected.charCodeAt(0) - 97;
        if (position.board[index]?.kind === "p" && (square.endsWith("8") || square.endsWith("1"))) {
          setPromotion({ from: selected, to: square });
          return;
        }
        onMove(selected, square, "q");
        setSelection(null);
        return;
      }
      const index = (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 97;
      setSelection(position.board[index]?.color === position.turn ? { fen, square } : null);
    },
    [disabled, selected, position, onMove, fen],
  );
  return (
    <View style={{ width: "100%", maxWidth: 580, alignSelf: "center" }}>
      <View style={boardStyles.board}>
        {squares.map((index) => {
          const square = `${String.fromCharCode(97 + (index % 8))}${8 - Math.floor(index / 8)}`;
          const piece = position.board[index];
          return (
            <Square
              key={square}
              square={square}
              piece={piece === null || piece === undefined ? "" : `${piece.color}${piece.kind}`}
              light={(Math.floor(index / 8) + (index % 8)) % 2 === 0}
              selected={square === selected}
              legal={
                selected !== null &&
                isMoveLegal(position, { from: selected, to: square, promotion: "q" })
              }
              marked={marked.includes(square)}
              onPress={press}
              onLongPress={onMark}
            />
          );
        })}
      </View>
      {promotion !== null && (
        <Dialog title="Promote pawn" onClose={() => setPromotion(null)}>
          <View style={styles.row}>
            {["q", "r", "b", "n"].map((piece) => (
              <Button
                key={piece}
                label={`Promote to ${piece}`}
                onPress={() => {
                  onMove(promotion.from, promotion.to, piece);
                  setPromotion(null);
                  setSelection(null);
                }}
              >
                {{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[piece]}
              </Button>
            ))}
          </View>
        </Dialog>
      )}
    </View>
  );
}
const boardStyles = StyleSheet.create({
  board: {
    width: "100%",
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
    borderRadius: 4,
  },
  square: { width: "12.5%", height: "12.5%", justifyContent: "center", alignItems: "center" },
  piece: { fontSize: 37, color: "#101018" },
  coordinate: { position: "absolute", left: 3, top: 1, fontSize: 8, color: "#263847" },
  dot: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#34482b66",
  },
});
