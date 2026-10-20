/* Gyoukai: 全社の決算・決算アラート・決算カレンダー・用語集・就活メモ
 * index.html の本体スクリプト（$, esc, ic, store, openSheet など）の後に読み込む。 */
(function () {
  "use strict";
  const FIN = window.GK_FIN || null;
  const CAL = window.GK_CAL || null;
  const GLOSS = window.GK_GLOSSARY || [];
  const PAGES = { results: "全社の決算", alerts: "決算アラート", calendar: "決算カレンダー", glossary: "用語集", notes: "就活メモ" };
  const STATUS = ["気になる", "説明会・イベント", "ES提出", "Webテスト", "一次面接", "二次面接", "最終面接", "内定", "見送り"];
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  let watch = new Set(store.get("watch", []));
  let notes = store.get("notes", {});
  const saveWatch = () => store.set("watch", [...watch]);
  const saveNotes = () => { if (!store.set("notes", notes)) toast("保存できませんでした（ブラウザの保存領域がいっぱいです）"); };

  // ---------- styles ----------
  const st = document.createElement("style");
  st.textContent = `
  .page { position: fixed; inset: 0; z-index: 65; background: var(--bg); overflow-y: auto; overscroll-behavior: contain; animation: pagein .3s cubic-bezier(.2,.8,.2,1); }
  @keyframes pagein { from { transform: translateY(24px); opacity: .4; } }
  .page-inner { max-width: 760px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: calc(env(safe-area-inset-top, 0px) + 12px) calc(40px + env(safe-area-inset-bottom, 0px)); }
  .page-head { display: flex; align-items: center; gap: 10px; position: sticky; top: env(safe-area-inset-top, 0px); background: var(--bg); padding: 8px 0 10px; z-index: 2; }
  .page-head button { width: 40px; height: 40px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; flex: none; }
  .page-head h1 { margin: 0; font-size: 24px; font-weight: 900; }
  .page-head .sp { flex: 1; }
  .fin-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 12px 14px; border-bottom: 1px solid var(--line); width: 100%; text-align: left; }
  .fin-row:last-child { border-bottom: 0; }
  .fin-row:hover { background: var(--bg); }
  .fin-row .nm { font-weight: 800; font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fin-row .meta { font-size: 11.5px; color: var(--ink-3); grid-column: 1; }
  .fin-row .vals { grid-row: 1 / span 2; grid-column: 2; text-align: right; font-family: var(--font-display); font-size: 13px; font-weight: 700; line-height: 1.5; }
  .fin-row .vals small { display: block; font-size: 11px; font-weight: 600; }
  .kind { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 7px; margin-left: 6px; border: 1px solid var(--line); color: var(--ink-2); vertical-align: 1px; }
  .kind.new { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .finbox { background: var(--bg); border-radius: var(--r-md); padding: 12px 14px; display: grid; gap: 8px; }
  .finbox .h { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .finbox .h b { font-size: 13px; }
  .finbox .h span { font-size: 11.5px; color: var(--ink-3); }
  .finbox .g { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
  .finbox .g div { background: var(--surface); border-radius: var(--r-sm); padding: 8px 10px; display: grid; gap: 1px; min-width: 0; }
  .finbox .g span { font-size: 11px; color: var(--ink-3); font-weight: 700; }
  .finbox .g b { font-family: var(--font-display); font-size: 15px; overflow-wrap: anywhere; }
  .finbox .g i { font-style: normal; font-size: 11px; font-weight: 700; }
  .prog { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; margin-top: 4px; }
  .prog i { display: block; height: 100%; background: var(--ink); border-radius: 3px; }
  .extras { display: flex; gap: 8px; flex-wrap: wrap; }
  .extras .chip[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
  .cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .cal .dow { font-size: 11px; font-weight: 700; color: var(--ink-3); text-align: center; padding: 4px 0; }
  .cal button { aspect-ratio: 1 / 1.05; max-width: 100%; border-radius: 12px; background: var(--surface); display: grid; align-content: start; justify-items: center; gap: 2px; padding-top: 6px; font-family: var(--font-display); font-weight: 700; font-size: 14px; position: relative; }
  .cal button.out { opacity: .35; }
  .cal button.today { box-shadow: inset 0 0 0 2px var(--ink); }
  .cal button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
  .cal button .n { font-size: 10.5px; font-weight: 700; color: var(--ink-3); }
  .cal button[aria-pressed="true"] .n { color: inherit; opacity: .75; }
  .cal button .w { position: absolute; top: 5px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--down); }
  .cal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .cal-head b { font-size: 18px; font-weight: 900; }
  .cal-head button { width: 38px; height: 38px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; }
  .gl { background: var(--surface); border-radius: var(--r-md); padding: 14px 16px; display: grid; gap: 6px; }
  .gl .w { font-weight: 900; font-size: 16px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .gl .w span { font-size: 11px; font-weight: 700; color: var(--ink-3); white-space: nowrap; }
  .gl .f { font-family: var(--font-display); font-size: 12.5px; background: var(--bg); border-radius: 8px; padding: 6px 10px; color: var(--ink-2); }
  .gl p { margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.7; }
  .gl p b { color: var(--ink); }
  .note-card { background: var(--surface); border-radius: var(--r-md); padding: 14px 16px; display: grid; gap: 6px; width: 100%; text-align: left; }
  .note-card .top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .note-card b { font-size: 15px; font-weight: 900; }
  .note-card .st { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 2px 9px; background: var(--ink); color: var(--bg); white-space: nowrap; }
  .note-card .sub2 { font-size: 12px; color: var(--ink-3); }
  .stars { display: inline-flex; gap: 2px; }
  .stars button { font-size: 22px; line-height: 1; color: var(--tile); padding: 2px; }
  .stars button.on { color: var(--ink); }
  .es { background: var(--bg); border-radius: var(--r-md); padding: 12px; display: grid; gap: 8px; }
  .es .cnt { font-size: 11.5px; color: var(--ink-3); justify-self: end; font-family: var(--font-display); }
  .es .cnt.over { color: var(--down); font-weight: 700; }
  .dl-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; font-size: 13.5px; }
  .dl-row .x { width: 32px; height: 32px; border-radius: 50%; background: var(--bg); display: grid; place-items: center; }
  .badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--down); color: #fff; font-size: 11px; font-weight: 800; font-family: var(--font-display); margin-left: 6px; vertical-align: 2px; }
  `;
  document.head.appendChild(st);

  // ---------- page shell ----------
  const page = document.createElement("div");
  page.className = "page"; page.id = "page"; page.hidden = true;
  page.setAttribute("role", "dialog"); page.setAttribute("aria-modal", "true");
  page.innerHTML = `<div class="page-inner"><div class="page-head"><button id="pageBack" aria-label="戻る">${ic("arrow", "ic")}</button><h1 id="pageTitle"></h1><span class="sp"></span></div><div id="pageBody"></div></div>`;
  document.body.appendChild(page);
  $("#pageBack svg", page).style.transform = "rotate(180deg)";
  let pageName = null, pushed = false;
  function openPage(name, { fromPop = false } = {}) {
    if (!PAGES[name]) return;
    const wasOpen = !!pageName;
    pageName = name;
    if (typeof closeMenu === "function" && menu.classList.contains("open")) closeMenu();
    page.hidden = false; page.scrollTop = 0; document.body.classList.add("locked");
    $("#pageTitle").textContent = PAGES[name];
    if (!fromPop && location.hash.slice(1) !== name) {
      if (wasOpen) history.replaceState(null, "", "#" + name);  // 画面から画面へは履歴を積まない
      else { history.pushState(null, "", "#" + name); pushed = true; }
    }
    RENDER[name]();
  }
  function closePage(fromPop) {
    if (page.hidden) return;
    page.hidden = true; pageName = null;
    if (!$("#sheetRoot").firstChild) document.body.classList.remove("locked");
    if (current === "home") document.body.classList.add("on-home");
    if (!fromPop) { if (pushed) { pushed = false; history.back(); } else history.replaceState(null, "", "#" + (current || "home")); }
    updateBadges();
  }
  $("#pageBack").addEventListener("click", () => closePage(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !e.defaultPrevented && !page.hidden && !$("#sheetRoot").firstChild) closePage(false); });
  const body = () => $("#pageBody");

  // ---------- helpers ----------
  const coName = code => {
    const cur = CURATED_BY_CODE[code]; if (cur) return cur.name;
    const li = LISTED && LISTED.list.find(r => r[0] === code); if (li) return li[1];
    const f = FIN && FIN.items[code]; return f ? f.n : code;
  };
  const latestEntry = code => {
    const f = FIN && FIN.items[code]; if (!f) return null;
    if (f.q && (!f.a || f.q.d >= f.a.d)) return f.q;
    return f.a || f.q || null;
  };
  const periodLabel = e => `${e.p || ""}${e.q ? " " + e.q : " 通期"}`;
  function yoyTag(cur, prev) {
    const t = yoyText(prev, cur);
    return t.t === "—" ? "" : `<i class="${t.cls}">前年比 ${t.t}</i>`;
  }
  function finBlockHTML(code) {
    const e = latestEntry(code); if (!e) return "";
    const p = e.prev || {}, fc = e.fc || {};
    const cell = (label, k) => e[k] == null ? "" : `<div><span>${label}</span><b>${fmtOku(e[k])}</b>${yoyTag(e[k], p[k])}${e.q && fc[k] ? `<i class="muted">通期予想の${Math.round(e[k] / fc[k] * 100)}%</i><span class="prog"><i style="width:${Math.max(0, Math.min(100, e[k] / fc[k] * 100)).toFixed(0)}%"></i></span>` : ""}</div>`;
    const fcLine = !e.q && (fc.rev != null || fc.op != null || fc.np != null)
      ? `<span class="note">来期の会社予想：${[["売上", fc.rev], ["営業利益", fc.op], ["純利益", fc.np]].filter(x => x[1] != null).map(x => `${x[0]} ${fmtOku(x[1])}`).join("、")}</span>` : "";
    return `<div class="finbox">
      <div class="h"><b>最新の決算短信（自動取得）</b><span>${esc(periodLabel(e))} · ${esc(e.d)} 発表 · ${esc(e.std || "")}</span></div>
      <div class="g">${cell(e.q ? "売上（累計）" : "売上", "rev")}${cell(e.q ? "営業利益（累計）" : "営業利益", "op")}${e.op == null ? cell("経常利益", "ord") : ""}${cell("純利益", "np")}</div>
      ${fcLine}
      ${e.url ? `<a class="link" href="${esc(e.url)}" target="_blank" rel="noopener">決算短信（PDF）を開く ${ic("ext", "ic ic-sm")}</a>` : ""}
    </div>`;
  }
  function extrasHTML(code, name) {
    if (!code) return "";
    const w = watch.has(code), n = notes[code];
    return `<div class="extras"><button class="chip" data-watch="${esc(code)}" aria-pressed="${w}">${w ? "★ ウォッチ中" : "☆ ウォッチ（決算アラート）"}</button>
      <button class="chip" data-note="${esc(code)}" data-name="${esc(name || "")}">${ic("pen", "ic ic-sm")}${n ? "就活メモを開く" : "就活メモを作る"}</button></div>`;
  }
  function toggleWatch(code) {
    if (watch.has(code)) watch.delete(code); else watch.add(code);
    saveWatch();
    $$(`[data-watch="${CSS.escape(code)}"]`).forEach(b => { const w = watch.has(code); b.setAttribute("aria-pressed", w); b.textContent = w ? "★ ウォッチ中" : "☆ ウォッチ（決算アラート）"; });
    toast(watch.has(code) ? `${coName(code)}をウォッチに追加しました` : "ウォッチを外しました");
    updateBadges();
    if (pageName === "alerts") RENDER.alerts();
  }
  document.addEventListener("click", e => {
    const w = e.target.closest("[data-watch]"); if (w) { toggleWatch(w.dataset.watch); return; }
    const n = e.target.closest("[data-note]"); if (n) { openNote(n.dataset.note, n.dataset.name); }
  });

  // ---------- badges (new results for watched companies) ----------
  function newForWatch() {
    if (!FIN) return [];
    const seen = store.get("alertsSeen", "");
    return FIN.recent.filter(r => watch.has(r.c) && (r.d + " " + r.t) > seen);
  }
  function updateBadges() {
    const n = newForWatch().length;
    const mi = $('#menuNow [data-mi-name="alerts"] .t');
    if (mi) mi.innerHTML = `決算アラート${n ? `<span class="badge">${n}</span>` : ""}`;
  }

  // ---------- 全社の決算 ----------
  let rf = { kind: "all", watch: false, q: "", shown: 80 };
  const RENDER = {
    results() {
      if (!FIN) { body().innerHTML = `<div class="empty">決算データはまだ取得されていません。GitHub Actions が東証の適時開示（TDnet）から1日5回、自動で取り込みます。</div>`; return; }
      const nq = rf.q ? normq(rf.q) : "";
      const list = FIN.recent.filter(r => (rf.kind === "all" || (rf.kind === "a" ? r.k === "通期" : r.k !== "通期")) && (!rf.watch || watch.has(r.c)) && (!nq || normq(r.n).includes(nq) || r.c.startsWith(nq)));
      const b = new Date(FIN.built);
      body().innerHTML = `<div class="form">
        <p class="sub">東証の適時開示（TDnet）に出た決算短信を自動で集めています。収録 <b class="num">${Object.keys(FIN.items).length.toLocaleString("ja-JP")}</b> 社 · ${b.getMonth() + 1}/${b.getDate()} ${String(b.getHours()).padStart(2, "0")}:${String(b.getMinutes()).padStart(2, "0")} 更新（1日5回）</p>
        <div class="search">${ic("search")}<input class="input" id="rfQ" type="search" placeholder="社名・証券コード" value="${esc(rf.q)}" aria-label="社名・証券コードで絞り込む"></div>
        <div class="chips">
          ${[["all", "すべて"], ["a", "通期"], ["q", "四半期"]].map(([k, l]) => `<button class="chip" aria-pressed="${rf.kind === k}" data-rk="${k}">${l}</button>`).join("")}
          <button class="chip" aria-pressed="${rf.watch}" data-rw="1">★ ウォッチ中だけ</button>
        </div>
        <div class="co-rows">${list.slice(0, rf.shown).map(rowHTML).join("") || `<div class="empty">条件に合う決算はありません</div>`}</div>
        ${list.length > rf.shown ? `<button class="btn ghost sm" id="rfMore">さらに表示（残り${list.length - rf.shown}件）</button>` : ""}
        <p class="note">数値は決算短信の1ページ目（サマリー）のXBRLから自動で読み取った概数（億円）。読み取れなかった決算は「数値なし」と表示します。正確な数値は決算短信のPDFで確認してください。</p>
      </div>`;
      const q = $("#rfQ"); if (rf.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    },
    alerts() {
      const seen = store.get("alertsSeen", "");
      const codes = [...watch];
      const recent = FIN ? FIN.recent.filter(r => watch.has(r.c)).slice(0, 40) : [];
      const t = todayISO();
      const announced = new Set(FIN ? FIN.recent.map(r => r.c + r.d) : []);
      const upcoming = CAL ? CAL.items.filter(r => watch.has(r[1]) && r[0] >= t && !announced.has(r[1] + r[0])).slice(0, 30) : [];
      body().innerHTML = `<div class="form">
        <p class="sub">ウォッチしている企業の決算が出ると、ここに表示されます。企業の説明画面の「☆ ウォッチ」で追加できます。</p>
        <div class="section-head"><h2 class="h2">ウォッチ中（${codes.length}社）</h2><button class="link" id="alAdd">＋ 企業を追加</button></div>
        <div class="chips">${codes.map(c => `<button class="chip" data-open="${esc(c)}">${esc(coName(c))}</button>`).join("") || `<span class="muted" style="font-size:13px">まだありません</span>`}</div>
        <div id="alSearch"></div>
        <div class="section-head" style="margin-top:12px"><h2 class="h2">新しい決算</h2></div>
        <div class="co-rows">${recent.map(r => rowHTML(r, (r.d + " " + r.t) > seen)).join("") || `<div class="empty">${FIN ? "ウォッチ中の企業の決算はまだありません" : "決算データはまだ取得されていません"}</div>`}</div>
        <div class="section-head" style="margin-top:12px"><h2 class="h2">これからの決算発表</h2></div>
        <div class="co-rows">${upcoming.map(r => `<button class="co-row" data-open="${esc(r[1])}"><span class="code">${esc(r[0].slice(5).replace("-", "/"))}</span><span class="nm">${esc(r[2] || coName(r[1]))}<small>${esc([r[4], r[3]].filter(Boolean).join(" · "))}</small></span><span class="mk">${esc(r[1])}</span></button>`).join("") || `<div class="empty">${CAL ? "予定はまだ出ていません" : "決算発表予定日はまだ取得されていません"}</div>`}</div>
        <div class="card" style="display:grid;gap:8px">
          <b>iPhoneで毎日お知らせを受け取る</b>
          <p class="note" style="font-size:13px">「ショートカット」アプリ →「オートメーション」→「＋」→「時刻」で毎日 17:45 を選び、アクション「URLを開く」に下のURLを入れると、決算が多く出る夕方にこの画面が自動で開きます。</p>
          <code class="codebox" id="alUrl">${esc(APP_URL)}#alerts</code>
          <button class="btn ghost sm" id="alCopy">URLをコピー</button>
        </div>
      </div>`;
      if (FIN) store.set("alertsSeen", FIN.recent.length ? FIN.recent[0].d + " " + FIN.recent[0].t : "");
      updateBadges();
    },
    calendar() { renderCalendar(); },
    glossary() { renderGlossary(); },
    notes() { renderNotes(); }
  };
  function rowHTML(r, isNew) {
    const f = FIN && FIN.items[r.c];
    const e = f && ((f.q && f.q.d === r.d) ? f.q : (f.a && f.a.d === r.d) ? f.a : null);
    const p = e && e.prev || {};
    const v = (label, k) => e && e[k] != null ? `${label} ${fmtOku(e[k])}<small class="${yoyText(p[k], e[k]).cls}">${yoyText(p[k], e[k]).t}</small>` : "";
    const vals = e ? (v("売上", "rev") || v("経常", "ord")) + (e.op != null ? v("営業益", "op") : v("純利益", "np")) : `<small class="muted">数値なし</small>`;
    return `<button class="fin-row" data-open="${esc(r.c)}"><span class="nm">${esc(coName(r.c))}<span class="kind ${isNew ? "new" : ""}">${isNew ? "NEW · " : ""}${esc(r.k)}</span></span>
      <span class="vals">${vals}</span>
      <span class="meta">${esc(r.c)} · ${esc(r.d.slice(5).replace("-", "/"))} ${esc(r.t)} · ${esc((r.title || "").replace(/〔.*?〕|\(.*?\)|（.*?）/g, "").slice(0, 28))}</span></button>`;
  }
  // events inside pages
  page.addEventListener("click", e => {
    const o = e.target.closest("[data-open]"); if (o) { openListedCompany(o.dataset.open); return; }
    const rk = e.target.closest("[data-rk]"); if (rk) { rf.kind = rk.dataset.rk; rf.shown = 80; RENDER.results(); return; }
    if (e.target.closest("[data-rw]")) { rf.watch = !rf.watch; rf.shown = 80; RENDER.results(); return; }
    if (e.target.closest("#rfMore")) { rf.shown += 120; RENDER.results(); return; }
    if (e.target.closest("#alAdd")) { addSearch("#alSearch", code => { if (!watch.has(code)) toggleWatch(code); }); return; }
    if (e.target.closest("#alCopy")) { copyText($("#alUrl").textContent, $("#alUrl")); return; }
  });
  let rfTimer;
  page.addEventListener("input", e => {
    if (e.target.id === "rfQ") { clearTimeout(rfTimer); rfTimer = setTimeout(() => { rf.q = e.target.value; rf.shown = 80; RENDER.results(); }, 250); }
  });
  function copyText(t, el) {
    navigator.clipboard.writeText(t).then(() => toast("コピーしました")).catch(() => {
      const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("選択しました。コピーしてください");
    });
  }
  // a small company search used by alerts and notes
  function addSearch(sel, onPick) {
    const box = $(sel); if (!box) return;
    box.innerHTML = `<div class="search" style="margin-top:8px">${ic("search")}<input class="input" id="asQ" type="search" placeholder="社名・証券コードで検索" aria-label="追加する企業を検索"></div><div class="co-rows" id="asList" style="margin-top:8px"></div>`;
    const q = $("#asQ", box); q.focus();
    q.addEventListener("input", () => {
      const nq = normq(q.value.trim());
      const src = LISTED ? LISTED.list : INDUSTRIES.flatMap(i => i.companies.map(c => [c.code, c.name, ""]));
      const hits = nq ? src.filter(r => r[0].startsWith(nq) || normq(r[1]).includes(nq))
        .sort((a, b) => (!!CURATED_BY_CODE[b[0]] - !!CURATED_BY_CODE[a[0]]) || (normq(b[1]).startsWith(nq) - normq(a[1]).startsWith(nq)) || a[1].length - b[1].length).slice(0, 12) : [];
      $("#asList", box).innerHTML = hits.map(r => `<button class="co-row" data-pick="${esc(r[0])}"><span class="code">${esc(r[0])}</span><span class="nm">${esc(r[1])}</span><span class="mk">追加</span></button>`).join("");
    });
    box.onclick = e => { const p = e.target.closest("[data-pick]"); if (p) { e.stopPropagation(); onPick(p.dataset.pick, coName(p.dataset.pick)); box.innerHTML = ""; } };
  }

  // ---------- 決算カレンダー ----------
  let calMonth = null, calDay = null, calFilter = "all";
  function calEvents() {
    const ev = {};
    const add = (d, item) => (ev[d] = ev[d] || []).push(item);
    // 発表済みを先に入れて、同じ日の「予定」より優先する
    if (FIN) FIN.recent.forEach(r => add(r.d, { code: r.c, name: coName(r.c), sub: `${r.k} · ${r.t} 発表済み`, done: true }));
    if (CAL) CAL.items.forEach(r => add(r[0], { code: r[1], name: r[2] || coName(r[1]), sub: [r[4] === "-" ? "" : r[4], r[3] ? r[3].replace(/-/g, "/") + " 期末" : ""].filter(Boolean).join(" · "), done: false }));
    const keep = x => calFilter === "all" || (calFilter === "watch" ? watch.has(x.code) : !!CURATED_BY_CODE[x.code]);
    Object.keys(ev).forEach(d => {
      const seenCodes = new Set();
      ev[d] = ev[d].filter(x => keep(x) && !seenCodes.has(x.code) && seenCodes.add(x.code)).sort((a, b) => (watch.has(b.code) - watch.has(a.code)) || (!!CURATED_BY_CODE[b.code] - !!CURATED_BY_CODE[a.code]));
      if (!ev[d].length) delete ev[d];
    });
    return ev;
  }
  function renderCalendar() {
    const t = todayISO();
    if (!calMonth) calMonth = t.slice(0, 7);
    const ev = calEvents();
    if (!calDay) calDay = ev[t] ? t : (Object.keys(ev).filter(d => d >= t).sort()[0] || t);
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1), start = new Date(y, m - 1, 1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = ev[iso] || [];
      cells.push(`<button class="${d.getMonth() !== m - 1 ? "out" : ""} ${iso === t ? "today" : ""}" aria-pressed="${iso === calDay}" data-day="${iso}" aria-label="${iso} ${list.length}件">${d.getDate()}${list.length ? `<span class="n">${list.length}</span>` : ""}${list.some(x => watch.has(x.code)) ? `<span class="w"></span>` : ""}</button>`);
      if (i >= 34 && d.getMonth() !== m - 1 && d.getDay() === 6) break;
    }
    const dayList = ev[calDay] || [];
    body().innerHTML = `<div class="form">
      <p class="sub">これからの決算発表予定日（日本取引所グループ公表）と、発表済みの決算短信をまとめています。赤い点はウォッチ中の企業がある日。</p>
      <div class="chips">${[["all", "すべて"], ["watch", "★ ウォッチ中"], ["deep", "詳しく見る企業"]].map(([k, l]) => `<button class="chip" aria-pressed="${calFilter === k}" data-cf="${k}">${l}</button>`).join("")}</div>
      <div class="card" style="display:grid;gap:10px">
        <div class="cal-head"><button data-cm="-1" aria-label="前の月">${ic("arrow", "ic ic-sm").replace("<svg", '<svg style="transform:rotate(180deg)"')}</button><b>${y}年${m}月</b><button data-cm="1" aria-label="次の月">${ic("arrow", "ic ic-sm")}</button></div>
        <div class="cal">${"日月火水木金土".split("").map(w => `<span class="dow">${w}</span>`).join("")}${cells.join("")}</div>
      </div>
      <div class="section-head"><h2 class="h2">${+calDay.slice(5, 7)}月${+calDay.slice(8)}日の決算</h2><span class="note">${dayList.length}社</span></div>
      <div class="co-rows">${dayList.slice(0, 150).map(x => `<button class="co-row" data-open="${esc(x.code)}"><span class="code">${esc(x.code)}</span><span class="nm">${esc(x.name)}${watch.has(x.code) ? `<span class="star">★</span>` : ""}<small>${esc(x.sub)}</small></span><span class="mk">${x.done ? "発表済み" : "予定"}</span></button>`).join("") || `<div class="empty">${CAL || FIN ? "この日の決算はありません" : "決算発表予定日はまだ取得されていません。GitHub Actions が自動で取り込みます。"}</div>`}</div>
      ${dayList.length > 150 ? `<p class="note">ほか${dayList.length - 150}社</p>` : ""}
    </div>`;
  }
  page.addEventListener("click", e => {
    if (pageName !== "calendar") return;
    const d = e.target.closest("[data-day]"); if (d) { calDay = d.dataset.day; if (calDay.slice(0, 7) !== calMonth) calMonth = calDay.slice(0, 7); renderCalendar(); return; }
    const cm = e.target.closest("[data-cm]"); if (cm) { const [y, m] = calMonth.split("-").map(Number); const nd = new Date(y, m - 1 + (+cm.dataset.cm), 1); calMonth = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`; calDay = calMonth + "-01"; renderCalendar(); return; }
    const cf = e.target.closest("[data-cf]"); if (cf) { calFilter = cf.dataset.cf; renderCalendar(); }
  });

  // ---------- 用語集 ----------
  let gq = "", gcat = "all";
  function renderGlossary() {
    const cats = [...new Set(GLOSS.map(g => g.cat))];
    const nq = gq ? normq(gq) : "";
    const list = GLOSS.filter(g => (gcat === "all" || g.cat === gcat) && (!nq || normq(g.w + g.d + g.f).includes(nq)));
    body().innerHTML = `<div class="form">
      <p class="sub">決算書や企業研究でよく出てくる言葉を、式と例つきで解説しています（${GLOSS.length}語）。</p>
      <div class="search">${ic("search")}<input class="input" id="gQ" type="search" placeholder="例：ROE、営業利益率" value="${esc(gq)}" aria-label="用語を検索"></div>
      <div class="ind-nav">${[["all", "すべて"], ...cats.map(c => [c, c])].map(([k, l]) => `<button class="chip" aria-pressed="${gcat === k}" data-gc="${esc(k)}">${esc(l)}</button>`).join("")}</div>
      ${list.map(g => `<article class="gl"><div class="w">${esc(g.w)}<span>${esc(g.cat)}</span></div><div class="f">${esc(g.f)}</div><p>${esc(g.d)}</p>${g.ex ? `<p><b>例：</b>${esc(g.ex)}</p>` : ""}${g.tip ? `<p><b>企業研究では：</b>${esc(g.tip)}</p>` : ""}</article>`).join("") || `<div class="empty">「${esc(gq)}」に一致する用語はありません</div>`}
    </div>`;
    const q = $("#gQ"); if (gq) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  let gTimer;
  page.addEventListener("input", e => { if (e.target.id === "gQ") { clearTimeout(gTimer); gTimer = setTimeout(() => { gq = e.target.value; renderGlossary(); }, 200); } });
  page.addEventListener("click", e => { const c = e.target.closest("[data-gc]"); if (c && pageName === "glossary") { gcat = c.dataset.gc; renderGlossary(); } });

  // ---------- 就活メモ・ES管理 ----------
  function noteOf(code, name) {
    if (!notes[code]) notes[code] = { name: name || coName(code), status: STATUS[0], prio: 3, memo: "", es: [], dl: [], updated: Date.now() };
    return notes[code];
  }
  function nextDeadline(n) {
    const t = todayISO();
    return (n.dl || []).filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  }
  function renderNotes() {
    const list = Object.entries(notes).sort((a, b) => (b[1].prio - a[1].prio) || (b[1].updated - a[1].updated));
    body().innerHTML = `<div class="form">
      <p class="sub">企業ごとに、選考状況・志望度・メモ・締め切り・ESの下書きを保存できます。データはこの端末のブラウザ内だけに保存されます。</p>
      <button class="btn" id="nAdd">＋ 企業を追加</button>
      <div id="nSearch"></div>
      ${list.map(([code, n]) => { const dl = nextDeadline(n); return `<button class="note-card" data-note="${esc(code)}"><span class="top"><b>${esc(n.name)}</b><span class="st">${esc(n.status)}</span></span>
        <span class="sub2">${"★".repeat(n.prio)}${"☆".repeat(5 - n.prio)} · ES ${n.es.length}件${dl ? ` · 次の締め切り ${esc(dl.date.slice(5).replace("-", "/"))} ${esc(dl.label)}` : ""}</span>
        ${n.memo ? `<span class="sub2" style="color:var(--ink-2)">${esc(n.memo.slice(0, 60))}${n.memo.length > 60 ? "…" : ""}</span>` : ""}</button>`; }).join("") || `<div class="empty">まだメモはありません。「＋ 企業を追加」か、企業の説明画面の「就活メモを作る」から始められます。</div>`}
      <div class="card" style="display:grid;gap:8px">
        <b>バックアップ</b>
        <p class="note" style="font-size:13px">別の端末に移すときや、念のための保存に使えます。</p>
        <div class="chips"><button class="chip" id="nExport">メモをコピー（書き出し）</button><button class="chip" id="nImport">貼り付けて読み込む</button></div>
      </div>
    </div>`;
  }
  page.addEventListener("click", e => {
    if (pageName !== "notes") return;
    if (e.target.closest("#nAdd")) { addSearch("#nSearch", (code, name) => openNote(code, name)); return; }
    if (e.target.closest("#nExport")) {
      const t = JSON.stringify({ app: "gyoukai-notes", v: 1, notes });
      navigator.clipboard.writeText(t).then(() => toast("メモをコピーしました。メモ帳などに保存してください")).catch(() => toast("コピーできませんでした"));
      return;
    }
    if (e.target.closest("#nImport")) {
      openSheet(`<span class="grabber" aria-hidden="true"></span><div class="sheet-head"><h2 class="h2">メモを読み込む</h2><button data-close aria-label="閉じる">${ic("x")}</button></div>
        <div class="form"><textarea class="input" id="impT" placeholder="書き出したテキストを貼り付け" aria-label="書き出したテキスト"></textarea><button class="btn" id="impGo">読み込む（同じ企業は上書き）</button></div>`, root => {
        $("#impGo", root).addEventListener("click", () => {
          try {
            const d = JSON.parse($("#impT", root).value);
            if (!d || d.app !== "gyoukai-notes" || typeof d.notes !== "object") throw new Error("format");
            Object.assign(notes, d.notes); saveNotes(); closeSheet(); renderNotes(); toast(`${Object.keys(d.notes).length}社のメモを読み込みました`);
          } catch (err) { toast("読み込めませんでした。書き出したテキストをそのまま貼り付けてください"); }
        });
      });
    }
  });
  function openNote(code, name) {
    const n = noteOf(code, name); saveNotes();
    const esHTML = () => n.es.map((q, i) => `<div class="es" data-es="${i}">
        <input class="input" data-esq="${i}" value="${esc(q.q)}" placeholder="設問（例：学生時代に力を入れたこと）" aria-label="設問">
        <div class="row" style="display:flex;gap:8px;align-items:center"><label class="note" for="esl${i}">字数制限</label><input class="input" id="esl${i}" data-esl="${i}" type="number" inputmode="numeric" min="0" value="${q.limit || ""}" style="width:110px" aria-label="字数制限"><button class="chip" data-esdel="${i}" style="margin-left:auto">削除</button></div>
        <textarea class="input" data-esa="${i}" placeholder="回答の下書き" aria-label="回答">${esc(q.a)}</textarea>
        <span class="cnt ${q.limit && q.a.length > q.limit ? "over" : ""}" data-escnt="${i}">${q.a.length}${q.limit ? ` / ${q.limit}` : ""}字</span></div>`).join("");
    const dlHTML = () => (n.dl || []).slice().sort((a, b) => a.date.localeCompare(b.date)).map(d => `<div class="dl-row"><span>${esc(d.label)}</span><span class="num">${esc(d.date.replace(/-/g, "/"))}</span><button class="x" data-dldel="${esc(d.id)}" aria-label="締め切りを削除">${ic("x", "ic ic-sm")}</button></div>`).join("") || `<span class="note">締め切りはまだありません</span>`;
    openSheet(`<span class="grabber" aria-hidden="true"></span>
      <div class="sheet-head"><div><span class="eyebrow">就活メモ</span><h2 class="h2">${esc(n.name)}</h2></div><button data-close aria-label="閉じる">${ic("x")}</button></div>
      <div class="form" id="noteForm">
        <div class="field"><label for="nSt">選考状況</label><select class="input" id="nSt">${STATUS.map(s => `<option ${s === n.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><span class="lbl">志望度</span><span class="stars" id="nPr">${[1, 2, 3, 4, 5].map(i => `<button data-pr="${i}" class="${i <= n.prio ? "on" : ""}" aria-label="志望度${i}">★</button>`).join("")}</span></div>
        <div class="field"><label for="nMemo">メモ</label><textarea class="input" id="nMemo" placeholder="志望動機の種、説明会で聞いたこと、気になる数字など">${esc(n.memo)}</textarea></div>
        <div class="field"><span class="lbl">締め切り</span><div id="nDl" style="display:grid;gap:8px">${dlHTML()}</div>
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px"><input class="input" id="dlL" placeholder="例：ES提出" aria-label="締め切りの内容"><input class="input" id="dlD" type="date" aria-label="締め切り日" style="width:150px"><button class="btn sm" id="dlAdd">追加</button></div></div>
        <div class="field"><span class="lbl">ES（エントリーシート）</span><div id="nEs" style="display:grid;gap:10px">${esHTML()}</div><button class="chip" id="esAdd" style="justify-self:start">＋ 設問を追加</button></div>
        <div class="chips"><button class="chip" data-watch="${esc(code)}" aria-pressed="${watch.has(code)}">${watch.has(code) ? "★ ウォッチ中" : "☆ ウォッチ（決算アラート）"}</button><button class="chip" data-open-co="${esc(code)}">企業の説明を見る</button><button class="chip" id="nDel">このメモを削除</button></div>
        <p class="note">入力した内容は自動で保存されます。</p>
      </div>`, root => {
      const touch = () => { n.updated = Date.now(); saveNotes(); };
      $("#nSt", root).addEventListener("change", e => { n.status = e.target.value; touch(); });
      $("#nMemo", root).addEventListener("input", e => { n.memo = e.target.value; touch(); });
      $("#nPr", root).addEventListener("click", e => { const b = e.target.closest("[data-pr]"); if (!b) return; n.prio = +b.dataset.pr; $$("#nPr button", root).forEach(x => x.classList.toggle("on", +x.dataset.pr <= n.prio)); touch(); });
      $("#dlAdd", root).addEventListener("click", () => {
        const label = $("#dlL", root).value.trim(), date = $("#dlD", root).value;
        if (!label || !date) { toast("内容と日付を入れてください"); return; }
        (n.dl = n.dl || []).push({ id: "d" + Date.now(), label, date }); touch();
        $("#nDl", root).innerHTML = dlHTML(); $("#dlL", root).value = ""; $("#dlD", root).value = "";
      });
      $("#nDl", root).addEventListener("click", e => { const b = e.target.closest("[data-dldel]"); if (!b) return; n.dl = n.dl.filter(d => d.id !== b.dataset.dldel); touch(); $("#nDl", root).innerHTML = dlHTML(); });
      $("#esAdd", root).addEventListener("click", () => { n.es.push({ q: "", a: "", limit: 400 }); touch(); $("#nEs", root).innerHTML = esHTML(); });
      $("#nEs", root).addEventListener("input", e => {
        const t = e.target, i = +(t.dataset.esq ?? t.dataset.esa ?? t.dataset.esl);
        if (isNaN(i) || !n.es[i]) return;
        if (t.dataset.esq != null) n.es[i].q = t.value;
        if (t.dataset.esa != null) n.es[i].a = t.value;
        if (t.dataset.esl != null) n.es[i].limit = Math.max(0, parseInt(t.value || "0", 10)) || 0;
        const q = n.es[i], c = $(`[data-escnt="${i}"]`, root);
        c.textContent = `${q.a.length}${q.limit ? ` / ${q.limit}` : ""}字`; c.classList.toggle("over", !!q.limit && q.a.length > q.limit);
        touch();
      });
      $("#nEs", root).addEventListener("click", e => { const b = e.target.closest("[data-esdel]"); if (!b) return; n.es.splice(+b.dataset.esdel, 1); touch(); $("#nEs", root).innerHTML = esHTML(); });
      $("[data-open-co]", root).addEventListener("click", () => { closeSheet(); openListedCompany(code); });
      $("#nDel", root).addEventListener("click", e => {
        const b = e.currentTarget;
        if (b.dataset.armed) { delete notes[code]; saveNotes(); closeSheet(); if (pageName === "notes") renderNotes(); toast("メモを削除しました"); return; }
        b.dataset.armed = "1"; b.textContent = "もう一度押すと削除します";
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(root.firstChild) || !root.firstChild) { obs.disconnect(); if (pageName === "notes") renderNotes(); } });
      obs.observe(root, { childList: true });
    });
  }

  // ---------- public ----------
  window.GK = { PAGES: Object.keys(PAGES), openPage, closePage, finBlockHTML, extrasHTML, updateBadges, hasFin: code => !!(FIN && FIN.items[code]), finInfo: FIN };
  updateBadges();
  const h = location.hash.slice(1);
  if (PAGES[h]) openPage(h, { fromPop: true });
})();
