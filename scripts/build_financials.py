"""東証の適時開示（TDnet）に出た決算短信のXBRLから、全上場企業の最新決算を集めて data/financials.js に書き出す。

- TDnet の開示一覧（直近約1か月分）から「決算短信」を探し、XBRL（zip）のサマリー部分を読む
- 前回の data/financials.js に積み上げるので、決算期ごとに全社がそろっていく
- APIキーは不要。GitHub Actions から1日に数回実行される。手元では `python scripts/build_financials.py`
"""
import datetime
import html
import io
import json
import pathlib
import re
import time
import urllib.error
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "financials.js"
BASE = "https://www.release.tdnet.info/inbs/"
JST = datetime.timezone(datetime.timedelta(hours=9))
UA = {"User-Agent": "Mozilla/5.0 (gyoukai-data-bot; +https://github.com/weakestandstrongest-sketch/gyoukai)"}
MAX_ZIPS = 600          # 1回の実行で読むXBRLの上限
RECENT_KEEP = 600       # 「決算速報」に残す件数

# 勘定科目（サマリーの要素名）→ 項目
PATTERNS = {
    "rev": re.compile(r"^(NetSales|Sales|Revenue|Revenues|OperatingRevenues?|GrossOperatingRevenues?|OrdinaryRevenues?|NetSalesOfCompletedConstructionContracts|TotalOperatingRevenues?)(IFRS|US|JMIS)?$"),
    "op": re.compile(r"^(OperatingIncome|OperatingProfit)(IFRS|US|JMIS)?$"),
    "ord": re.compile(r"^OrdinaryIncome$"),
    "np": re.compile(r"^(ProfitAttributableToOwnersOfParent|NetIncomeAttributableToOwnersOfParent|NetIncome|Profit)(IFRS|US|JMIS)?$"),
}


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as res:
                return res.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if i == tries - 1:
                raise
        except Exception:
            if i == tries - 1:
                raise
        time.sleep(3 * (i + 1))


def cell(row, cls):
    m = re.search(r'<td[^>]*class="[^"]*' + cls + r'[^"]*"[^>]*>(.*?)</td>', row, re.S)
    return m.group(1) if m else ""


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def list_day(day):
    """その日の開示一覧（全ページ）"""
    out = []
    for page in range(1, 40):
        raw = get(f"{BASE}I_list_{page:03d}_{day:%Y%m%d}.html")
        if not raw:
            break
        page_html = raw.decode("utf-8", "replace")
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", page_html, re.S)
        found = 0
        for r in rows:
            code = text(cell(r, "kjCode"))
            if not code:
                continue
            found += 1
            t = cell(r, "kjTitle")
            x = cell(r, "kjXbrl")
            pdf = re.search(r'href="([^"]+)"', t)
            zipl = re.search(r'href="([^"]+\.zip)"', x)
            out.append({
                "code": code[:4], "name": text(cell(r, "kjName")), "title": text(t),
                "time": text(cell(r, "kjTime")), "date": day.isoformat(),
                "pdf": BASE + pdf.group(1) if pdf else "", "zip": BASE + zipl.group(1) if zipl else "",
            })
        if not found:
            break
    return out


def is_earnings(title):
    return "決算短信" in title and not any(w in title for w in ("訂正", "修正", "一部変更"))


def period_of(title):
    m = re.search(r"(\d{4})年\s*(\d{1,2})月期", title)
    fy = f"{m.group(1)}年{int(m.group(2))}月期" if m else ""
    q = ""
    if "第1四半期" in title:
        q = "第1四半期"
    elif "第2四半期" in title or "中間" in title:
        q = "第2四半期"
    elif "第3四半期" in title:
        q = "第3四半期"
    std = "IFRS" if "IFRS" in title else "米国基準" if "米国" in title else "日本基準"
    return fy, q, std


def to_oku(raw, attrs):
    digits = re.sub(r"[^0-9.]", "", raw)
    if not digits:
        return None
    v = float(digits)
    sc = re.search(r'scale="(-?\d+)"', attrs)
    v *= 10 ** int(sc.group(1)) if sc else 1
    if re.search(r'sign="-"', attrs):
        v = -v
    return round(v / 1e8, 1)


