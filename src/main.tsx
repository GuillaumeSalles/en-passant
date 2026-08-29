import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "./app/globals.css";
import { render } from "@solidjs/web";
import App from "./App";
import { applyDefaultTheme } from "@/app/theme";
import { registerServiceWorker } from "@/lib/serviceWorker";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing root element");
}

applyDefaultTheme(document.documentElement);
render(() => <App />, root);
registerServiceWorker();
