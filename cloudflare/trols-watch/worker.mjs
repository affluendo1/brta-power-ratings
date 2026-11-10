const REPO = "affluendo1/brta-power-ratings";
const GITHUB = `https://api.github.com/repos/${REPO}/actions`;
const MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/data/site/trols-watch.json`;
const RESULTS = "https://www.trols.org.au/brta/p_results.php";
const DAY_MS = 86_400_000;
const MAX_SECTIONS = 24;
const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Australia/Melbourne" });

export function targets(sections, now) {
  const today = Date.parse(localDate.format(now));
  const eligible = sections.filter(([, , , dates]) =>
    dates.some(date => {
      const age = today - Date.parse(date);
      return age >= 0 && age <= 4 * DAY_MS;
    }),
  );
  const batches = Math.ceil(eligible.length / MAX_SECTIONS);
  const start = batches > 1 ? Math.floor(now / 60_000) % batches * MAX_SECTIONS : 0;
  return eligible.slice(start, start + MAX_SECTIONS);
}

export async function fingerprint(html) {
  // This table follows the season/section form. The form and the page chrome
  // can change without any fixture having changed.
  const table = html.match(/<\/form>\s*(?:<(?:br|hr)\b[^>]*>\s*)*<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table || !/<th\b[^>]*>\s*Home Team/i.test(table)) throw new Error("TROLS result table missing");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(table));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function observe([section, daytime, season], request) {
  const response = await request(RESULTS, {
    method: "POST",
    body: new URLSearchParams({ which: "1", style: "", daytime, season, section }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`TROLS returned HTTP ${response.status} for ${section}`);
  return [`${season}/${section}`, await fingerprint(await response.text()), section];
}

export async function check(env, now, request = fetch) {
  if (!env.GITHUB_DISPATCH_TOKEN) throw new Error("GITHUB_DISPATCH_TOKEN is missing");
  const state = await env.WATCH_STATE.get("state", "json") ?? {};
  const github = (path, options = {}) => request(GITHUB + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "BRTA-TROLS-Watcher",
    },
    signal: AbortSignal.timeout(8000),
  });
  const digests = state.digests ?? {};
  if (state.pending) {
    const response = await github(`/runs/${state.pending.runId}`);
    if (!response.ok) throw new Error(`GitHub run status returned HTTP ${response.status}`);
    const run = await response.json();
    if (run.status !== "completed") return { waitingFor: state.pending.runId };
    if (run.conclusion === "success") Object.assign(digests, state.pending.digests);
    else console.warn("Targeted sync did not succeed", state.pending.runId, run.conclusion);
    await env.WATCH_STATE.put("state", JSON.stringify({ digests }));
    // Avoid a second write to the same KV key in the same tick.
    return { finished: state.pending.runId, conclusion: run.conclusion };
  }

  const manifest = await request(MANIFEST, { signal: AbortSignal.timeout(5000) });
  if (!manifest.ok) throw new Error(`Manifest returned HTTP ${manifest.status}`);
  const sections = targets(await manifest.json(), now);
  const changed = {};
  const codes = [];
  let checked = 0;
  for (let start = 0; start < sections.length; start += 3) {
    const batch = await Promise.allSettled(sections.slice(start, start + 3).map(entry => observe(entry, request)));
    for (const result of batch) {
      if (result.status === "rejected") {
        console.warn(result.reason.message);
        continue;
      }
      const [key, digest, code] = result.value;
      checked++;
      if (digests[key] !== digest) {
        changed[key] = digest;
        codes.push(code);
      }
    }
    if (batch.some(result => result.status === "rejected" && /HTTP 429/.test(result.reason.message))) break;
  }
  if (sections.length && !checked) throw new Error("No eligible TROLS pages could be read");
  if (!codes.length) return { checked, changed: [] };

  const response = await github("/workflows/fast-results.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { sections: codes.join(",") } }),
  });
  if (!response.ok) throw new Error(`GitHub dispatch returned HTTP ${response.status}`);
  const { workflow_run_id: runId } = await response.json();
  if (!Number.isSafeInteger(runId)) throw new Error("GitHub dispatch did not return a run ID");
  await env.WATCH_STATE.put("state", JSON.stringify({ digests, pending: { runId, digests: changed } }));
  return { checked, changed: codes, dispatched: runId };
}

export default {
  async scheduled(event, env) {
    console.log("TROLS watcher", await check(env, new Date(event.scheduledTime)));
  },
};
