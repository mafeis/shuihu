const { app, BrowserWindow } = require("electron");

const sandbox = process.env.IME_PROBE_SANDBOX !== "0";
const source = process.env.IME_PROBE_SOURCE || "data";
const page = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    />
    <title>输入法诊断</title>
    <style>
      body { margin: 40px; background: #111; color: #eee; font: 18px sans-serif; }
      label, input, textarea, button { display: block; margin: 12px 0; font: inherit; }
      input, textarea { width: 520px; padding: 10px; color: #000; background: #fff; }
      textarea { height: 80px; }
      section { padding: 18px; border: 1px solid #555; }
    </style>
  </head>
  <body>
    <h1>输入法诊断</h1>
    <p id="status">sandbox=${sandbox} source=${source}</p>
    <section>
      <label for="plain">焦点输入框（不监听事件）</label>
      <input id="plain" autofocus />
      <label for="observed">焦点输入框（只记录事件）</label>
      <input id="observed" />
      <textarea id="textarea" placeholder="多行输入框"></textarea>
      <button id="focus-button" type="button">恢复第一个输入框</button>
      <pre id="events"></pre>
    </section>
    <script>
      const observed = document.querySelector("#observed");
      const events = document.querySelector("#events");
      const log = (event) => {
        const key = event.key ?? "";
        const composing = event.isComposing ?? "";
        events.textContent += event.type + " key=" + key + " composing=" + composing + " value=" + observed.value + "\\n";
      };
      for (const type of ["focus", "blur", "keydown", "keyup", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend"]) {
        observed.addEventListener(type, log);
      }
      document.querySelector("#focus-button").addEventListener("click", () => {
        document.querySelector("#plain").focus();
      });
      document.querySelector("#plain").focus();
    </script>
  </body>
</html>`;

app.commandLine.appendSwitch("lang", "zh-CN");

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 760,
    height: 760,
    show: true,
    title: `输入法诊断 · sandbox=${sandbox} · ${source}`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox,
    },
  });
  if (source === "file") {
    const path = require("node:path");
    await window.loadFile(path.join(__dirname, "ime_probe.html"));
  } else {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  }
  window.show();
  window.focus();
  window.webContents.focus();
  window.webContents.on("before-input-event", (_event, input) => {
    console.log(JSON.stringify({
      type: input.type,
      key: input.key,
      isAutoRepeat: input.isAutoRepeat,
      isComposing: input.isComposing,
    }));
  });
  console.log(JSON.stringify({
    ready: true,
    sandbox,
    source,
    title: window.getTitle(),
  }));
});

app.on("window-all-closed", () => app.quit());
