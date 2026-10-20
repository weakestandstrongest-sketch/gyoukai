"""東証の上場銘柄一覧（JPX公開のExcel）から全上場企業の一覧を作り、data/companies.js に書き出す。

GitHub Actions から毎日実行される。手元で実行する場合:
    pip install xlrd==2.0.1 openpyxl==3.1.5
    python scripts/build_companies.py
"""
import datetime
import io
import json
import pathlib
import re
import urllib.parse
import urllib.request

PAGE = "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"
UA = {"User-Agent": "Mozilla/5.0 (gyoukai-data-bot)"}
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
        if not market or s33 in ("", "-"):
            continue  # ETF・REIT・出資証券などは除く
        as_of = as_of or cell_str(v[col["日付"]])
        sectors[s33] = cell_str(v[col["33業種区分"]])
        scale = cell_str(v[col["規模区分"]])
        rows.append([
            cell_str(v[col["コード"]]),
            cell_str(v[col["銘柄名"]]),
            market,
            s33,
            cell_str(v[col["17業種区分"]]),
            "" if scale == "-" else scale,
        ])

    rows.sort(key=lambda x: x[0])
    data = {
        "source": "日本取引所グループ「東証上場銘柄一覧」",
        "asOf": as_of,
        "built": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="minutes"),
        "sectors": [[k, sectors[k]] for k in sorted(sectors)],
        "fields": ["code", "name", "market", "sector33", "sector17", "scale"],
        "list": rows,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("window.GK_COMPANIES = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{len(rows)} companies, {len(sectors)} sectors -> {OUT}")


if __name__ == "__main__":
    main()
