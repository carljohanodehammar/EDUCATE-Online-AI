/* Shared behaviour: language toggle, navigation, progress and the embedded exercises.
   All exercise data lives in <script type="application/json"> blocks inside each language section,
   so every exercise is rendered once per language and works without a server. */
(function () {
  "use strict";

  // ---------- storage helpers (per-viewer convenience only; everything works without them) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("aiu:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("aiu:" + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  const UI = {
    sv: {
      switchTo: "English", switchLabel: "Switch to English", menu: "Meny", check: "Kontrollera", reset: "Börja om",
      correct: "Rätt.", wrong: "Inte riktigt.", score: (a, b) => `${a} av ${b} rätt`, answered: (a, b) => `${a} av ${b} besvarade`,
      exercise: "Övning", done: "Markera sidan som genomgången", undone: "Genomgången ✓ (klicka för att ångra)",
      copy: "Kopiera text", copied: "Kopierat", saved: "Sparas bara i din webbläsare.", sample: "Generera nästa ord",
      restart: "Börja om meningen", temp: "Temperatur", why: "Varför frågar du det?", next: "Nästa steg", explain: "Förklara beslutet",
      checklistScore: (a, b) => `${a} av ${b} punkter uppfyllda`, yourLevel: "Din självskattning", noAnswer: "Inte valt",
      years: "år", days: "dagar", print: "Skriv ut", all: "Alla"
    },
    en: {
      switchTo: "Svenska", switchLabel: "Byt till svenska", menu: "Menu", check: "Check", reset: "Start again",
      correct: "Correct.", wrong: "Not quite.", score: (a, b) => `${a} of ${b} correct`, answered: (a, b) => `${a} of ${b} answered`,
      exercise: "Exercise", done: "Mark this page as completed", undone: "Completed ✓ (click to undo)",
      copy: "Copy text", copied: "Copied", saved: "Saved only in your browser.", sample: "Generate the next word",
      restart: "Restart the sentence", temp: "Temperature", why: "Why do you ask?", next: "Next step", explain: "Explain the decision",
      checklistScore: (a, b) => `${a} of ${b} items met`, yourLevel: "Your self-assessment", noAnswer: "Not chosen",
      years: "years", days: "days", print: "Print", all: "All"
    }
  };

  // ---------- language ----------
  function initialLang() {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "sv" || q === "en") return q;
    return store.get("lang", "sv");
  }
  let lang = initialLang();
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    const t = document.querySelector("title");
    if (t && t.dataset[lang]) t.textContent = t.dataset[lang];
    const btn = document.getElementById("langBtn");
    if (btn) { btn.textContent = UI[lang].switchTo; btn.setAttribute("aria-label", UI[lang].switchLabel); btn.lang = lang === "sv" ? "en" : "sv"; }
    const mb = document.getElementById("menuBtn");
    if (mb) mb.textContent = UI[lang].menu;
    document.querySelectorAll("[data-sv][data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
    document.querySelectorAll("[data-ph-sv]").forEach(el => { el.placeholder = el.dataset["ph" + (lang === "sv" ? "Sv" : "En")]; });
    // keep the language when moving between pages
    document.querySelectorAll("a[data-internal]").forEach(a => {
      const u = new URL(a.getAttribute("href"), location.href); u.searchParams.set("lang", lang);
      a.setAttribute("href", u.pathname.split("/").pop() + u.search + u.hash);
    });
    updateJourney();
  }
  document.addEventListener("click", e => {
    if (e.target.id === "langBtn") {
      lang = lang === "sv" ? "en" : "sv"; store.set("lang", lang);
      const u = new URL(location.href); u.searchParams.set("lang", lang); history.replaceState(null, "", u);
      applyLang();
    }
    if (e.target.id === "menuBtn") {
      const s = document.getElementById("side"); const open = s.classList.toggle("open");
      e.target.setAttribute("aria-expanded", open ? "true" : "false");
    }
  });

  // ---------- progress ----------
  // A part counts as completed when every exercise has been worked through and the exit note is written.
  // Progress is shared between the two languages: exercises are keyed by their position on the page.
  const pageId = document.body.dataset.page;
  const MIN_CHARS = 20;
  function doneSet() { return new Set(store.get("done", [])); }
  function exKey(host) { return host.dataset.exKey; }
  function isExDone(key) { return !!store.get("ex:" + key, false); }
  function markEx(host) {
    const key = exKey(host); if (!key || isExDone(key)) { updateJourney(); return; }
    store.set("ex:" + key, true);
    document.querySelectorAll(`.ex[data-ex-key="${key}"] .ex-head`).forEach(h => {
      if (!h.querySelector(".ex-done")) h.append(el("span", { class: "ex-done" }, "✓"));
    });
    updateJourney();
  }
  function gateText(key) { return store.get("gate:" + key, ""); }
  function updateNav() {
    const d = doneSet();
    document.querySelectorAll(".side a[data-page]").forEach(a => {
      const dot = a.querySelector(".done"); if (!dot) return;
      const isDone = d.has(a.dataset.page);
      dot.classList.toggle("is-done", isDone);
      dot.setAttribute("aria-label", isDone ? (lang === "sv" ? "genomgången" : "completed") : (lang === "sv" ? "inte genomgången" : "not completed"));
    });
  }
  function pageStatus() {
    const sec = document.querySelector(`main .l-${lang}`) || document.querySelector("main");
    const exs = [...sec.querySelectorAll(".ex[data-ex-key]")];
    const gates = [...sec.querySelectorAll(".gate[data-kind='pause'],.gate[data-kind='bridge']")];
    const exit = sec.querySelector(".gate[data-kind='exit']");
    return {
      exs: exs.map(e => ({ el: e, title: (e.querySelector(".ex-title") || {}).textContent || "", done: isExDone(exKey(e)) })),
      gates: gates.map(g => ({ el: g, done: gateText(g.dataset.gateKey).trim().length >= MIN_CHARS })),
      exit: exit ? { el: exit, done: gateText(exit.dataset.gateKey).trim().length >= MIN_CHARS } : null
    };
  }
  function updateJourney() {
    const panel = document.querySelector(`main .l-${lang} .journey`) || document.querySelector("main .journey");
    if (!panel) { updateNav(); return; }
    const st = pageStatus();
    const T = lang === "sv"
      ? { h: "Din väg genom delen", ex: "Övningar", stop: "Stanna och tänk", exit: "Det du tar med dig", done: "Delen är genomgången. Det du skrev i slutet följer med till nästa del.", left: "Kvar att göra innan delen räknas som genomgången:", go: "Gå till", ok: "klar", todo: "kvar" }
      : { h: "Your path through this part", ex: "Exercises", stop: "Stop and think", exit: "What you take with you", done: "This part is completed. What you wrote at the end comes with you to the next part.", left: "Left to do before the part counts as completed:", go: "Go to", ok: "done", todo: "to do" };
    const exDone = st.exs.filter(e => e.done).length, gDone = st.gates.filter(g => g.done).length;
    const complete = exDone === st.exs.length && (!st.exit || st.exit.done);
    const d = doneSet();
    if (complete) d.add(pageId); else d.delete(pageId);
    store.set("done", [...d]);
    panel.innerHTML = "";
    panel.append(el("h2", null, T.h));
    const total = st.exs.length + st.gates.length + (st.exit ? 1 : 0);
    const n = exDone + gDone + (st.exit && st.exit.done ? 1 : 0);
    panel.append(el("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(n), "aria-label": T.h }, el("span", { style: `width:${total ? Math.round(100 * n / total) : 0}%` })));
    const ul = el("ul", { class: "journey-list" });
    ul.append(el("li", { class: exDone === st.exs.length ? "ok" : "" }, `${T.ex}: ${exDone} / ${st.exs.length}`));
    if (st.gates.length) ul.append(el("li", { class: gDone === st.gates.length ? "ok" : "" }, `${T.stop}: ${gDone} / ${st.gates.length}`));
    if (st.exit) ul.append(el("li", { class: st.exit.done ? "ok" : "" }, `${T.exit}: ${st.exit.done ? T.ok : T.todo}`));
    panel.append(ul);
    if (complete) panel.append(el("p", { class: "journey-done" }, T.done));
    else {
      const todo = el("ul", { class: "journey-todo" });
      st.exs.filter(e => !e.done).forEach(e => {
        if (!e.el.id) e.el.id = nextId("exa");
        todo.append(el("li", null, el("a", { href: "#" + e.el.id }, `${T.go}: ${e.title}`)));
      });
      if (st.exit && !st.exit.done) { if (!st.exit.el.id) st.exit.el.id = nextId("exit"); todo.append(el("li", null, el("a", { href: "#" + st.exit.el.id }, `${T.go}: ${T.exit}`))); }
      panel.append(el("p", { class: "small" }, T.left), todo);
    }
    updateNav();
  }

  // ---------- utilities ----------
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach(c => { if (c == null) return; n.append(c.nodeType ? c : document.createTextNode(c)); });
    return n;
  };
  const langOf = node => (node.closest("[lang]") || document.documentElement).getAttribute("lang") === "en" ? "en" : "sv";
  let uid = 0;
  const nextId = p => `${p}-${++uid}`;

  function shell(host, data, L) {
    host.innerHTML = "";
    const titleId = nextId("ex");
    host.setAttribute("role", "group"); host.setAttribute("aria-labelledby", titleId);
    const head = el("div", { class: "ex-head" }, el("span", { class: "ex-badge" }, data.badge || UI[L].exercise), el("h3", { class: "ex-title", id: titleId }, data.title || ""));
    if (exKey(host) && isExDone(exKey(host))) head.append(el("span", { class: "ex-done" }, "✓"));
    host.append(head);
    if (data.intro) host.append(el("p", { class: "ex-intro", html: data.intro }));
    const body = el("div"); host.append(body);
    const foot = el("div", { class: "ex-foot" }); host.append(foot);
    return { body, foot };
  }

  // ---------- exercise: choice (quiz and scenarios; every option can carry its own feedback) ----------
  function choice(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const live = el("p", { class: "score", "aria-live": "polite" });
    const state = data.questions.map(() => null);
    data.questions.forEach((q, qi) => {
      const wrap = el("div", { class: "q" });
      const qid = nextId("q");
      wrap.append(el("p", { class: "q-text", id: qid }, data.questions.length > 1 ? el("span", { class: "q-num" }, `${qi + 1}.`) : null, el("span", { html: q.q })));
      if (q.context) wrap.append(el("p", { class: "muted", html: q.context }));
      const opts = el("div", { class: "opts", role: "group", "aria-labelledby": qid });
      const fb = el("div", { "aria-live": "polite" });
      q.options.forEach((o, oi) => {
        const b = el("button", { type: "button", class: "opt", "aria-pressed": "false" }, el("span", { html: o.t }));
        b.addEventListener("click", () => {
          if (state[qi] !== null) return;
          state[qi] = oi;
          opts.querySelectorAll(".opt").forEach((x, xi) => {
            x.disabled = true;
            const ok = !!q.options[xi].ok;
            if (xi === oi) { x.setAttribute("aria-pressed", "true"); x.classList.add(ok ? "is-ok" : "is-bad"); }
            else if (ok && data.revealCorrect !== false) x.classList.add("is-ok");
          });
          const ok = !!o.ok;
          const neutral = data.neutral;
          fb.innerHTML = "";
          fb.append(el("div", { class: "fb " + (neutral ? "" : ok ? "ok" : "bad") }, neutral ? null : el("strong", null, ok ? UI[L].correct : UI[L].wrong), el("span", { html: o.fb || q.explain || "" })));
          if (q.explain && o.fb) fb.append(el("div", { class: "fb" }, el("span", { html: q.explain })));
          update();
        });
        opts.append(b);
      });
      wrap.append(opts, fb);
      body.append(wrap);
    });
    function update() {
      const answered = state.filter(s => s !== null).length;
      const right = state.filter((s, i) => s !== null && data.questions[i].options[s].ok).length;
      live.textContent = data.neutral ? UI[L].answered(answered, state.length) : (answered === state.length ? UI[L].score(right, state.length) : UI[L].answered(answered, state.length));
      if (answered === state.length) markEx(host);
    }
    foot.append(live, el("button", { type: "button", class: "btn ghost", onclick: () => choice(host, data, L) }, UI[L].reset));
    update();
  }

  // ---------- exercise: sort (assign each item to one category) ----------
  function sort(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const live = el("p", { class: "score", "aria-live": "polite" });
    const state = data.items.map(() => null);
    data.items.forEach((it, ii) => {
      const row = el("div", { class: "sort-item" });
      const pid = nextId("s");
      row.append(el("p", { id: pid, html: it.t }));
      const cats = el("div", { class: "sort-cats", role: "group", "aria-labelledby": pid });
      const fb = el("div", { "aria-live": "polite" });
      data.categories.forEach((c, ci) => {
        const b = el("button", { type: "button", class: "chip", "aria-pressed": "false" }, c);
        b.addEventListener("click", () => {
          if (state[ii] !== null) return;
          state[ii] = ci;
          cats.querySelectorAll(".chip").forEach((x, xi) => { x.disabled = true; if (xi === ci) x.setAttribute("aria-pressed", "true"); });
          const ok = ci === it.c;
          fb.innerHTML = "";
          fb.append(el("div", { class: "fb " + (ok ? "ok" : "bad") }, el("strong", null, ok ? UI[L].correct : `${UI[L].wrong} ${data.categories[it.c]}.`), el("span", { html: it.fb || "" })));
          update();
        });
        cats.append(b);
      });
      row.append(cats, fb); body.append(row);
    });
    function update() {
      const a = state.filter(s => s !== null).length, r = state.filter((s, i) => s === data.items[i].c).length;
      live.textContent = a === state.length ? UI[L].score(r, state.length) : UI[L].answered(a, state.length);
      if (a === state.length) markEx(host);
    }
    foot.append(live, el("button", { type: "button", class: "btn ghost", onclick: () => sort(host, data, L) }, UI[L].reset));
    update();
  }

  // ---------- exercise: checklist (self-audit, saved locally) ----------
  function checklist(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const key = "cl:" + data.id + ":" + L;
    const saved = store.get(key, []);
    const ul = el("ul", { class: "check-list" });
    const meter = el("div", { class: "meter", "aria-hidden": "true" }, el("span", { style: "width:0%" }));
    const live = el("p", { class: "score", "aria-live": "polite" });
    const verdict = el("div", { "aria-live": "polite" });
    data.items.forEach((t, i) => {
      const id = nextId("c");
      const cb = el("input", { type: "checkbox", id });
      cb.checked = !!saved[i];
      cb.addEventListener("change", () => { update(); markEx(host); });
      ul.append(el("li", null, el("label", { for: id }, cb, el("span", { html: t }))));
    });
    body.append(ul);
    function update() {
      const boxes = [...ul.querySelectorAll("input")];
      const vals = boxes.map(b => b.checked); store.set(key, vals);
      const n = vals.filter(Boolean).length;
      meter.firstChild.style.width = Math.round(100 * n / vals.length) + "%";
      live.textContent = UI[L].checklistScore(n, vals.length);
      verdict.innerHTML = "";
      if (data.verdicts) {
        const v = data.verdicts.slice().sort((a, b) => b.min - a.min).find(v => n >= v.min);
        if (v) verdict.append(el("div", { class: "fb" }, el("span", { html: v.t })));
      }
    }
    foot.append(el("div", { style: "flex:1;min-width:220px" }, meter, live, verdict), el("span", { class: "small muted" }, UI[L].saved));
    update();
  }

  // ---------- exercise: self-assessment ----------
  function selfAssess(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const key = "self:" + data.id + ":" + L;
    const saved = store.get(key, {});
    const summary = el("div", { class: "out", "aria-live": "polite" });
    data.dims.forEach((d, di) => {
      const row = el("div", { class: "self-row" });
      const hid = nextId("d");
      row.append(el("h4", { id: hid }, d.name), el("p", { html: d.desc }));
      const lv = el("div", { class: "levels", role: "group", "aria-labelledby": hid });
      data.levels.forEach((l, li) => {
        const b = el("button", { type: "button", class: "chip", "aria-pressed": saved[di] === li ? "true" : "false", title: l.desc || "" }, l.name);
        b.addEventListener("click", () => {
          saved[di] = li; store.set(key, saved);
          lv.querySelectorAll(".chip").forEach((x, xi) => x.setAttribute("aria-pressed", xi === li ? "true" : "false"));
          render();
        });
        lv.append(b);
      });
      row.append(lv); body.append(row);
    });
    if (data.levels.some(l => l.desc)) {
      const dl = el("dl", { class: "small" });
      data.levels.forEach(l => { dl.append(el("dt", { style: "font-weight:700;margin-top:.4rem" }, l.name), el("dd", { style: "margin:0" }, l.desc)); });
      body.append(el("details", null, el("summary", null, L === "sv" ? "Vad betyder nivåerna?" : "What do the levels mean?"), el("div", null, dl)));
    }
    function render() {
      if (data.dims.every((d, i) => saved[i] != null)) markEx(host);
      const lines = data.dims.map((d, i) => `${d.name}: ${saved[i] != null ? data.levels[saved[i]].name : UI[L].noAnswer}`);
      summary.textContent = `${UI[L].yourLevel}\n` + lines.join("\n");
      if (data.advice) {
        const low = data.dims.filter((d, i) => saved[i] == null || saved[i] === 0).map(d => d.name);
        if (low.length && Object.keys(saved).length) summary.textContent += "\n\n" + data.advice + " " + low.join(", ") + ".";
      }
    }
    foot.append(el("div", { style: "flex:1" }, summary), el("span", { class: "small muted" }, UI[L].saved));
    render();
  }

  // ---------- exercise: reflection fields with copy ----------
  function reflect(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const key = "refl:" + data.id + ":" + L;
    const saved = store.get(key, {});
    const fields = data.fields.map((f, i) => {
      const id = nextId("r");
      body.append(el("label", { class: "fld", for: id }, f.label));
      if (f.hint) body.append(el("p", { class: "hint" }, f.hint));
      const ta = el("textarea", { id, rows: f.rows || 4 });
      ta.value = saved[i] || "";
      ta.addEventListener("input", () => { saved[i] = ta.value; store.set(key, saved); checkReflect(); });
      body.append(ta);
      return { f, ta };
    });
    function checkReflect() { if (fields.every(x => x.ta.value.trim().length >= 15)) markEx(host); }
    const btn = el("button", { type: "button", class: "btn" }, UI[L].copy);
    btn.addEventListener("click", async () => {
      const txt = (data.title ? data.title + "\n\n" : "") + fields.map(x => `${x.f.label}\n${x.ta.value}`).join("\n\n");
      try { await navigator.clipboard.writeText(txt); btn.textContent = UI[L].copied; setTimeout(() => btn.textContent = UI[L].copy, 1500); } catch (e) { /* clipboard unavailable */ }
    });
    foot.append(btn, el("span", { class: "small muted" }, UI[L].saved));
  }

  // ---------- widget: next token (how a language model picks the next word) ----------
  function nextToken(host, data, L) {
    const { body, foot } = shell(host, data, L);
    let temp = 1, path = [];
    const sentence = el("p", { class: "tok-sentence", "aria-live": "polite" });
    const bars = el("div", { class: "bars" });
    const tempOut = el("output", null, "1.0");
    const range = el("input", { type: "range", min: "0.1", max: "2", step: "0.1", value: "1", "aria-label": UI[L].temp });
    range.addEventListener("input", () => { temp = parseFloat(range.value); tempOut.textContent = temp.toFixed(1); draw(); });
    const note = el("p", { class: "small muted", html: data.note || "" });
    function node() { let n = data.tree; for (const w of path) n = n.next[w]; return n; }
    function probs(n) {
      const ws = Object.keys(n.next || {});
      const logits = ws.map(w => Math.log(n.next[w].p) / temp);
      const m = Math.max(...logits); const ex = logits.map(x => Math.exp(x - m)); const s = ex.reduce((a, b) => a + b, 0);
      return ws.map((w, i) => [w, ex[i] / s]).sort((a, b) => b[1] - a[1]);
    }
    function draw() {
      sentence.innerHTML = "";
      sentence.append(data.start + " ");
      path.forEach(w => { sentence.append(el("span", { class: "gen" }, w), " "); });
      const n = node(); bars.innerHTML = "";
      if (!n.next) { sentence.append(el("span", { class: "muted" }, " ■")); sampleBtn.disabled = true; return; }
      sampleBtn.disabled = false;
      probs(n).forEach(([w, p]) => bars.append(el("div", { class: "bar" }, el("span", null, w), el("span", { class: "track" }, el("span", { class: "fill", style: `width:${(p * 100).toFixed(1)}%` })), el("span", { class: "pct" }, (p * 100).toFixed(0) + " %"))));
    }
    const sampleBtn = el("button", { type: "button", class: "btn" }, UI[L].sample);
    sampleBtn.addEventListener("click", () => {
      const ps = probs(node()); let r = Math.random(), acc = 0, pick = ps[ps.length - 1][0];
      for (const [w, p] of ps) { acc += p; if (r <= acc) { pick = w; break; } }
      path.push(pick); draw();
      if (path.length >= 2 || !node().next) markEx(host);
    });
    const resetBtn = el("button", { type: "button", class: "btn ghost", onclick: () => { path = []; draw(); } }, UI[L].restart);
    body.append(sentence, bars, el("div", { class: "range-row" }, el("label", null, UI[L].temp + ": "), range, tempOut), note);
    foot.append(sampleBtn, resetBtn);
    draw();
  }

  // ---------- widget: how long would it take to read every parameter? ----------
  function params(host, data, L) {
    const { body } = shell(host, data, L);
    const sel = el("div", { class: "tl-filter", role: "group", "aria-label": data.title });
    const out = el("div", { "aria-live": "polite" });
    const seen = new Set([0]);
    const fmt = n => n.toLocaleString(L === "sv" ? "sv-SE" : "en-GB", { maximumFractionDigits: 0 });
    data.options.forEach((o, i) => {
      const b = el("button", { type: "button", class: "chip", "aria-pressed": i === 0 ? "true" : "false" }, o.label);
      b.addEventListener("click", () => { sel.querySelectorAll(".chip").forEach((x, xi) => x.setAttribute("aria-pressed", xi === i ? "true" : "false")); show(o); seen.add(i); if (seen.size >= 3) markEx(host); });
      sel.append(b);
    });
    function show(o) {
      const secs = o.n; // one item per second
      const years = secs / (3600 * 24 * 365.25);
      out.innerHTML = "";
      let big;
      if (secs < 3600) big = `${fmt(Math.max(1, secs / 60))} ${L === "sv" ? "minuter" : "minutes"}`;
      else if (years < 1) big = `${fmt(secs / 86400)} ${UI[L].days}`;
      else big = `${fmt(years)} ${UI[L].years}`;
      out.append(el("p", { class: "big-num" }, big), el("p", { html: o.text }));
    }
    body.append(sel, out); show(data.options[0]);
  }

  // ---------- widget: a rule-based consultation in MYCIN style ----------
  function mycin(host, data, L) {
    const { body, foot } = shell(host, data, L);
    let step = 0;
    const box = el("div", { "aria-live": "polite" });
    function draw() {
      box.innerHTML = "";
      data.steps.slice(0, step + 1).forEach((s, i) => {
        const d = el("div", { class: "mycin-q" });
        d.append(el("p", { class: "mono", style: "margin:0", html: s.sys }));
        if (s.why) {
          const w = el("details", null, el("summary", null, s.whyLabel || UI[L].why), el("div", null, el("p", { class: "mono", html: s.why })));
          d.append(w);
        }
        box.append(d);
      });
      nextBtn.disabled = step >= data.steps.length - 1;
      if (step >= data.steps.length - 1) markEx(host);
    }
    const nextBtn = el("button", { type: "button", class: "btn", onclick: () => { step++; draw(); } }, UI[L].next);
    const resetBtn = el("button", { type: "button", class: "btn ghost", onclick: () => { step = 0; draw(); } }, UI[L].reset);
    body.append(box);
    if (data.after) body.append(el("div", { class: "box key", html: data.after }));
    foot.append(nextBtn, resetBtn);
    draw();
  }

  // ---------- widget: weights of a neural network that "explain" nothing ----------
  function weights(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const grid = el("div", { class: "weights", "aria-hidden": "true" });
    const out = el("div", { "aria-live": "polite" });
    function fill() {
      grid.innerHTML = "";
      for (let i = 0; i < 96; i++) { const v = (Math.random() * 2 - 1) * Math.random(); grid.append(el("span", null, (v >= 0 ? "+" : "") + v.toFixed(3))); }
    }
    const b = el("button", { type: "button", class: "btn" }, UI[L].explain);
    b.addEventListener("click", () => { fill(); markEx(host); out.innerHTML = ""; out.append(el("div", { class: "fb", html: data.answer })); });
    body.append(grid, out); foot.append(b); fill();
  }

  // ---------- widget: timeline filter ----------
  function timeline(host) {
    const list = host.querySelector(".timeline"); if (!list) return;
    const L = langOf(host);
    const tags = [...new Set([...list.querySelectorAll("li[data-where]")].map(li => li.dataset.where))];
    const bar = el("div", { class: "tl-filter", role: "group", "aria-label": L === "sv" ? "Filtrera tidslinjen" : "Filter the timeline" });
    const mk = (label, val) => {
      const b = el("button", { type: "button", class: "chip", "aria-pressed": val === "*" ? "true" : "false" }, label);
      b.addEventListener("click", () => {
        bar.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
        list.querySelectorAll("li").forEach(li => { li.hidden = !(val === "*" || li.dataset.where === val); });
      });
      return b;
    };
    bar.append(mk(UI[L].all, "*")); tags.forEach(t => bar.append(mk(t, t)));
    host.insertBefore(bar, list);
  }

  // ---------- widget: phrase-bank explorer ----------
  function frasbank(host, data, L) {
    const { body } = shell(host, data, L);
    const catRow = el("div", { class: "tl-filter", role: "group", "aria-label": data.catLabel });
    const varRow = el("div", { class: "tl-filter", role: "group", "aria-label": data.varLabel });
    const out = el("div", { "aria-live": "polite" });
    let cat = 0, v = 0; const seenFb = new Set();
    const press = (row, i) => row.querySelectorAll(".chip").forEach((x, xi) => x.setAttribute("aria-pressed", xi === i ? "true" : "false"));
    data.cats.forEach((c, i) => {
      const b = el("button", { type: "button", class: "chip", "aria-pressed": i === 0 ? "true" : "false" }, c.name);
      b.addEventListener("click", () => { cat = i; v = 0; press(catRow, i); drawVariants(); draw(); });
      catRow.append(b);
    });
    function drawVariants() {
      varRow.innerHTML = "";
      data.cats[cat].variants.forEach((vv, i) => {
        const b = el("button", { type: "button", class: "chip", "aria-pressed": i === v ? "true" : "false" }, vv.name);
        b.addEventListener("click", () => { v = i; press(varRow, i); draw(); });
        varRow.append(b);
      });
    }
    function draw() {
      out.innerHTML = "";
      const c = data.cats[cat], rule = c.variants[v];
      seenFb.add(cat + ":" + v); if (seenFb.size >= 3) markEx(host);
      if (c.desc) out.append(el("p", { class: "muted", html: c.desc }));
      const r = el("div", { class: "fb-rule" }, el("h4", null, data.ruleLabel), el("p", { html: rule.rule }), el("h4", null, data.secureLabel));
      const notes = el("div", { class: "notes" });
      data.noteNames.forEach((nn, i) => notes.append(el("div", { class: "note" }, el("b", null, nn), el("span", { html: rule.notes[i] }))));
      r.append(notes); out.append(r);
    }
    body.append(el("p", { class: "hint" }, data.catLabel), catRow, el("p", { class: "hint" }, data.varLabel), varRow, out);
    drawVariants(); draw();
  }

  // ---------- widget: planner that builds a printable plan ----------
  function planner(host, data, L) {
    const { body, foot } = shell(host, data, L);
    const key = "plan:" + data.id + ":" + L;
    const saved = store.get(key, {});
    const out = el("div", { class: "out", "aria-live": "polite" });
    const inputs = data.fields.map((f, i) => {
      const id = nextId("p");
      body.append(el("label", { class: "fld", for: id }, f.label));
      if (f.hint) body.append(el("p", { class: "hint", html: f.hint }));
      let inp;
      if (f.options) { inp = el("select", { id }); f.options.forEach(o => inp.append(el("option", null, o))); }
      else inp = el(f.long ? "textarea" : "input", f.long ? { id, rows: 3 } : { id, type: "text" });
      inp.value = saved[i] || (f.options ? f.options[0] : "");
      inp.addEventListener("input", render); inp.addEventListener("change", render);
      body.append(inp); return { f, inp };
    });
    function render() {
      inputs.forEach((x, i) => saved[i] = x.inp.value); store.set(key, saved);
      if (inputs.filter(x => !x.f.options && x.inp.value.trim().length >= 10).length >= 4) markEx(host);
      out.textContent = data.title + "\n\n" + inputs.map(x => `${x.f.label}\n${x.inp.value || "…"}`).join("\n\n");
      if (data.checks) {
        const warn = data.checks.filter(c => c.test(inputs.map(x => x.inp.value))).map(c => "• " + c.msg);
        if (warn.length) out.textContent += "\n\n" + (L === "sv" ? "Att tänka på:\n" : "Things to consider:\n") + warn.join("\n");
      }
    }
    const copy = el("button", { type: "button", class: "btn" }, UI[L].copy);
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(out.textContent); copy.textContent = UI[L].copied; setTimeout(() => copy.textContent = UI[L].copy, 1500); } catch (e) {} });
    body.append(out); foot.append(copy, el("button", { type: "button", class: "btn ghost", onclick: () => window.print() }, UI[L].print), el("span", { class: "small muted" }, UI[L].saved));
    render();
  }

  // ---------- glossary search ----------
  function glossary(host) {
    const L = langOf(host);
    const input = host.querySelector("input[type=search]"); if (!input) return;
    const items = [...host.querySelectorAll("dt")];
    const live = host.querySelector(".gl-count");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase(); let n = 0;
      items.forEach(dt => {
        const dd = dt.nextElementSibling; const hit = !q || (dt.textContent + " " + dd.textContent).toLowerCase().includes(q);
        dt.hidden = dd.hidden = !hit; if (hit) n++;
      });
      if (live) live.textContent = L === "sv" ? `${n} begrepp visas` : `${n} terms shown`;
    });
  }


  // ---------- stop-and-think gates ----------
  // A gate asks the reader to pause and write a short answer. The content after a bridge or pause gate is
  // folded until the reader has answered, but it can always be opened without answering.
  const GATE_UI = {
    sv: { bridge: "Innan du börjar", pause: "Stanna och tänk", exit: "Det du tar med dig", save: "Spara och läs vidare", saveExit: "Spara", saved: "Sparat", skip: "Läs vidare utan att svara", held: "Resten av avsnittet visas när du har svarat. Det räcker med några meningar.", min: n => `Skriv minst ${n} tecken.`, prev: "Det här tog du med dig från förra delen:", noPrev: "Du har inte skrivit något i slutet av förra delen ännu.", private: "Svaret sparas bara i din webbläsare." },
    en: { bridge: "Before you start", pause: "Stop and think", exit: "What you take with you", save: "Save and read on", saveExit: "Save", saved: "Saved", skip: "Read on without answering", held: "The rest of the section is shown once you have answered. A few sentences are enough.", min: n => `Write at least ${n} characters.`, prev: "This is what you took with you from the previous part:", noPrev: "You have not written anything at the end of the previous part yet.", private: "Your answer is saved only in your browser." }
  };
  function wrapAfter(gate) {
    const box = el("div", { class: "gated" });
    let n = gate.nextElementSibling;
    gate.after(box);
    while (n && !(n.classList.contains("gate") && n.dataset.kind !== "exit") && !n.classList.contains("journey")) {
      const next = n.nextElementSibling; box.append(n); n = next;
    }
    return box;
  }
  function renderGate(gate, L, idx) {
    let data = {};
    const s = gate.querySelector("script[type='application/json']");
    try { data = s ? JSON.parse(s.textContent) : {}; } catch (e) { console.error("Bad gate data", e); }
    const kind = gate.dataset.kind;
    const key = kind === "exit" ? `${pageId}:exit` : `${pageId}:${kind}:${idx}`;
    gate.dataset.gateKey = key;
    const U = GATE_UI[L];
    const id = nextId("g");
    gate.innerHTML = "";
    gate.setAttribute("role", "group"); gate.setAttribute("aria-labelledby", id + "-h");
    gate.append(el("p", { class: "gate-label", id: id + "-h" }, U[kind] || U.pause));
    if (kind === "bridge" && data.prev) {
      const prevText = gateText(`${data.prev}:exit`).trim();
      gate.append(prevText
        ? el("blockquote", { class: "gate-prev" }, el("p", { class: "small muted" }, U.prev), el("p", null, prevText))
        : el("p", { class: "small muted" }, U.noPrev));
    }
    gate.append(el("label", { class: "gate-q", for: id, html: data.q || "" }));
    const ta = el("textarea", { id, rows: 3 });
    ta.value = gateText(key);
    const btn = el("button", { type: "button", class: "btn" }, kind === "exit" ? U.saveExit : U.save);
    const status = el("span", { class: "small muted", "aria-live": "polite" });
    const ok = () => ta.value.trim().length >= MIN_CHARS;
    const refresh = () => { btn.disabled = !ok(); status.textContent = ok() ? "" : U.min(MIN_CHARS); };
    ta.addEventListener("input", () => { store.set("gate:" + key, ta.value); refresh(); });
    gate.append(ta, el("div", { class: "gate-foot" }, btn, status, el("span", { class: "small muted" }, U.private)));
    let box = null, bar = null;
    if (kind !== "exit") {
      box = wrapAfter(gate);
      bar = el("div", { class: "held-bar" }, el("p", { class: "small" }, U.held), el("button", { type: "button", class: "btn ghost small-btn" }, U.skip));
      bar.querySelector("button").addEventListener("click", () => { release(); store.set("skip:" + key, true); const f = box.querySelector("h2,h3,p"); if (f) { f.setAttribute("tabindex", "-1"); f.focus(); } });
      box.after(bar);
    }
    function hold() { if (!box) return; box.classList.add("is-held"); box.inert = true; box.setAttribute("aria-hidden", "true"); bar.hidden = false; }
    function release() { if (!box) return; box.classList.remove("is-held"); box.inert = false; box.removeAttribute("aria-hidden"); bar.hidden = true; }
    btn.addEventListener("click", () => {
      if (!ok()) return;
      store.set("gate:" + key, ta.value);
      status.textContent = U.saved;
      release(); updateJourney();
    });
    refresh();
    if (box) { (ok() || store.get("skip:" + key, false)) ? release() : hold(); }
  }

  // ---------- overall progress on the start page ----------
  const MODULES = ["vad-ar-ai", "historia", "nar-ai-ar-battre", "ai-litteracitet", "ai-och-larande", "lagar-och-etik", "rattssaker-examination", "lararens-arbete", "planera"];
  function started(m) {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(`aiu:ex:${m}:`) || k.startsWith(`aiu:gate:${m}:`)) return true; } } catch (e) {}
    return false;
  }
  // Updates the progress box on the start page. The box already has meaningful static content in the HTML,
  // so it is useful even before the visitor has done anything or if scripts fail.
  function overall(host) {
    const L = langOf(host);
    const d = doneSet();
    const n = MODULES.filter(m => d.has(m)).length;
    const S = L === "sv" ? { done: "Genomgången", started: "Påbörjad", not: "Inte påbörjad" } : { done: "Completed", started: "Started", not: "Not started" };
    const meter = host.querySelector(".meter");
    if (meter) { meter.setAttribute("aria-valuenow", String(n)); meter.firstElementChild.style.width = Math.round(100 * n / 9) + "%"; }
    host.querySelectorAll(".ov-list li[data-page]").forEach(li => {
      const m = li.dataset.page, st = li.querySelector(".ov-status");
      const state = d.has(m) ? "done" : (started(m) ? "started" : "not");
      li.dataset.state = state; if (st) st.textContent = S[state];
    });
    const next = MODULES.find(m => !d.has(m));
    const sum = host.querySelector(".ov-summary");
    if (sum && (n > 0 || MODULES.some(started))) {
      const nextIdx = MODULES.indexOf(next) + 1;
      sum.textContent = L === "sv"
        ? (n === 9 ? "Alla nio delar är genomgångna. Du kan nu hämta ditt certifikat." : `${n} av 9 delar genomgångna. Fortsätt med del ${nextIdx}.`)
        : (n === 9 ? "All nine parts are completed. You can now get your certificate." : `${n} of 9 parts completed. Continue with part ${nextIdx}.`);
    }
  }

  // ---------- certificate ----------
  function certificate(host) {
    const L = langOf(host);
    let cfg = {};
    try { cfg = JSON.parse(host.querySelector("script[type='application/json']").textContent); } catch (e) { console.error(e); }
    const T = L === "sv"
      ? { left: "Delar som återstår:", name: "Ditt namn (som det ska stå på certifikatet)", unit: "Fackhögskola, avdelning eller organisation (valfritt)", email: "E-postadress (valfritt)", make: "Skapa certifikatet", pdf: "Ladda ner certifikatet (PDF)", reg: "Registrera certifikatet hos Educate", code: "Unik kod", note: "Koden skapas en gång och sparas i din webbläsare, så att samma kod används om du laddar ner igen. Skicka registreringen till Educate så att certifikatet kan valideras.", need: "Fyll i ditt namn.", nopdf: "PDF-verktyget kunde inte laddas. Använd knappen Skriv ut och välj Spara som PDF.", print: "Skriv ut", preview: "Förhandsvisning" }
      : { left: "Parts left:", name: "Your name (as it should appear on the certificate)", unit: "School, department or organisation (optional)", email: "Email address (optional)", make: "Create the certificate", pdf: "Download the certificate (PDF)", reg: "Register the certificate with Educate", code: "Unique identifier", note: "The identifier is created once and saved in your browser, so the same identifier is used if you download again. Send the registration to Educate so the certificate can be validated.", need: "Please enter your name.", nopdf: "The PDF tool could not be loaded. Use the Print button and choose Save as PDF.", print: "Print", preview: "Preview" };
    const d = doneSet();
    const missing = MODULES.filter(m => !d.has(m));
    host.querySelectorAll(":scope > :not(script)").forEach(n => n.remove());
    if (missing.length) {
      const ul = el("ul");
      document.querySelectorAll(`.side a[data-page]`).forEach(a => { if (missing.includes(a.dataset.page)) ul.append(el("li", null, el("a", { href: a.getAttribute("href") }, a.querySelector(`.l-${L}`).textContent))); });
      host.append(el("div", { class: "box warn" }, el("p", null, el("strong", null, T.left)), ul));
      return;
    }
    const saved = store.get("cert", {});
    const f = {};
    const form = el("div", { class: "cert-form" });
    [["name", T.name, true], ["unit", T.unit], ["email", T.email]].forEach(([k, label, req]) => {
      const id = nextId("c");
      form.append(el("label", { class: "fld", for: id }, label));
      f[k] = el("input", { type: k === "email" ? "email" : "text", id, autocomplete: k === "name" ? "name" : (k === "email" ? "email" : "organization"), required: !!req });
      f[k].value = saved[k] || "";
      form.append(f[k]);
    });
    const msg = el("p", { class: "small", "aria-live": "polite" });
    const out = el("div");
    const make = el("button", { type: "button", class: "btn" }, T.make);
    form.append(el("div", { class: "ex-foot" }, make, msg));
    host.append(form, out);
    function code() {
      let c = store.get("cert", {}).code;
      if (!c) {
        const uuid = (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, x => (x ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> x / 4).toString(16)));
        c = "EDUCATE " + uuid;
      }
      return c;
    }
    function fmtDate(iso) { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
    function build() {
      const name = f.name.value.trim();
      if (!name) { msg.textContent = T.need; f.name.focus(); return; }
      const rec = { name, unit: f.unit.value.trim(), email: f.email.value.trim(), code: code(), date: store.get("cert", {}).date || new Date().toISOString() };
      store.set("cert", rec);
      msg.textContent = "";
      out.innerHTML = "";
      out.append(el("h2", null, T.preview), preview(rec));
      const pdfBtn = el("button", { type: "button", class: "btn" }, T.pdf);
      pdfBtn.addEventListener("click", () => pdf(rec));
      const body = `${cfg.mailBody || ""}\n\nName: ${rec.name}\nSchool or Company: ${rec.unit}\nEmail: ${rec.email}\nActivity: ${cfg.activity}\nType of activity: ${cfg.type}\nCompletion date: ${rec.date.slice(0, 10)}\nUnique identifier: ${rec.code}`;
      const mail = el("a", { class: "btn ghost", href: `mailto:${cfg.email}?subject=${encodeURIComponent((cfg.mailSubject || "Certificate") + " " + rec.code)}&body=${encodeURIComponent(body)}` }, T.reg);
      out.append(el("div", { class: "ex-foot" }, pdfBtn, mail, el("button", { type: "button", class: "btn ghost", onclick: () => window.print() }, T.print)),
        el("p", null, el("strong", null, T.code + ": "), el("span", { class: "mono" }, rec.code)), el("p", { class: "small muted" }, T.note));
    }
    function preview(rec) {
      const I = window.CERT_IMAGES || {};
      return el("div", { class: "cert-sheet", lang: "en" },
        I.logo ? el("img", { src: I.logo, alt: "Jönköping University", class: "cert-logo" }) : null,
        el("p", { class: "cert-title" }, "CERTIFICATE"), el("hr"),
        ...cfg.organiser.map(t => el("p", { class: "cert-org" }, t)),
        el("p", { class: "cert-activity" }, cfg.activity),
        el("p", { class: "cert-meta" }, "Type of activity"), el("p", { class: "cert-meta" }, cfg.type),
        el("p", { class: "cert-meta" }, "Completion"), el("p", { class: "cert-meta" }, fmtDate(rec.date)),
        cfg.facilitators ? el("p", { class: "cert-meta" }, "Facilitators") : null, cfg.facilitators ? el("p", { class: "cert-meta" }, cfg.facilitators) : null,
        el("hr", { class: "short" }),
        el("p", { class: "cert-name" }, rec.name),
        rec.unit ? el("p", { class: "cert-meta" }, rec.unit) : null, rec.email ? el("p", { class: "cert-meta" }, rec.email) : null,
        I.mark ? el("img", { src: I.mark, alt: "", class: "cert-mark" }) : null,
        el("div", { class: "cert-foot" }, ...cfg.footer.map(t => el("p", null, t)), el("p", null, "UNIQUE IDENTIFIER " + rec.code)));
    }
    function pdf(rec) {
      const J = window.jspdf && window.jspdf.jsPDF;
      if (!J) { msg.textContent = T.nopdf; return; }
      const doc = new J({ unit: "mm", format: "a4" });
      const I = window.CERT_IMAGES || {};
      const grey = [101, 101, 101];
      const C = 105;
      let y = 22;
      doc.setTextColor(...grey);
      if (I.logo) { doc.addImage(I.logo, "PNG", C - 20, y, 40, 17.7); y += 17.7 + 24; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(46); doc.text("CERTIFICATE", C, y, { align: "center" }); y += 10;
      doc.setDrawColor(...grey); doc.setLineWidth(0.3); doc.line(C - 40, y, C + 40, y); y += 13;
      doc.setFontSize(14);
      cfg.organiser.forEach(t => { doc.text(t, C, y, { align: "center" }); y += 6.5; });
      y += 5; doc.setFontSize(15); doc.text(doc.splitTextToSize(cfg.activity, 160), C, y, { align: "center" }); y += 10 + (doc.splitTextToSize(cfg.activity, 160).length - 1) * 6;
      doc.setFontSize(10.5);
      const meta = ["Type of activity", cfg.type, "Completion", fmtDate(rec.date)];
      if (cfg.facilitators) meta.push("Facilitators", cfg.facilitators);
      meta.forEach(t => { doc.text(t, C, y, { align: "center" }); y += 5; });
      y += 6; doc.line(C - 25, y, C + 25, y); y += 13;
      doc.setFontSize(16); doc.text(doc.splitTextToSize(rec.name, 160), C, y, { align: "center" }); y += 8;
      doc.setFontSize(10.5);
      if (rec.unit) { doc.text(rec.unit, C, y, { align: "center" }); y += 5; }
      if (rec.email) { doc.text(rec.email, C, y, { align: "center" }); y += 5; }
      if (I.mark) doc.addImage(I.mark, "PNG", C - 13, 238, 26, 17.7);
      doc.setFontSize(6.5); doc.setTextColor(30, 30, 30);
      let fy = 274;
      cfg.footer.concat(["UNIQUE IDENTIFIER " + rec.code]).forEach(t => { doc.text(t, C, fy, { align: "center" }); fy += 3; });
      doc.save(`Educate-certificate-${rec.code.split(" ").pop().slice(0, 8)}.pdf`);
    }
    make.addEventListener("click", build);
    if (saved.name) build();
  }

  const PLANNER_CHECKS = {
    sv: [
      { test: v => /ingen|nej/i.test(v[4] || "") && /hela|fullt|alla moment/i.test(v[2] || ""), msg: "AI får användas i hela arbetet men inget moment visar studentens eget kunnande. Lägg till ett moment som ger underlag." },
      { test: v => !(v[3] || "").trim(), msg: "Beskriv hur studenten visar sitt eget kunnande. En regel som inte går att kontrollera skyddar varken studenten eller examinationen." },
      { test: v => !(v[0] || "").trim(), msg: "Börja med lärandemålet. Det avgör vilken roll AI kan ha." }
    ],
    en: [
      { test: v => /none|no\b/i.test(v[4] || "") && /whole|throughout|fully/i.test(v[2] || ""), msg: "AI may be used throughout but no part shows the student's own knowledge. Add a part that provides evidence." },
      { test: v => !(v[3] || "").trim(), msg: "Describe how the student shows their own knowledge. A rule that cannot be checked protects neither the student nor the examination." },
      { test: v => !(v[0] || "").trim(), msg: "Start with the learning outcome. It decides what role AI can play." }
    ]
  };

  const RENDER = { choice, sort, checklist, self: selfAssess, reflect, nexttoken: nextToken, params, mycin, weights, frasbank, planner };
  function boot() {
    ["sv", "en"].forEach(L => {
      const sec = document.querySelector(`main .l-${L}`) || document.querySelector("main");
      sec.querySelectorAll(".ex[data-type]").forEach((host, i) => { host.dataset.exKey = `${pageId}:${i}`; });
      let gi = 0;
      sec.querySelectorAll(".gate[data-kind]").forEach(g => renderGate(g, L, g.dataset.kind === "exit" ? 0 : gi++));
    });
    document.querySelectorAll(".ex[data-type]").forEach(host => {
      const L = langOf(host);
      const s = host.querySelector("script[type='application/json']");
      let data = {};
      try { data = s ? JSON.parse(s.textContent) : {}; } catch (e) { console.error("Bad exercise data", e, host); return; }
      if (host.dataset.type === "planner") data.checks = PLANNER_CHECKS[L];
      const fn = RENDER[host.dataset.type];
      if (fn) fn(host, data, L);
    });
    document.querySelectorAll(".tl-host").forEach(timeline);
    document.querySelectorAll(".gl").forEach(glossary);
    applyLang();
    document.querySelectorAll(".overall").forEach(overall);
    document.querySelectorAll(".cert-app").forEach(certificate);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
