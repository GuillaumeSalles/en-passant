export function engineDocument(source: string, wasmBase64: string): string {
  // The worker gets the existing bundled WASM from memory: no network, file
  // origin exceptions, or chess processing on React Native's UI/JS thread.
  const worker = `const bytes=Uint8Array.from(atob(${JSON.stringify(wasmBase64)}),c=>c.charCodeAt(0));
    self.fetch=async()=>new Response(bytes,{headers:{'Content-Type':'application/wasm'}});
    ${source}`;
  const script = `const url=URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:'text/javascript'}));
    const worker=new Worker(url+'#stockfish.wasm');
    const send=message=>window.ReactNativeWebView.postMessage(message);
    worker.onmessage=event=>send(String(event.data));
    worker.onerror=event=>send('native-engine-error:'+event.message);
    window.nativeCommand=command=>worker.postMessage(command);
    send('native-engine-ready');`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`;
}
