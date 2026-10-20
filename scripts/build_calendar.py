"""日本取引所グループが公開している「決算発表予定日」の一覧から、決算カレンダーを data/calendar.js に書き出す。
GitHub Actions から実行される。手元では `pip install xlrd==2.0.1 openpyxl==3.1.5` のあと `python scripts/build_calendar.py`。
"""
import datetime
import io
import json
import pathlib
import re
import unicodedata
import urllib.parse
import urllib.request

PAGE = "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "calendar.js"
JST = datetime.timezone(datetime.timedelta(hours=9))
UA = {"User-Agent": "Mozilla/5.0 (gyoukai-data-bot)"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def rows_of(url, raw):
    if url.lower().endswith(".xlsx"):
        import openpyxl
        ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True).worksheets[0]
        return [list(r) for r in ws.iter_rows(values_only=True)]
    import xlrd
    book = xlrd.open_workbook(file_contents=raw)
    sh = book.sheet_by_index(0)
    out = []
    for i in range(sh.nrows):
        row = []
        for j, c in enumerate(sh.row(i)):
            if c.ctype == xlrd.XL_CELL_DATE:
                row.append(datetime.datetime(*xlrd.xldate_as_tuple(c.value, book.datemode)))
            else:
                row.append(c.value)
        out.append(row)
    return out


def norm(v):
    if v is None:
        return ""
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return unicodedata.normalize("NFKC", str(v)).strip()


def to_date(s):
    m = re.search(r"(\d{4})[/\-年.](\d{1,2})[/\-月.](\d{1,2})", s)
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else ""


def main():
    page = get(PAGE).decode("utf-8", "replace")
    links = sorted(set(re.findall(r'href="([^"]+\.xlsx?)"', page)))
    print("ファイル:", links)
    today = datetime.datetime.now(JST).date().isoformat()
    items = {}
    for link in links:
        url = urllib.parse.urljoin(PAGE, link)
        try:
            table = rows_of(url, get(url))
        except Exception as e:
            print("読めませんでした:", url, e)
            continue
        hi = next((i for i, r in enumerate(table[:15]) if any("コード" in norm(c) for c in r)), None)
        if hi is None:
            print("見出しが見つかりません:", url, table[:3])
            continue
        head = [norm(c) for c in table[hi]]
        print("見出し:", head)
        def col(*keys):
            return next((i for i, h in enumerate(head) if any(k in h for k in keys)), None)
        c_date, c_code, c_name = col("予定日", "発表日"), col("コード"), col("会社名", "銘柄名")
        c_end, c_kind, c_sec = col("決算期"), col("種別", "区分"), col("業種")
        for r in table[hi + 1:]:
            r = [norm(c) for c in r]
            if c_code is None or c_date is None or len(r) <= max(c_code, c_date):
                continue
            code, date = r[c_code][:4], to_date(r[c_date])
            if not code or not date or date < today:
                continue
            name = r[c_name] if c_name is not None else ""
            if "投資法人" in name or (c_sec is not None and r[c_sec] in ("REIT", "インフラファンド")):
                continue  # REIT・インフラファンドは除く
            items[(date, code)] = [date, code, r[c_name] if c_name is not None else "",
                                   r[c_end] if c_end is not None else "", r[c_kind] if c_kind is not None else "",
                                   r[c_sec] if c_sec is not None else ""]
    rows = sorted(items.values())
    print(f"予定 {len(rows)} 件")
    if not rows:
        print("予定を1件も取得できなかったため、ファイルを書き換えません")
        return
    data = {"source": "日本取引所グループ「決算発表予定日」", "built": datetime.datetime.now(JST).isoformat(timespec="minutes"),
            "fields": ["date", "code", "name", "fyEnd", "kind", "sector"], "items": rows}
    OUT.write_text("window.GK_CAL = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
