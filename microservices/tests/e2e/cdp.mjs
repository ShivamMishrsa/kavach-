// Small helpers to drive the headless browser started by run.ps1 over the DevTools protocol.
// No packages: Node 22+ has fetch and WebSocket built in.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Connects to the browser and returns the helpers the checks use.
 * @param {{ out: string, base: string, prefix: string, width?: number }} options
 *   out: folder for screenshots; base: address of the website; prefix: screenshot file prefix.
 */
export async function connect({ out, base, prefix, width = 390 }) {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find((target) => target.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));

  // A lost browser must show up as a failure. Without this the script can end silently.
  const abort = (reason) => {
    console.log(`FAIL  ${reason}`);
    process.exit(1);
  };
  ws.onclose = () => abort('the browser closed the connection');

  let lastId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++lastId;
      const timer = setTimeout(() => abort(`no answer from the browser to ${method}`), 30000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Runs JavaScript in the page. Returns { __error } when it throws. */
  async function ev(expression) {
    const response = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.result.exceptionDetails) {
      return { __error: JSON.stringify(response.result.exceptionDetails).slice(0, 300) };
    }
    return response.result.result.value;
  }

  async function waitFor(expression, ms = 9000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const value = await ev(expression);
      if (value && !value.__error) return value;
      await sleep(150);
    }
    return false;
  }

  const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
  const waitText = (text, ms) => waitFor(hasText(text), ms);

  const clickText = (selector, text, exact = false) =>
    ev(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = els.find((e) => {
        const t = e.textContent.trim().replace(/\\s+/g, ' ');
        return ${exact} ? t === ${JSON.stringify(text)} : t.includes(${JSON.stringify(text)});
      });
      if (!el) return false;
      el.click();
      return true;
    })()`);

  /** Types into a field the way a person would, so React notices the change. */
  const setValue = (selector, value) =>
    ev(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
        : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      return true;
    })()`);

  /** Puts a file from this computer into the page's file picker. */
  async function chooseFile(selector, filePath) {
    const { result: document } = await send('DOM.getDocument');
    const { result: found } = await send('DOM.querySelector', {
      nodeId: document.root.nodeId,
      selector,
    });
    await send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [filePath] });
  }

  const pathname = () => ev('location.pathname');

  async function go(route) {
    await send('Page.navigate', { url: base + route });
    await sleep(900);
  }

  async function shot(name) {
    const metrics = await send('Page.getLayoutMetrics');
    const size = metrics.result.cssContentSize;
    const image = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: Math.ceil(size.width),
        height: Math.min(Math.ceil(size.height), 2600),
        scale: 1,
      },
    });
    writeFileSync(path.join(out, `${prefix}-${name}.png`), Buffer.from(image.result.data, 'base64'));
  }

  const results = [];
  function check(name, pass, detail = '') {
    results.push(Boolean(pass));
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${!pass && detail ? `  -> ${detail}` : ''}`);
  }

  /** Prints the summary and ends the process: exit code 1 if any check failed. */
  function finish() {
    const failed = results.filter((pass) => !pass).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    ws.onclose = null;
    ws.close();
    process.exit(failed ? 1 : 0);
  }

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });

  return {
    send,
    sleep,
    ev,
    waitFor,
    hasText,
    waitText,
    clickText,
    setValue,
    chooseFile,
    pathname,
    go,
    shot,
    check,
    finish,
  };
}
