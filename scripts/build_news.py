"""その日の経済ニュースを Google ニュースの RSS から集め、影響がありそうな業界を
キーワードで推定して data/news.js に書き出す。

保存するのは見出し・媒体名・日時・元記事へのリンクだけ（本文は保存しない）。
GitHub Actions から毎朝実行される。手元では `python scripts/build_news.py` で動く（標準ライブラリのみ）。
"""
import datetime
import email.utils
import html
import json
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "news.js"
JST = datetime.timezone(datetime.timedelta(hours=9))
WINDOW_HOURS = 36
PER_INDUSTRY = 6
MAX_ITEMS = 120

# 業界ID: (表示名, 検索キーワード, 見出しから業界を判定するキーワード)
INDUSTRIES = {
    "auto": ("自動車", ["自動車", "トヨタ", "ホンダ", "日産", "EV"], ["自動車", "トヨタ", "ホンダ", "日産", "スズキ", "マツダ", "スバル", "SUBARU", "EV", "電気自動車", "新車", "デンソー"]),
    "elec": ("電機", ["電機", "ソニー", "パナソニック", "日立"], ["電機", "ソニー", "パナソニック", "日立", "三菱電機", "東芝", "家電"]),
    "it": ("IT・通信", ["通信", "NTT", "KDDI", "ソフトバンク", "生成AI"], ["通信", "NTT", "ドコモ", "KDDI", "ソフトバンク", "楽天", "生成AI", "AI", "クラウド", "データセンター", "サイバー"]),
    "semi": ("半導体・電子部品", ["半導体", "TSMC", "ラピダス", "電子部品"], ["半導体", "TSMC", "ラピダス", "東京エレクトロン", "アドバンテスト", "キオクシア", "電子部品", "村田製作所", "NVIDIA", "エヌビディア"]),
    "trade": ("総合商社", ["商社", "三菱商事", "伊藤忠"], ["商社", "三菱商事", "三井物産", "伊藤忠", "住友商事", "丸紅"]),
    "fin": ("金融", ["銀行", "日銀", "金利", "メガバンク"], ["銀行", "日銀", "利上げ", "金利", "メガバンク", "三菱UFJ", "三井住友", "みずほ", "証券"]),
    "insurance": ("保険", ["損保", "生命保険", "保険料"], ["損保", "生保", "保険", "東京海上", "第一生命"]),
    "retail": ("小売", ["小売", "コンビニ", "ユニクロ", "イオン"], ["小売", "コンビニ", "ユニクロ", "ファーストリテイリング", "イオン", "セブン", "ローソン", "ファミリーマート", "百貨店", "ドラッグストア"]),
    "food": ("食品・飲料", ["食品", "飲料", "値上げ 食品"], ["食品", "飲料", "ビール", "味の素", "キリン", "アサヒ", "サントリー", "コメ", "米価"]),
    "pharma": ("医薬品", ["製薬", "新薬", "武田薬品", "第一三共"], ["製薬", "新薬", "医薬", "武田", "第一三共", "アステラス", "中外製薬", "塩野義", "薬価"]),
    "chem": ("化学・素材", ["化学", "信越化学", "素材"], ["化学", "信越化学", "三菱ケミカル", "住友化学", "素材", "ナフサ"]),
    "steel": ("鉄鋼", ["鉄鋼", "日本製鉄"], ["鉄鋼", "日本製鉄", "JFE", "USスチール", "粗鋼"]),
    "machine": ("機械", ["機械", "建機", "ロボット", "工作機械"], ["機械", "建機", "コマツ", "ファナック", "ロボット", "工作機械", "ダイキン", "クボタ"]),
    "energy": ("電力・ガス", ["電力", "原発", "電気料金", "LNG"], ["電力", "原発", "電気料金", "ガス", "LNG", "東京電力", "関西電力", "再生可能エネルギー", "洋上風力"]),
    "realestate": ("不動産", ["不動産", "マンション", "地価"], ["不動産", "マンション", "地価", "住宅", "三井不動産", "三菱地所", "オフィス"]),
    "construction": ("建設", ["ゼネコン", "建設"], ["ゼネコン", "建設", "大林組", "鹿島", "大成建設", "清水建設", "インフラ"]),
    "rail": ("鉄道・陸運", ["鉄道", "JR", "物流"], ["鉄道", "JR", "新幹線", "運賃", "物流", "トラック", "ヤマト", "宅配"]),
    "shipping": ("海運", ["海運", "コンテナ船"], ["海運", "コンテナ船", "日本郵船", "商船三井", "川崎汽船", "造船", "紅海"]),
    "air": ("空運・旅行", ["航空", "ANA", "JAL", "訪日客"], ["航空", "ANA", "JAL", "日本航空", "訪日", "インバウンド", "旅行", "空港"]),
    "game": ("ゲーム・エンタメ", ["ゲーム", "任天堂", "アニメ"], ["ゲーム", "任天堂", "Switch", "カプコン", "バンダイナムコ", "スクウェア", "アニメ", "コナミ", "映画"]),
}

