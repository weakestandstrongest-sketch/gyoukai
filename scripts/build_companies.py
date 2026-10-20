"""東証の上場銘柄一覧（JPX公開のExcel）から全上場企業の一覧を作り、data/companies.js に書き出す。
EDINET のコードリスト（金融庁が公開、APIキー不要）から本社所在地と決算日を足す。

GitHub Actions から毎日実行される。手元で実行する場合:
    pip install xlrd==2.0.1 openpyxl==3.1.5
    python scripts/build_companies.py
"""
import csv
import datetime
import io
import json
import pathlib
import re
import unicodedata
import urllib.parse
import urllib.request
import zipfile

PAGE = "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"
UA = {"User-Agent": "Mozilla/5.0 (gyoukai-data-bot)"}
EDINET_CODES = "https://disclosure2dl.edinet-fsa.go.jp/searchdocument/codelist/Edinetcode.zip"
# EDINET の所在地は都道府県が省かれていることが多いので、市区町村→都道府県の表（scripts/cities.json）で補う
CITIES = pathlib.Path(__file__).resolve().parent / "cities.json"
PREFS = ("北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 "
         "山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 "
         "徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県").split()
PREF_RE = re.compile("^(" + "|".join(PREFS) + ")")
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "companies.js"

MARKETS = {
    "プライム（内国株式）": "プライム",
    "スタンダード（内国株式）": "スタンダード",
    "グロース（内国株式）": "グロース",
    "プライム（外国株式）": "プライム",
    "スタンダード（外国株式）": "スタンダード",
    "グロース（外国株式）": "グロース",
}


def cell_str(v):
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.strftime("%Y%m%d")
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else str(v)
    return str(v).strip()


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def read_rows(url, raw):
    """xls / xlsx のどちらで配布されても 1 行ずつ値のリストを返す"""
    if url.lower().endswith(".xlsx"):
        import openpyxl
        ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True).worksheets[0]
        return [list(r) for r in ws.iter_rows(values_only=True)]
    import xlrd
    sh = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)
    return [sh.row_values(i) for i in range(sh.nrows)]


def find_list_url():
    # ファイル名や置き場所が変わることがあるので、案内ページからリンクを探す
    page = get(PAGE).decode("utf-8", "replace")
    links = re.findall(r'href="([^"]+\.xlsx?)"', page)
    if not links:
        raise SystemExit("上場銘柄一覧のファイルが見つかりませんでした: " + PAGE)
    best = next((l for l in links if "data_j" in l), links[0])
    return urllib.parse.urljoin(PAGE, best)


CITY_PREFS = {}   # 市区町村名 → [都道府県名, ...]
CITY_TOWNS = {}   # (都道府県名, 市区町村名) → 町域名のリスト


def load_city_table():
    data = json.loads(CITIES.read_text(encoding="utf-8"))
    CITY_PREFS.update(data["cities"])
    for key, towns in data["towns"].items():
        pref, city = key.split("|")
        CITY_TOWNS[(pref, city)] = towns
    print(f"市区町村の表: {len(CITY_PREFS)} 件")


def guess_pref(addr):
    """都道府県のない住所から（都道府県, 市区町村）を推定する"""
    for n in range(min(12, len(addr)), 1, -1):
        city = addr[:n]
        prefs = CITY_PREFS.get(city)
        if not prefs:
            continue
        if len(prefs) > 1:  # 府中市・伊達市など同名の市は町域名で見分ける
            rest = addr[n:]
            prefs = [p for p in prefs if any(t and rest.startswith(t) for t in CITY_TOWNS.get((p, city), []))] or prefs
        return prefs[0], city
    return "", ""


