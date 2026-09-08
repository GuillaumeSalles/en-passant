import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { WebView } from "react-native-webview";
import { engineDocument } from "./engineDocument";
import source from "./stockfishSource.json";

export type EngineHostProps = {
  register(send: (command: string) => void): void;
  receive(message: string): void;
  fail(message: string): void;
};
export function EngineHost({ register, receive, fail }: EngineHostProps) {
  const ref = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Asset.loadAsync(require("../../../public/stockfish-18-lite-single.wasm"))
      .then(async ([asset]) => {
        if (asset?.localUri == null)
          throw new Error("The bundled chess engine could not be loaded.");
        const wasm = await new File(asset.localUri).base64();
        if (active) setHtml(engineDocument(source, wasm));
      })
      .catch((error: unknown) => {
        if (active) fail(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [fail]);
  if (html === null) return null;
  return (
    <View pointerEvents="none" style={{ width: 1, height: 1, position: "absolute", opacity: 0 }}>
      <WebView
        ref={ref}
        source={{ html }}
        originWhitelist={["about:blank"]}
        onShouldStartLoadWithRequest={(request) => request.url === "about:blank"}
        onError={(event) => fail(event.nativeEvent.description)}
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          if (message === "native-engine-ready")
            register((command) =>
              ref.current?.injectJavaScript(
                `window.nativeCommand(${JSON.stringify(command)});true;`,
              ),
            );
          else if (message.startsWith("native-engine-error:")) fail(message.slice(20));
          else receive(message);
        }}
      />
    </View>
  );
}