def parse_summary(doc):
    """サマリーのiXBRLから 当期・前期・通期予想 の 売上/営業利益/経常利益/純利益 を取り出す"""
    facts = {}
    for attrs, raw in re.findall(r"<ix:nonFraction([^>]*)>(.*?)</ix:nonFraction>", doc, re.S | re.I):
        name = re.search(r'name="[^:"]*:([^"]+)"', attrs)
        ctx = re.search(r'contextRef="([^"]+)"', attrs)
        if not name or not ctx:
            continue
        local, ctx = name.group(1), ctx.group(1)
        key = next((k for k, p in PATTERNS.items() if p.match(local)), None)
        if not key or "Upper" in ctx or "Lower" in ctx:
            continue
        val = to_oku(text(raw), attrs)
        if val is None:
            continue
        if "Forecast" in ctx:
            if "YearDuration" not in ctx:
                continue
            slot = "fc"
        elif "Result" in ctx or "Duration" in ctx:
            slot = "cur" if ctx.startswith("Current") else "prev" if ctx.startswith("Prior") else None
            if not slot:
                continue
        else:
            continue
        # 連結を優先し、同じ項目が複数あれば先に出たものを使う
        rank = 0 if "NonConsolidated" not in ctx else 1
        cur = facts.setdefault(slot, {}).get(key)
        if cur is None or rank < cur[1]:
            facts[slot][key] = (val, rank)
    return {slot: {k: v[0] for k, v in d.items()} for slot, d in facts.items()}


def read_zip(url):
    raw = get(url)
    if not raw:
        return None
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".htm") and "ixbrl" in n.lower()]
        summary = [n for n in names if "/summary/" in n.lower() or re.search(r"-[aq][a-z]*sm-", n.lower())]
        for n in summary or names[:1]:
            doc = z.read(n).decode("utf-8", "replace")
            parsed = parse_summary(doc)
            if parsed.get("cur"):
                return parsed
        if not getattr(read_zip, "_logged", False):  # 読めなかった最初の1件だけ、中身をログに出す
            read_zip._logged = True
            print("サマリーが見つからないzip:", url, z.namelist()[:12])
            if names:
                doc = z.read((summary or names)[0]).decode("utf-8", "replace")
                print("要素の例:", sorted(set(re.findall(r'name="([^"]+)"', doc)))[:40])
                print("文脈の例:", sorted(set(re.findall(r'contextRef="([^"]+)"', doc)))[:20])
    return None


def load_previous():
    if not OUT.exists():
        return {"items": {}, "recent": []}
    s = OUT.read_text(encoding="utf-8")
    try:
        data = json.loads(s[s.index("=") + 1:].strip().rstrip(";"))
        return data or {"items": {}, "recent": []}
    except Exception:
        return {"items": {}, "recent": []}


def main():
    prev = load_previous()
    items, recent = prev.get("items", {}), prev.get("recent", [])
    done = {r["zip"] for r in recent if r.get("zip")}
    today = datetime.datetime.now(JST).date()
    days = 31 if not items else 4  # 初回は約1か月さかのぼる
    found = []
    for i in range(days):
        day = today - datetime.timedelta(days=i)
        try:
            rows = list_day(day)
        except Exception as e:
            print(f"{day}: 一覧を取得できませんでした {e}")
            continue
        hits = [r for r in rows if is_earnings(r["title"])]
        print(f"{day}: 開示 {len(rows)} 件 / 決算短信 {len(hits)} 件")
        found.extend(hits)

    read = 0
    for r in sorted(found, key=lambda r: (r["date"], r["time"])):
        if not r["zip"] or r["zip"] in done:
            continue
        if read >= MAX_ZIPS:
            break
        read += 1
        try:
            parsed = read_zip(r["zip"])
        except Exception as e:
            print("XBRLを読めませんでした:", r["code"], r["title"], e)
            parsed = None
        fy, q, std = period_of(r["title"])
        entry = {"p": fy, "q": q, "std": std, "d": r["date"], "t": r["time"], "url": r["pdf"]}
        if parsed:
            entry.update({k: v for k, v in parsed.get("cur", {}).items()})
            if parsed.get("prev"):
                entry["prev"] = parsed["prev"]
            if parsed.get("fc"):
                entry["fc"] = parsed["fc"]
        co = items.setdefault(r["code"], {"n": r["name"]})
        co["n"] = r["name"]
        co["q" if q else "a"] = entry
        if not q and co.get("q", {}).get("d", "") < entry["d"]:
            co.pop("q", None)  # 通期決算が出たら、それより古い四半期は消す
        if read <= 2:
            print("例:", r["code"], r["title"], json.dumps(entry, ensure_ascii=False)[:300])
        recent.append({"c": r["code"], "n": r["name"], "title": r["title"], "d": r["date"], "t": r["time"],
                       "url": r["pdf"], "zip": r["zip"], "k": q or "通期", "ok": bool(parsed)})
    recent.sort(key=lambda x: (x["d"], x["t"]), reverse=True)
    recent = recent[:RECENT_KEEP]
    ok = sum(1 for x in recent if x.get("ok"))
    print(f"今回読んだXBRL: {read} 件 / 収録企業: {len(items)} 社 / 速報の数値あり: {ok}/{len(recent)}")
    if not items:
        print("決算データを1件も取得できなかったため、ファイルを書き換えません")
        return
    data = {
        "source": "東京証券取引所 適時開示情報（TDnet）の決算短信XBRL",
        "built": datetime.datetime.now(JST).isoformat(timespec="minutes"),
        "unit": "億円",
        "items": items,
        "recent": recent,
    }
    OUT.write_text("window.GK_FIN = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
