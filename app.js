/* 스마트보장분석 고도화 — 플로우 · 와이어프레임 뷰어 */
(function () {
  "use strict";
  const F = window.FLOW;
  const S = F.screens;
  const byId = new Map(S.map((s) => [s.id, s]));
  const idx = new Map(S.map((s, i) => [s.id, i]));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const GNB = [
    ["home", "초화면"], ["summary", "요약"], ["holdings", "가입현황"],
    ["diag", "진단 및 분석"], ["consult", "컨설팅"], ["output", "출력/발송"],
  ];
  const LNB = [
    ["home", "홈"], ["home", "고객조회"], ["comp", "보상분석"],
    ["editor", "편집출력"], ["library", "자료실"], ["admin-home", "관리자"],
  ];
  const GNB_OF = {
    home: "home", notice: "home", org: "home", bigdata: "home", claims: "home", mymodel: "home",
    summary: "summary", "summary-empty": "summary",
    holdings: "holdings", coverage: "holdings", convert: "holdings", manual: "holdings", lapsed: "holdings",
    diag: "diag", "diag-detail": "diag", radar: "diag", "body-chart": "diag", comp: "diag", disease: "diag",
    consult: "consult", alternative: "consult", simple: "consult", "design-result": "consult",
    compare: "consult", onesheet: "consult", opinion: "consult",
    output: "output", editor: "output", send: "output", "send-done": "output", remote: "output",
  };
  const LNB_OF = {
    comp: 2, editor: 3, library: 4, "admin-home": 5, "admin-std": 5, "admin-stat": 5,
    home: 0, notice: 0, org: 0, bigdata: 0, claims: 0, mymodel: 0,
    summary: 1, "summary-empty": 1, holdings: 1, coverage: 1, convert: 1, manual: 1, lapsed: 1,
  };

  const state = {
    view: "flow", screen: "home", scenario: "", step: -1, query: "", selected: null, zoom: 1, pan: { x: 0, y: 0 }, showBack: false,
  };
  const decisionsOf = (id) => (F.decisions || []).filter((d) => d.screen === id);
  const screenOf = (id) => byId.get(id);

  /* ───────────────────────── flow chart */
  const NW = 222, NH = 90, GX = 26, GY = 20, PER_ROW = 5, PADX = 24, PADY = 34;
  let layout = { nodes: new Map(), edges: [], w: 0, h: 0 };

  function computeLayout() {
    const nodes = new Map();
    const edges = [];
    let y = 62;
    F.stages.forEach((title, si) => {
      const list = S.filter((s) => s.stage === si);
      if (!list.length) return;
      const rows = Math.ceil(list.length / PER_ROW);
      const bandTop = y;
      list.forEach((s, i) => {
        const r = Math.floor(i / PER_ROW), c = i % PER_ROW;
        nodes.set(s.id, { x: PADX + c * (NW + GX), y: y + 30 + r * (NH + GY), s });
      });
      layoutBands.push({ title, y: bandTop, h: rows * (NH + GY) + 30 - GY + 14, si });
      y = bandTop + rows * (NH + GY) + 48;
    });
    S.forEach((s) => (s.actions || []).forEach((a) => {
      if (a.to && nodes.has(a.to)) edges.push({ from: s.id, to: a.to, action: a, nav: a.kind === "back" || a.kind === "tab" });
    }));
    const w = PADX * 2 + Math.min(PER_ROW, Math.max(...F.stages.map((_, si) => Math.min(PER_ROW, S.filter((s) => s.stage === si).length)))) * (NW + GX);
    layout = { nodes, edges, w: Math.max(w, PADX * 2 + NW), h: y };
  }
  const layoutBands = [];

  function edgePath(a, b) {
    const x1 = a.x + NW, y1 = a.y + NH / 2;
    const x2 = b.x, y2 = b.y + NH / 2;
    if (b.x > a.x) {
      const dx = Math.max(40, (x2 - x1) * 0.5);
      return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
    }
    const mx = Math.max(a.x + NW + 40, x2 + NW + 40);
    return `M${x1} ${y1} C${x1 + 60} ${y1} ${mx} ${y1} ${mx} ${(y1 + y2) / 2} S${x2 + NW + 60} ${y2} ${x2 + NW} ${y2}`;
  }

  function scenarioScreens() {
    const sc = (F.scenarios || []).find((s) => s.id === state.scenario);
    if (!sc) return null;
    const list = [sc.start || F.start];
    const acts = [];
    sc.steps.forEach((st) => {
      const cur = screenOf(list[list.length - 1]);
      const a = (cur.actions || []).find((x) => x.id === st.action);
      acts.push(a ? a.label : st.action);
      list.push(st.screen || (a ? a.to : list[list.length - 1]));
    });
    return { list, acts, sc };
  }

  function drawFlow() {
    const svg = document.getElementById("flow");
    const box = svg.getBoundingClientRect();
    const wrap = document.querySelector(".canvas-wrap");
    const W = Math.round(box.width) || wrap.clientWidth, H = Math.round(box.height) || wrap.clientHeight;
    const path = scenarioScreens();
    const pathSet = new Set();
    if (path) for (let i = 0; i < path.list.length - 1; i++) pathSet.add(path.list[i] + ">" + path.list[i + 1]);

    let out = "";
    layoutBands.forEach((b, bi) => {
      out += `<g class="band-g" data-band="${bi}" tabindex="0" role="button" aria-label="${esc(b.title + " 단계 보기")}">`;
      out += `<rect class="band" x="6" y="${b.y}" width="${layout.w - 12}" height="${b.h}" rx="14"/>`;
      out += `<text class="band-title" x="${PADX}" y="${b.y + 19}">${esc(b.title)}</text>`;
      out += `<text class="band-zoom" x="${layout.w - 22}" y="${b.y + 19}" text-anchor="end">＋</text></g>`;
    });

    layout.edges.forEach((e) => {
      if (e.nav && !state.showBack) return;
      const key = e.from + ">" + e.to;
      const a = layout.nodes.get(e.from), b = layout.nodes.get(e.to);
      const dim = path ? !pathSet.has(key) : false;
      const onPath = path ? pathSet.has(key) : false;
      const hot = (!path && state.selected && (e.from === state.selected || e.to === state.selected)) || onPath;
      out += `<path class="edge${dim ? " dim" : ""}${onPath ? " path" : ""}${hot && !onPath ? " hot" : ""}" data-from="${e.from}" data-to="${e.to}" d="${edgePath(a, b)}" marker-end="url(#arrow)"/>`;
    });

    S.forEach((s) => {
      const n = layout.nodes.get(s.id);
      if (!n) return;
      const dim = path ? !path.list.includes(s.id) : false;
      const sel = state.selected === s.id;
      const dec = decisionsOf(s.id).length;
      const t1 = s.title.length > 18 ? s.title.slice(0, 17) + "…" : s.title;
      const t2 = s.title.length > 18 ? s.title.slice(17, 34) : "";
      out += `<g class="node${dim ? " dim" : ""}${sel ? " sel" : ""}" data-id="${s.id}" transform="translate(${n.x},${n.y})" tabindex="0" role="button" aria-label="${esc(s.number + " " + s.title)}">`;
      out += `<rect class="box" width="${NW}" height="${NH}" rx="9"/>`;
      out += `<text class="n" x="12" y="20">${esc(s.number)}</text>`;
      out += `<text class="t" x="12" y="42">${esc(t1)}</text>`;
      if (t2) out += `<text class="t" x="12" y="60">${esc(t2)}</text>`;
      out += `<text class="m" x="12" y="${t2 ? 78 : 66}">${(s.actions || []).length}개 동작${s.end ? " · 종료" : ""}</text>`;
      if (dec) out += `<circle cx="${NW - 14}" cy="14" r="5" fill="#b45309"/>`;
      out += `</g>`;
    });

    const fit = state.fit;
    svg.setAttribute("viewBox", `${state.pan.x} ${state.pan.y} ${W / state.zoom} ${H / state.zoom}`);
    svg.innerHTML = `<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#b7b7b1"/></marker></defs>${out}`;
    document.getElementById("zoom-read").textContent = Math.round(state.zoom * 100) + "%";
    svg.style.width = W + "px";
    svg.style.height = H + "px";
  }

  function fitFlow(mode) {
    if (mode) state.fitMode = mode;
    const svgEl = document.getElementById("flow");
    const box = svgEl.getBoundingClientRect();
    const wrap = document.querySelector(".canvas-wrap");
    const W = Math.round(box.width) || wrap.clientWidth, H = Math.round(box.height) || wrap.clientHeight;
    const z = mode === "all"
      ? Math.min((W - 20) / layout.w, (H - 20) / layout.h, 1)
      : Math.max(0.72, Math.min((W - 24) / layout.w, 1.1));
    state.zoom = z;
    state.pan = mode === "all"
      ? { x: (layout.w - W / z) / 2, y: (layout.h - H / z) / 2 }
      : { x: Math.min(0, (layout.w - W / z) / 2), y: 0 };
    drawFlow();
  }

  function focusBand(i) {
    const band = layoutBands[i];
    if (!band) return;
    const svgEl = document.getElementById("flow");
    const box = svgEl.getBoundingClientRect();
    const W = Math.round(box.width), H = Math.round(box.height);
    const bw = layout.w - 12, bh = band.h + 10;
    state.zoom = Math.max(0.2, Math.min((W - 30) / bw, (H - 90) / bh, 1.15));
    state.pan = {
      x: Math.max(0, 6 + bw / 2 - W / state.zoom / 2),
      y: Math.max(0, band.y + bh / 2 - H / state.zoom / 2),
    };
    drawFlow();
  }

  function fitBox(x, y, w, h, pad) {
    const svgEl = document.getElementById("flow");
    const box = svgEl.getBoundingClientRect();
    const W = Math.round(box.width), H = Math.round(box.height);
    const p = pad || 40;
    state.zoom = Math.max(0.2, Math.min((W - p) / (w + p), (H - p - 40) / (h + p), 1.05));
    state.pan = { x: Math.max(0, x + w / 2 - W / state.zoom / 2), y: Math.max(0, y + h / 2 - H / state.zoom / 2) };
    drawFlow();
  }

  function focusPath() {
    const p = scenarioScreens();
    if (!p) return;
    const pts = p.list.map((id) => layout.nodes.get(id)).filter(Boolean);
    if (!pts.length) return;
    const x1 = Math.min(...pts.map((n) => n.x)), y1 = Math.min(...pts.map((n) => n.y));
    const x2 = Math.max(...pts.map((n) => n.x + NW)), y2 = Math.max(...pts.map((n) => n.y + NH));
    fitBox(x1, y1, x2 - x1, y2 - y1, 50);
  }

  function focusScreen(id) {
    const n = layout.nodes.get(id);
    if (!n) return;
    const svgEl = document.getElementById("flow");
    const box = svgEl.getBoundingClientRect();
    const wrap = document.querySelector(".canvas-wrap");
    const W = Math.round(box.width) || wrap.clientWidth, H = Math.round(box.height) || wrap.clientHeight;
    state.zoom = Math.max(0.62, Math.min(0.95, Math.min(W / (NW * 3.2), H / (NH * 4))));
    state.pan = { x: n.x + NW / 2 - W / state.zoom / 2, y: n.y + NH / 2 - H / state.zoom / 2 };
    state.pan.x = Math.min(Math.max(0, state.pan.x), Math.max(0, layout.w - W / state.zoom));
    state.pan.y = Math.min(Math.max(0, state.pan.y), Math.max(0, layout.h - H / state.zoom));
    state.selected = id;
    drawFlow();
  }

  /* ───────────────────────── page view */
  function blockHtml(b) {
    switch (b.type) {
      case "rows":
        return `<dl class="blk-rows">${b.rows.map((r) => `<div class="r"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl>`;
      case "notice":
        return `<div class="blk-notice">${esc(b.label)}</div>`;
      case "text":
        return `<p class="blk-text">${esc(b.label)}</p>`;
      case "search":
        return `<div class="blk-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" placeholder="${esc(b.placeholder)}" value="${esc(b.value || "")}" readonly aria-label="${esc(b.placeholder)}"></div>`;
      case "input":
        return `<div class="blk-field"><label>${esc(b.label)}</label>${b.inputType === "textarea" ? `<textarea aria-label="${esc(b.label)}"></textarea>` : `<input type="text" aria-label="${esc(b.label)}">`}</div>`;
      case "select":
        return `<div class="blk-field"><label>${esc(b.label)}</label><select aria-label="${esc(b.label)}">${b.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></div>`;
      case "visual":
        return `<div class="blk-visual" data-aspect="${esc(b.aspect || "wide")}"><div><div>${esc(b.label)}</div><div class="skeleton"><i></i><i></i><i></i></div></div></div>`;
      default:
        return "";
    }
  }

  function actionsHtml(s, isModal) {
    const hasOverlay = !!(s.ui && s.ui.overlay);
    const normal = (s.actions || []).filter((a) => a.kind !== "back" && a.kind !== "tab" && (a.kind !== "close" || !hasOverlay));
    return normal.map((a, i) => {
      const primary = a.kind === "primary" || (a.kind !== "secondary" && i === 0);
      const next = nextAction(s.id, a.id);
      return `<button class="btn${primary ? " primary" : ""}${next ? " next" : ""}" data-go="${esc(a.to || "")}" data-action="${esc(a.id)}" data-from="${esc(s.id)}">${esc(a.label)}${next ? '<span class="badge">다음</span>' : ""}</button>`;
    }).join("");
  }

  function nextAction(screenId, actionId) {
    if (!state.scenario) return false;
    const p = scenarioScreens();
    if (!p) return false;
    const at = p.list[state.step];
    if (at !== screenId) return false;
    const step = p.sc.steps[state.step];
    return step && step.action === actionId;
  }

  function mockHtml(s, inner) {
    const gnbCur = GNB_OF[s.id] || null;
    const lnbCur = LNB_OF[s.id];
    return `<div class="mock">
      <div class="mock-gnb">
        <span class="logo">스마트보장분석</span>
        <nav aria-label="GNB">${GNB.map(([id, label], i) => `<button data-go="${id}" data-gnb="${i}"${gnbCur === id ? ' aria-current="page"' : ""}>${label}</button>`).join("")}</nav>
        <span class="user">김근호 차장 · 기획팀 305 ▾</span>
      </div>
      <div class="mock-body">
        <aside class="mock-lnb" aria-label="LNB"><div class="group">SIDE MENU</div>${LNB.map(([id, label], i) => `<button data-go="${id}" data-lnb="${i}"${lnbCur === i ? ' aria-current="page"' : ""}>${label}</button>`).join("")}</aside>
        <main class="mock-main">${inner}</main>
      </div>
      <div class="mock-footer"><span>${s.stage === 0 ? "원본: 업무 요구사항 260624 · 지넥슨 문의 7건" : "요구 7 · 로그인 조직(소속·코드·성명)과 최종 로그인 일시 상시 표시"}</span><span>${esc(s.number)}</span></div>
    </div>`;
  }

  function bodyHtml(s) {
    const back = (s.actions || []).find((a) => a.kind === "back");
    const kinds = `<span class="kind ${s.origin === "source" ? "src" : "inf"}">${s.origin === "source" ? "원문 반영" : "기획 추론"}</span>`
      + (s.end ? '<span class="kind">종료 화면</span>' : "")
      + (decisionsOf(s.id).length ? `<span class="kind" style="border-color:#f0d9b5;background:#fdf3e3;color:#8a4b06">확인 필요 ${decisionsOf(s.id).length}</span>` : "");
    return `<div class="mock-head"><span class="num">${esc(s.number)}</span><h2>${esc((s.ui && s.ui.heading) || s.title)}</h2>
      <div class="kinds">${kinds}${back ? `<button class="btn back" data-go="${esc(back.to)}" data-action="${esc(back.id)}" data-from="${esc(s.id)}">← ${esc(back.label)}</button>` : ""}</div></div>
      ${s.body ? `<p class="lead">${esc(s.body)}</p>` : ""}
      <div class="blocks">${((s.ui && s.ui.blocks) || []).map(blockHtml).join("")}</div>
      <div class="mock-actions">${actionsHtml(s)}</div>`;
  }

  function renderPage() {
    const s = screenOf(state.screen) || screenOf(F.start);
    const base = s.ui && s.ui.overlay ? screenOf(s.ui.overlay) : null;
    let inner;
    if (base) {
      const close = (s.actions || []).find((a) => a.kind === "close");
      inner = bodyHtml(base) + `<div class="mock-modal-veil"><div class="mock-modal"><div class="mm-head"><h3>${esc(s.title)}</h3>
        <span class="kind">${esc(s.number)}</span>${close ? `<button class="x" data-go="${esc(close.to)}" data-action="${esc(close.id)}" data-from="${esc(s.id)}" aria-label="닫기">✕</button>` : ""}</div>
        <div class="mm-body">${((s.ui && s.ui.blocks) || []).map(blockHtml).join("")}</div>
        <div class="mm-foot">${actionsHtml(s, true)}</div></div></div>`;
    } else {
      inner = bodyHtml(s);
    }
    const i = idx.get(s.id);
    const prev = S[i - 1], next = S[i + 1];
    const p = scenarioScreens();
    const hint = p && p.list[state.step] === s.id && p.sc.steps[state.step]
      ? `<span class="step-hint">시나리오 다음: <b>${esc(p.sc.steps[state.step].action)}</b> → ${esc(p.sc.steps[state.step].screen || "")}</span>` : "";
    document.getElementById("pageview").innerHTML = `
      <div class="stage">
        <div class="crumbbar">
          <span>${esc(F.stages[s.stage])}</span><span>/</span><span class="now">${esc(s.number)} ${esc(s.title)}</span>
          ${hint}
          <div class="screen-nav">
            <button class="tool" data-prev="${prev ? prev.id : ""}" ${prev ? "" : "disabled"}>‹ 이전</button>
            <button class="tool" data-next="${next ? next.id : ""}" ${next ? "" : "disabled"}>다음 ›</button>
            <button class="tool" id="to-flow">플로우에서 보기</button>
          </div>
        </div>
        ${mockHtml(s, inner)}
      </div>
      <aside class="info">${infoHtml(s)}</aside>`;
    document.querySelectorAll(".navitem").forEach((el) => el.setAttribute("aria-current", el.dataset.id === s.id ? "true" : "false"));
  }

  function infoHtml(s) {
    const dec = decisionsOf(s.id);
    const reqs = s.reqs || [];
    const targets = [...new Set((s.actions || []).map((a) => a.to).filter((t) => t && byId.has(t)))];
    return `
      <h3>기획 근거</h3>
      <div class="card"><p>${esc(s.brief || "원문에 없는 화면입니다.")}</p></div>
      ${(s.uxConditions || []).length ? `<h3>화면 조건 · 분기</h3><div class="card"><ul>${s.uxConditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${dec.length ? `<h3>기획 확인 필요</h3><div class="card warn"><ul>${dec.map((d) => `<li>${esc(d.question)}</li>`).join("")}</ul></div>` : ""}
      ${reqs.length ? `<h3>반영 요구사항</h3><div class="card">${reqs.map((n) => `<button class="pill" data-req="${n}">요구 ${n}</button>`).join("")}</div>` : ""}
      ${targets.length ? `<h3>이어지는 화면</h3><div class="card links">${targets.map((t) => { const x = screenOf(t); return `<button data-go="${t}">${esc(x.number)} ${esc(x.title)}</button>`; }).join("")}</div>` : ""}
      <h3>원본</h3><div class="card"><p>${esc(F.source)}</p></div>`;
  }

  /* ───────────────────────── side list · scenario */
  function renderSide() {
    const q = state.query.trim();
    let html = "";
    F.stages.forEach((title, si) => {
      const list = S.filter((s) => s.stage === si && (!q || (s.title + s.number + (s.brief || "")).toLowerCase().includes(q.toLowerCase())));
      if (!list.length) return;
      html += `<div class="stage-title">${esc(title)}</div>`;
      list.forEach((s) => {
        html += `<button class="navitem" data-id="${s.id}" aria-current="${s.id === state.screen ? "true" : "false"}">
          <span class="num">${esc(s.number)}</span><span>${esc(s.title)}</span>
          ${decisionsOf(s.id).length ? '<span class="dot" title="기획 확인 필요"></span>' : ""}</button>`;
      });
    });
    document.getElementById("navlist").innerHTML = html || '<p style="padding:14px;color:#888;font-size:12.5px">검색 결과가 없습니다.</p>';
  }

  function renderScenarioBar() {
    const sel = document.getElementById("scenario");
    const opts = ['<option value="">시나리오 선택 안 함</option>']
      .concat((F.scenarios || []).map((s) => `<option value="${s.id}"${s.id === state.scenario ? " selected" : ""}>${esc(s.title)}</option>`));
    sel.innerHTML = opts.join("");
    const p = scenarioScreens();
    const box = document.getElementById("step");
    if (!p) { box.textContent = ""; box.hidden = true; return; }
    box.hidden = false;
    const k = state.step;
    box.innerHTML = k < 0
      ? `시작 · <b>${esc(screenOf(p.list[0]).number)} ${esc(screenOf(p.list[0]).title)}</b>`
      : `${Math.min(k + 1, p.sc.steps.length)}/${p.sc.steps.length} · <b>${esc(p.acts[k] || "")}</b> → ${esc(screenOf(p.list[k + 1]).number)} ${esc(screenOf(p.list[k + 1]).title)}`;
  }

  /* ───────────────────────── navigation */
  function open(screenId, opts) {
    if (!byId.has(screenId)) return;
    state.screen = screenId;
    if (opts && opts.focus) focusScreen(screenId);
    if (state.view === "page") renderPage();
    renderSide();
  }

  function setView(v) {
    state.view = v;
    document.querySelectorAll(".viewtabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === v ? "true" : "false"));
    document.getElementById("flowview").hidden = v !== "flow";
    document.getElementById("pageview").hidden = v !== "page";
    if (v === "flow") { requestAnimationFrame(() => fitFlow(state.fitMode || "width")); }
    else renderPage();
  }

  function advance() {
    const p = scenarioScreens();
    if (!p) return;
    if (state.step >= p.sc.steps.length - 1) return;
    state.step += 1;
    open(p.list[state.step], { focus: state.view === "flow" });
    renderScenarioBar();
    if (state.view === "page") renderPage();
  }

  /* ───────────────────────── dialog */
  function openReqs() {
    const rows = (F.requirements || []).map((r) => {
      const tgt = r.screens.map((id) => screenOf(id)).filter(Boolean);
      return `<tr><td class="req">${r.n}</td><td>${esc(r.group)}</td><td>${esc(r.title)}</td><td>${esc(r.detail)}</td>
        <td>${tgt.map((t) => `<button data-go2="${t.id}">${esc(t.number)} ${esc(t.title)}</button>`).join("<br>")}</td></tr>`;
    }).join("");
    document.getElementById("req-body").innerHTML = `<table class="req-table"><thead><tr><th>#</th><th>분류</th><th>요구사항</th><th>TO-BE 요지</th><th>화면</th></tr></thead><tbody>${rows}</tbody></table>`;
    document.getElementById("req-dialog").showModal();
  }

  /* ───────────────────────── events */
  function wire() {
    document.querySelectorAll(".viewtabs button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    document.querySelector(".topbar").addEventListener("click", (e) => {
      const b = e.target.closest("[data-reqs],[data-drawer]");
      if (!b) return;
      if (b.hasAttribute("data-reqs")) openReqs();
      else document.querySelector(".side").classList.toggle("open");
    });
    document.getElementById("navlist").addEventListener("click", (e) => {
      const b = e.target.closest(".navitem");
      if (!b) return;
      open(b.dataset.id);
      if (window.innerWidth <= 1080) document.querySelector(".side").classList.remove("open");
      if (state.view === "page") renderPage();
    });
    document.getElementById("q").addEventListener("input", (e) => { state.query = e.target.value; renderSide(); });
    document.getElementById("scenario").addEventListener("change", (e) => {
      state.scenario = e.target.value; state.step = -1;
      renderScenarioBar();
      if (state.scenario) { const p = scenarioScreens(); open(p.list[0]); if (state.view === "flow") focusPath(); }
      drawFlow(); renderPage();
    });
    document.getElementById("advance").addEventListener("click", advance);
    document.getElementById("fit").addEventListener("click", () => fitFlow("all"));
    document.getElementById("showback").addEventListener("change", (e) => { state.showBack = e.target.checked; drawFlow(); });
    document.getElementById("zin").addEventListener("click", () => { state.zoom = Math.min(1.6, state.zoom * 1.2); drawFlow(); });
    document.getElementById("zout").addEventListener("click", () => { state.zoom = Math.max(0.12, state.zoom / 1.2); drawFlow(); });

    const svg = document.getElementById("flow");
    const hotEdges = (id, on) => svg.querySelectorAll(`.edge[data-from="${id}"],.edge[data-to="${id}"]`).forEach((p) => p.classList.toggle("hot", on));
    svg.addEventListener("mouseover", (e) => { const n = e.target.closest(".node"); if (n) hotEdges(n.dataset.id, true); });
    svg.addEventListener("mouseout", (e) => { const n = e.target.closest(".node"); if (n) hotEdges(n.dataset.id, false); });
    svg.addEventListener("click", (e) => {
      const band = e.target.closest("[data-band]");
      if (band) { focusBand(Number(band.dataset.band)); return; }
      const n = e.target.closest(".node");
      if (n) { open(n.dataset.id); setView("page"); return; }
    });
    svg.addEventListener("keydown", (e) => {
      const n = e.target.closest(".node");
      if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(n.dataset.id); setView("page"); }
      const bg = e.target.closest("[data-band]");
      if (bg && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); focusBand(Number(bg.dataset.band)); }
    });
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".node")) return;
      drag = { x: e.clientX, y: e.clientY, px: state.pan.x, py: state.pan.y };
      svg.classList.add("dragging");
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      state.pan.x = drag.px - (e.clientX - drag.x) / state.zoom;
      state.pan.y = drag.py - (e.clientY - drag.y) / state.zoom;
      drawFlow();
    });
    svg.addEventListener("pointerup", () => { drag = null; svg.classList.remove("dragging"); });
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const wrap = document.querySelector(".canvas-wrap");
      const r = wrap.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const wx = state.pan.x + mx / state.zoom, wy = state.pan.y + my / state.zoom;
      const z = Math.max(0.12, Math.min(1.6, state.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      state.zoom = z;
      state.pan.x = wx - mx / z; state.pan.y = wy - my / z;
      drawFlow();
    }, { passive: false });

    document.getElementById("pageview").addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { open(go.dataset.go); if (state.view === "page") renderPage(); return; }
      const prev = e.target.closest("[data-prev]"), next = e.target.closest("[data-next]");
      if (prev && prev.dataset.prev) { open(prev.dataset.prev); renderPage(); }
      if (next && next.dataset.next) { open(next.dataset.next); renderPage(); }
      if (e.target.id === "to-flow") { setView("flow"); focusScreen(state.screen); }
      const req = e.target.closest("[data-req]");
      if (req) openReqs();
    });
    document.getElementById("req-body").addEventListener("click", (e) => {
      const b = e.target.closest("[data-go2]");
      if (b) { document.getElementById("req-dialog").close(); open(b.dataset.go2); setView("page"); }
    });
    document.querySelector("#req-dialog .dlg-head button").addEventListener("click", () => document.getElementById("req-dialog").close());
    window.addEventListener("resize", () => { if (state.view === "flow") drawFlow(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.querySelector(".side").classList.remove("open");
      if (e.target.matches("input,select,textarea")) return;
      if (e.key === "ArrowRight" && state.view === "page") { const i = idx.get(state.screen); if (S[i + 1]) { open(S[i + 1].id); renderPage(); } }
      if (e.key === "ArrowLeft" && state.view === "page") { const i = idx.get(state.screen); if (S[i - 1]) { open(S[i - 1].id); renderPage(); } }
    });
  }

  function boot() {
    const acts = S.reduce((n, s) => n + (s.actions || []).length, 0);
    const lg = document.querySelector(".legend span");
    if (lg) lg.innerHTML = `<b>■</b> 화면 ${S.length}개 · 동작 ${acts}개`;
    computeLayout();
    renderSide();
    renderScenarioBar();
    wire();
    state.fitMode = "width";
    setView(window.innerWidth <= 640 ? "page" : "flow");
    renderPage();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
