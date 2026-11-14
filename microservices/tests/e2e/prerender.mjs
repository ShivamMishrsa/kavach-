// The public pages are real files with their text in them (what a search engine or a link preview
// reads, with no script run), and the app then takes over without doubling anything.
// Usage: node prerender.mjs <outDir>   (normally started by run.ps1; add -Only prerender to run just this)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect } from "./cdp.mjs";

const base = "http://localhost:4173";
const en = JSON.parse(
  readFileSync(
    new URL("../../frontend/src/i18n/locales/en.json", import.meta.url),
    "utf8",
  ),
);
// path, and the heading the page has
const pages = [
  ["/", en.app.tagline],
  ["/help", en.help.title],
  ["/emergency", en.sentMoney.title],
  ["/privacy", en.site.privacy],
  ["/terms", en.site.terms],
  ["/limitations", en.site.limitations],
];

const { send, ev, waitFor, go, sleep, check, finish } = await connect({
  out: process.argv[2],
  base,
  prefix: "prerender",
});

const count = (html, tag) =>
  (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
const sent = {};

// ---------- what is sent, before any script runs ----------
for (const [path, heading] of pages) {
  const response = await fetch(base + path);
  const html = (sent[path] = await response.text());
  const policy = response.headers.get("content-security-policy") ?? "";
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const hash = script
    ? `'sha256-${createHash("sha256").update(script).digest("base64")}'`
    : "";

  check(
    `${path}: sent as a page of its own`,
    response.status === 200 &&
      html.includes(`<html lang="en" data-prerendered="${path}">`),
  );
  check(
    `${path}: the heading "${heading}" is in what is sent`,
    html.includes(`>${heading}</h1>`),
  );
  check(
    `${path}: one h1, and the title in the head`,
    count(html, "h1") === 1 &&
      html.includes(`<title>${heading} · ${en.app.name}</title>`),
  );
  check(
    `${path}: its one inline script is allowed by hash, and no other inline script is`,
    count(html, "script") === 2 && // that one, and the app's module script
      policy
        .split(";")
        .some((rule) => rule.trim() === `script-src 'self' ${hash}`) &&
      !policy
        .split(";")
        .some((rule) => rule.includes("script-src") && rule.includes("unsafe")),
  );
}

// ---------- the app takes over without doubling the page ----------
// An earlier suite may have left a signed-in guest behind, who is sent from / to the app.
await go("/design");
await ev(`localStorage.clear()`);
for (const [path] of pages) {
  await go(path);
  await waitFor(`document.documentElement.dataset.prerendered === undefined`); // the app has started
  await sleep(300);
  const now = await ev(`({
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    header: document.querySelectorAll('header').length,
    marker: document.documentElement.dataset.prerendered ?? null,
    hidden: document.documentElement.hasAttribute('data-skip-prerender'),
  })`);
  check(
    `${path}: after the app starts nothing is doubled, hidden or left over`,
    now.main === count(sent[path], "main") &&
      now.h1 === count(sent[path], "h1") &&
      now.header === count(sent[path], "header") &&
      now.marker === null &&
      !now.hidden,
  );
}

// ---------- who is shown the written-out page ----------
// The app's own script is blocked here, so what is left is only what was sent plus the small inline
// script: the page must be visible to a first-time visitor and hidden from everybody else.
await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*/assets/index-*.js"] });
const shownTo = async (path, saved = {}) => {
  await go("/design"); // any page of this site, to be able to set what the browser has saved
  await ev(
    `localStorage.clear(); ${Object.entries(saved)
      .map(
        ([key, value]) =>
          `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`,
      )
      .join("")}`,
  );
  await go(path);
  return ev(`(() => {
    const root = document.getElementById('root');
    return root.childElementCount > 0 && getComputedStyle(root).display !== 'none';
  })()`);
};
check(
  "A first-time visitor is shown the privacy policy before any script runs",
  await shownTo("/privacy"),
);
check(
  "... and so is someone whose saved choices are the default",
  await shownTo("/privacy", {
    "kavach.lang": "en",
    "kavach.prefs": '{"theme":"light","text":"normal"}',
  }),
);
check(
  "A saved Hindi choice: the English page is not shown",
  !(await shownTo("/privacy", { "kavach.lang": "hi" })),
);
check(
  "A saved dark theme: the light page is not shown",
  !(await shownTo("/privacy", { "kavach.prefs": '{"theme":"dark"}' })),
);
check(
  "Larger text: the normal-size page is not shown",
  !(await shownTo("/privacy", { "kavach.prefs": '{"text":"large"}' })),
);
check(
  "An address that was not written out is not shown the landing page",
  !(await shownTo("/app/history")),
);
await send("Network.setBlockedURLs", { urls: [] });
await ev(`localStorage.clear()`);

// ---------- and the app does start for them, in their language ----------
await ev(`localStorage.setItem('kavach.lang', 'hi')`);
await go("/privacy");
check(
  "A saved Hindi choice: the app starts and the page is in Hindi",
  await waitFor(
    `document.documentElement.lang === 'hi' && !!document.querySelector('h1') && !document.getElementById('root').hasAttribute('hidden')`,
  ),
);
await ev(`localStorage.clear()`);

await finish();
