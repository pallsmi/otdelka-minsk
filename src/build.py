#!/usr/bin/env python3
"""Сборка сайта: src/ -> готовые HTML-страницы в корне репозитория.

Запуск из корня репозитория:
    pip install jinja2
    python3 src/build.py

Что править:
    src/site.json          — контакты, название, подключение формы, адрес сайта
    src/content/ru.json    — тексты на русском
    src/content/be.json    — тексты на белорусском
    src/templates/*.j2     — разметка
"""
import datetime
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from jinja2 import Environment, FileSystemLoader, select_autoescape

SRC = Path(__file__).resolve().parent
OUT = SRC.parent

site = json.loads((SRC / "site.json").read_text(encoding="utf-8"))
imgs = json.loads((SRC / "images.json").read_text(encoding="utf-8"))
content = {
    lang: json.loads((SRC / "content" / f"{lang}.json").read_text(encoding="utf-8"))
    for lang in ("ru", "be")
}

env = Environment(
    loader=FileSystemLoader(SRC / "templates"),
    autoescape=select_autoescape(["html", "j2"]),
    trim_blocks=False,
    lstrip_blocks=False,
)


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def js_json(data) -> str:
    """JSON, безопасный для вставки внутрь <script>."""
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def version() -> str:
    h = hashlib.sha1()
    for p in (OUT / "css" / "style.css", OUT / "js" / "main.js"):
        h.update(p.read_bytes())
    return h.hexdigest()[:8]


base_url = (site.get("base_url") or "").strip()
if base_url and not base_url.endswith("/"):
    base_url += "/"

phone = (site.get("phone") or "").strip()
phone_tel = "+" + digits(phone) if phone else ""


def messengers_for(t):
    items = []
    tg = (site.get("telegram_username") or "").strip().lstrip("@")
    vb = digits(site.get("viber_phone"))
    wa = digits(site.get("whatsapp_phone"))
    if tg:
        items.append({"icon": "plane", "label": "Telegram", "href": f"https://t.me/{tg}", "external": True, "todo": False})
    if vb:
        items.append({"icon": "bubble", "label": "Viber", "href": f"viber://chat?number=%2B{vb}", "external": False, "todo": False})
    if wa:
        items.append({"icon": "round", "label": "WhatsApp", "href": f"https://wa.me/{wa}", "external": True, "todo": False})
    if not items:
        for icon_, label in (("plane", "Telegram"), ("bubble", "Viber"), ("round", "WhatsApp")):
            items.append({"icon": icon_, "label": label, "href": "#contact", "external": False, "todo": True})
    return items


def gallery_for(t, root):
    data = []
    for g in site["gallery"]:
        m = imgs[g["img"]]
        item = {
            "kind": g["kind"],
            "caption": t["captions"][g["id"]],
            "w": m["w"],
            "h": m["h"],
            "src": f"{root}assets/img/{g['img']}-{m['widths'][-1]}.webp",
        }
        if g["kind"] == "video":
            item["video"] = f"{root}assets/video/{g['video']}.mp4"
        data.append(item)
    return data


def localized(value, lang):
    if isinstance(value, dict):
        return (value.get(lang) or "").strip()
    return (value or "").strip()


def render(template, path: Path, **ctx):
    path.parent.mkdir(parents=True, exist_ok=True)
    html = env.get_template(template).render(**ctx)
    path.write_text(html, encoding="utf-8")
    print("  ✓", path.relative_to(OUT))


def main():
    v = version()
    year = datetime.date.today().year
    pages = {"ru": "", "be": "be/"}

    for lang, sub in pages.items():
        t = content[lang]
        root = "../" if sub else ""
        brand = localized(site["brand"], lang)
        page_url = base_url + sub if base_url else ""
        og_image = (base_url + "assets/img/og.jpg") if base_url else f"{root}assets/img/og.jpg"
        msgs = messengers_for(t)
        primary = next((m for m in msgs if not m["todo"]), {"href": "#contact", "todo": True, "external": False})

        ld_business = {
            "@context": "https://schema.org",
            "@type": "HomeAndConstructionBusiness",
            "name": brand,
            "description": t["meta_description"],
            "areaServed": {"@type": "City", "name": t["c_area_city"]},
            "address": {"@type": "PostalAddress", "addressLocality": t["c_area_city"], "addressCountry": "BY"},
            "knowsLanguage": ["ru", "be"],
        }
        if base_url:
            ld_business["url"] = page_url
            ld_business["image"] = og_image
        if phone_tel:
            ld_business["telephone"] = phone_tel
        ld_faq = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
                for f in t["faq"]
            ],
        }

        common = dict(
            t=t, s=site, imgs=imgs, root=root, v=v, year=year, brand=brand,
            base_url=base_url, page_url=page_url, og_image=og_image,
            phone=phone_tel, tel_href=f"tel:{phone_tel}" if phone_tel else "#contact",
            phone_text=(site.get("phone_display") or phone or t["todo_phone"]),
            messengers=msgs, primary_messenger=primary,
            hours=localized(site.get("hours"), lang),
            area_extra=localized(site.get("area_extra"), lang),
            legal=localized(site.get("legal_line"), lang),
            form=site.get("form", {}),
            alternates=[
                {"hreflang": content[l]["hreflang"], "url": base_url + s_} for l, s_ in pages.items()
            ] if base_url else [],
        )

        tape_index = next(i for i, g in enumerate(site["gallery"]) if g["id"] == "tape")
        render(
            "page.html.j2", OUT / sub / "index.html",
            **common,
            home_href="./",
            privacy_href="privacy.html",
            lang_links={"ru": "./" if lang == "ru" else "../", "be": "be/" if lang == "ru" else "./"},
            gallery=site["gallery"],
            gallery_json=js_json(gallery_for(t, root)),
            tape_index=tape_index,
            ld_business=js_json(ld_business),
            ld_faq=js_json(ld_faq),
        )
        render(
            "privacy.html.j2", OUT / sub / "privacy.html",
            **common,
            home_href="./",
            lang_links={"ru": "privacy.html" if lang == "ru" else "../privacy.html",
                        "be": "be/privacy.html" if lang == "ru" else "privacy.html"},
            operator=localized(site.get("privacy_operator"), lang),
            retention=localized(site.get("privacy_retention"), lang),
        )

    base_path = (urlparse(base_url).path or "/") if base_url else ""
    render("404.html.j2", OUT / "404.html", ru=content["ru"], be=content["be"],
           brand_ru=localized(site["brand"], "ru"), base_path_json=js_json(base_path))

    robots = "User-agent: *\nAllow: /\n"
    if base_url:
        robots += f"\nSitemap: {base_url}sitemap.xml\n"
        today = datetime.date.today().isoformat()
        urls = []
        for lang, sub in pages.items():
            alts = "".join(
                f'\n    <xhtml:link rel="alternate" hreflang="{content[l]["hreflang"]}" href="{base_url}{s_}"/>'
                for l, s_ in pages.items()
            )
            urls.append(f"  <url>\n    <loc>{base_url}{sub}</loc>\n    <lastmod>{today}</lastmod>{alts}\n  </url>")
        sitemap = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(urls) + "\n</urlset>\n"
        )
        (OUT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
        print("  ✓ sitemap.xml")
    (OUT / "robots.txt").write_text(robots, encoding="utf-8")
    print("  ✓ robots.txt")


if __name__ == "__main__":
    main()