def split_address(addr):
    """「愛知県豊田市トヨタ町1番地」→（愛知, 豊田市）。都道府県がなければ郵便番号データで補う"""
    addr = unicodedata.normalize("NFKC", addr or "").replace(" ", "").replace("\u3000", "")
    m = PREF_RE.match(addr)
    if not m:
        pref, city = guess_pref(addr)
        if not pref:
            return "", ""
        return (pref if pref == "北海道" else pref[:-1]), city
    pref = m.group(1)
    rest = addr[len(pref):]
    city = ""
    # 政令市の区 → 郡の町村 → 市 → 東京の区・町村 の順に試す
    for pat in (r"^([^区郡]{1,6}?市.{1,5}?区)", r"^(.{1,6}?郡.{1,6}?[町村])", r"^([^区]{1,5}?市)", r"^(.{1,6}?[区町村])"):
        mm = re.match(pat, rest)
        if mm:
            city = mm.group(1)
            if rest[len(city):len(city) + 1] == "市" and not city.endswith("区"):
                city += "市"  # 四日市市・廿日市市など
            break
    short = pref if pref == "北海道" else pref[:-1]
    return short, city


def load_edinet_addresses():
    """証券コード（4桁）→（都道府県, 市区町村, 決算日）。取れなければ空の辞書を返す"""
    try:
        raw = get(EDINET_CODES)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
            text = z.read(name).decode("cp932", "replace")
    except Exception as e:  # 所在地がなくても一覧そのものは作る
        print("EDINETコードリストを取得できませんでした:", e)
        return {}
    rows = list(csv.reader(io.StringIO(text)))
    hi = next((i for i, r in enumerate(rows[:5]) if any("証券コード" in c for c in r)), None)
    if hi is None:
        print("EDINETコードリストの見出し行が見つかりませんでした")
        return {}
    head = [unicodedata.normalize("NFKC", c) for c in rows[hi]]
    ci = {k: next(i for i, h in enumerate(head) if k in h) for k in ("証券コード", "所在地", "決算日")}
    out = {}
    for r in rows[hi + 1:]:
        if len(r) <= max(ci.values()):
            continue
        code = unicodedata.normalize("NFKC", r[ci["証券コード"]]).strip()
        if len(code) != 5:
            continue
        pref, city = split_address(r[ci["所在地"]])
        out[code[:4]] = (pref, city, unicodedata.normalize("NFKC", r[ci["決算日"]]).strip())
    print(f"EDINET: {len(out)} 社の所在地（都道府県を判定できた社: {sum(1 for v in out.values() if v[0])}）")
    for r in rows[hi + 1:hi + 4]:
        print("例:", r[ci["所在地"]], "→", split_address(r[ci["所在地"]]))
    return out


def main():
    url = find_list_url()
    print("download:", url)
    table = read_rows(url, get(url))
    head = [cell_str(v) for v in table[0]]
    col = {name: head.index(name) for name in
           ["日付", "コード", "銘柄名", "市場・商品区分", "33業種コード", "33業種区分", "17業種区分", "規模区分"]}

    sectors, rows, as_of = {}, [], ""
    for v in table[1:]:
        v = ["" if x is None else x for x in v]
        market = MARKETS.get(cell_str(v[col["市場・商品区分"]]))
        s33 = cell_str(v[col["33業種コード"]])
        if not market or s33 in ("", "-") or len(cell_str(v[col["コード"]])) != 4:
            continue  # ETF・REIT・出資証券・優先株（5桁コード）などは除く
        as_of = as_of or cell_str(v[col["日付"]])
        sectors[s33] = cell_str(v[col["33業種区分"]])
        scale = cell_str(v[col["規模区分"]])
        rows.append([
            cell_str(v[col["コード"]]),
            unicodedata.normalize("NFKC", cell_str(v[col["銘柄名"]])),
            market,
            s33,
            cell_str(v[col["17業種区分"]]),
            "" if scale == "-" else scale,
        ])

    load_city_table()
    addr = load_edinet_addresses()
    for row in rows:
        row.extend(addr.get(row[0], ("", "", "")))

    rows.sort(key=lambda x: x[0])
    data = {
        "source": "日本取引所グループ「東証上場銘柄一覧」",
        "asOf": as_of,
        "built": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="minutes"),
        "sectors": [[k, sectors[k]] for k in sorted(sectors, key=int)],
        "fields": ["code", "name", "market", "sector33", "sector17", "scale", "pref", "city", "fyEnd"],
        "addressSource": "金融庁 EDINET コードリスト" if addr else "",
        "list": rows,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("window.GK_COMPANIES = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{len(rows)} companies, {len(sectors)} sectors -> {OUT}")


if __name__ == "__main__":
    main()