# 見出しに出てくるマクロ要因と、影響が考えられる業界（+ は追い風、- は逆風、~ はどちらもありうる）
THEMES = [
    ([r"(?<![0-9０-９,，])円安"], "円安", {"auto": "+", "elec": "+", "machine": "+", "air": "-", "food": "-", "retail": "-", "energy": "-"}),
    ([r"(?<![0-9０-９,，])円高"], "円高", {"auto": "-", "elec": "-", "machine": "-", "air": "+", "food": "+", "retail": "+"}),
    (["関税"], "関税", {"auto": "-", "machine": "-", "elec": "-", "steel": "~"}),
    (["利上げ", "金利上昇", "長期金利"], "金利上昇", {"fin": "+", "insurance": "+", "realestate": "-", "construction": "-"}),
    (["利下げ", "金融緩和"], "金利低下", {"fin": "-", "realestate": "+"}),
    (["原油", "LNG", "ガソリン"], "資源・燃料価格", {"trade": "~", "air": "-", "shipping": "-", "chem": "-", "energy": "-"}),
    (["データセンター", "AI投資", "AI需要", "AI半導体"], "AI投資", {"semi": "+", "it": "+", "energy": "+", "construction": "+"}),
    (["訪日", "インバウンド"], "インバウンド", {"air": "+", "rail": "+", "retail": "+"}),
    (["地震", "台風", "豪雨", "災害"], "自然災害", {"insurance": "-", "construction": "+"}),
    (["賃上げ", "最低賃金", "春闘"], "賃上げ", {"retail": "~", "food": "~"}),
    (["中国"], "中国経済", {"auto": "~", "machine": "~", "chem": "~", "semi": "~"}),
]

# 国内の主要な経済媒体は少し優先する
TRUSTED = ["日本経済新聞", "日経", "共同通信", "時事", "NHK", "ロイター", "Reuters", "ブルームバーグ", "Bloomberg", "日刊工業新聞", "ニュースイッチ",
           "東洋経済", "ダイヤモンド", "株探", "朝日新聞", "読売新聞", "毎日新聞", "産経", "ITmedia", "Impress", "電波新聞", "物流ニュース", "日刊自動車新聞", "流通ニュース", "TBS", "テレ東"]

EVENT_WORDS = ["決算", "上方修正", "下方修正", "最高益", "赤字", "黒字", "買収", "TOB", "統合", "再編", "提携", "撤退", "増産", "減産", "新工場", "値上げ", "関税", "利上げ", "円安", "円高", "規制", "受注", "業績予想"]


def fetch_rss(query):
    q = urllib.parse.quote(f"{query} when:2d")
    url = f"https://news.google.com/rss/search?q={q}&hl=ja&gl=JP&ceid=JP:ja"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (gyoukai-data-bot)"})
    with urllib.request.urlopen(req, timeout=30) as res:
        root = ET.fromstring(res.read())
    for item in root.iter("item"):
        title = html.unescape(item.findtext("title") or "").strip()
        src_el = item.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if source and title.endswith(" - " + source):
            title = title[: -len(" - " + source)].strip()
        try:
            at = email.utils.parsedate_to_datetime(item.findtext("pubDate"))
        except (TypeError, ValueError):
            continue
        yield {"t": title, "src": source, "url": item.findtext("link") or "", "at": at}


def hit(pattern, text):
    return re.search(pattern, text) if pattern.startswith("(?") else pattern in text


def norm(title):
    title = re.sub(r"[（(][^（）()]{1,20}[）)]\s*$", "", title)  # 末尾の（ロイター）などを除いて重複判定
    return re.sub(r"[\s　「」『』（）()【】・、。!！?？:：\-—]", "", title)[:40]


def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    seen, items = set(), []
    for ind_id, (_, queries, _) in INDUSTRIES.items():
        try:
            fetched = list(fetch_rss(" OR ".join(queries)))
        except Exception as e:  # 1業界の失敗で全体を止めない
            print(f"skip {ind_id}: {e}")
            continue
        for it in fetched:
            if (now - it["at"]).total_seconds() > WINDOW_HOURS * 3600:
                continue
            key = norm(it["t"])
            if not it["t"] or key in seen:
                continue
            seen.add(key)
            it["main"] = ind_id
            items.append(it)

    out = []
    for it in items:
        t = it["t"]
        inds = [i for i, (_, _, words) in INDUSTRIES.items() if any(w in t for w in words)]
        themes, impact = [], {}
        for words, label, effects in THEMES:
            if any(hit(w, t) for w in words):
                themes.append(label)
                for i, sign in effects.items():
                    impact.setdefault(i, sign)
        for i in inds:
            impact.setdefault(i, "~")
        if not impact:
            continue
        impact.setdefault(it["main"], "~")
        events = [w for w in EVENT_WORDS if w in t]
        trusted = any(n in it["src"] or n in t[-12:] for n in TRUSTED)
        score = len(events) * 2 + len(themes) * 2 + min(len(inds), 3) + (3 if trusted else 0)
        out.append({
            "t": t, "src": it["src"], "url": it["url"],
            "at": it["at"].astimezone(JST).isoformat(timespec="minutes"),
            "main": it["main"], "inds": list(impact.keys()), "impact": impact, "themes": themes, "events": events, "score": score,
        })

    out.sort(key=lambda x: (x["score"], x["at"]), reverse=True)
    picked, per = [], {}
    for it in out:
        main_ind = it["main"]
        if per.get(main_ind, 0) >= PER_INDUSTRY:
            continue
        per[main_ind] = per.get(main_ind, 0) + 1
        picked.append(it)
        if len(picked) >= MAX_ITEMS:
            break

    data = {
        "source": "Google ニュース（各媒体の見出しとリンク）",
        "built": datetime.datetime.now(JST).isoformat(timespec="minutes"),
        "industries": {k: v[0] for k, v in INDUSTRIES.items()},
        "items": picked,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("window.GK_NEWS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{len(picked)} news items -> {OUT}")


if __name__ == "__main__":
    main()
