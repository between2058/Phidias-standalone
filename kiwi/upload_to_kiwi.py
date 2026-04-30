#!/usr/bin/env python3
"""
Upload test cases from a markdown file to Kiwi TCMS.

Usage:
    python3 upload_to_kiwi.py --md-file <markdown_file> --plan-id <kiwi_plan_id> [--prefixes <tag1> <tag2> ...] [--dry-run]

Examples:
    # Upload cases from phidias-test-plan-zh.md to plan 932
    python3 upload_to_kiwi.py --md-file phidias-test-plan-zh.md --plan-id 932

    # Upload cases and prepend [title1][title2] to the kiwi_title
    python3 upload_to_kiwi.py --md-file phidias-test-plan-zh.md --plan-id 932 --prefixes title1 title2

    # Dry-run parsing only, without uploading
    python3 upload_to_kiwi.py --md-file phidias-test-plan-zh.md --plan-id 932 --dry-run
"""

import xmlrpc.client
import ssl
import re
import argparse
from dataclasses import dataclass

# ─── Configuration ────────────────────────────────────────────────────────────
KIWI_HOST    = "https://kiwi.cambrian.pegatroncorp.com"
USERNAME     = "weifan_liu"
PASSWORD     = "pega#1234"
PRODUCT_NAME = "PEGAVERSE"
PRIORITY_NAME = "P1"
STATUS_NAME   = "PROPOSED"
# ──────────────────────────────────────────────────────────────────────────────


# ─── Custom transport: carry session cookie across requests ───────────────────
class KiwiTransport(xmlrpc.client.SafeTransport):
    """SafeTransport that persists the sessionid cookie set by Auth.login()."""

    def __init__(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        super().__init__(context=ctx)
        self._session_cookie = None

    def send_headers(self, connection, headers):
        super().send_headers(connection, headers)
        if self._session_cookie:
            connection.putheader("Cookie", self._session_cookie)

    def parse_response(self, response):
        # Capture sessionid from Set-Cookie header after Auth.login()
        raw = response.getheader("Set-Cookie", "")
        if raw:
            m = re.search(r'sessionid=([^;,\s]+)', raw)
            if m:
                self._session_cookie = f"sessionid={m.group(1)}"
        return super().parse_response(response)
# ──────────────────────────────────────────────────────────────────────────────


@dataclass
class TestCase:
    case_id: str   # e.g. PHI-INT-N-006
    tag: str       # POSITIVE or NEGATIVE
    title: str     # e.g. 圖片生成 — 文字生成圖片
    body: str      # full markdown lines (目標/前置/步驟/預期)


def parse_test_cases(md_path):
    with open(md_path, encoding="utf-8") as f:
        content = f.read()

    cases = []
    block_pattern = re.compile(
        r'\*\*([A-Z0-9\-]+)\*\*\s+'
        r'[✅❌]\s+'
        r'(POSITIVE|NEGATIVE)｜'
        r'(.+?)\n'
        r'((?:- .*\n?)*)',
        re.MULTILINE,
    )
    for m in block_pattern.finditer(content):
        cases.append(TestCase(
            case_id=m.group(1).strip(),
            tag=m.group(2).strip(),
            title=m.group(3).strip(),
            body=m.group(4).strip() or f"- **目標**：{m.group(3).strip()}",
        ))
    return cases


def make_rpc():
    transport = KiwiTransport()
    rpc = xmlrpc.client.ServerProxy(
        f"{KIWI_HOST}/xml-rpc/",
        transport=transport,
        allow_none=True,
    )
    return rpc, transport


def login(rpc):
    token = rpc.Auth.login(USERNAME, PASSWORD)
    print(f"[auth] logged in, token: {str(token)[:20]}...")


def get_product_id(rpc):
    results = rpc.Product.filter({"name": PRODUCT_NAME})
    if not results:
        all_products = [p["name"] for p in rpc.Product.filter({})]
        raise RuntimeError(f"Product '{PRODUCT_NAME}' not found. Available: {all_products}")
    pid = results[0]["id"]
    print(f"[setup] Product '{PRODUCT_NAME}' → id={pid}")
    return pid


def get_or_create_category(rpc, product_id):
    cats = rpc.Category.filter({"product": product_id})
    if cats:
        cid = cats[0]["id"]
        print(f"[setup] Category '{cats[0]['name']}' → id={cid}")
        return cid
    cat = rpc.Category.create({"name": "General", "product": product_id})
    print(f"[setup] Created category 'General' → id={cat['id']}")
    return cat["id"]


def get_priority_id(rpc):
    for p in rpc.Priority.filter({}):
        if p["value"] == PRIORITY_NAME:
            print(f"[setup] Priority '{PRIORITY_NAME}' → id={p['id']}")
            return p["id"]
    all_p = [p["value"] for p in rpc.Priority.filter({})]
    raise RuntimeError(f"Priority '{PRIORITY_NAME}' not found. Available: {all_p}")


def get_case_status_id(rpc):
    for s in rpc.TestCaseStatus.filter({}):
        if s["name"].upper() == STATUS_NAME.upper():
            print(f"[setup] Status '{STATUS_NAME}' → id={s['id']}")
            return s["id"]
    all_s = [s["name"] for s in rpc.TestCaseStatus.filter({})]
    raise RuntimeError(f"Status '{STATUS_NAME}' not found. Available: {all_s}")


def get_author_id(rpc):
    results = rpc.User.filter({"username": USERNAME})
    if not results:
        raise RuntimeError(f"User '{USERNAME}' not found via User.filter()")
    uid = results[0]["id"]
    print(f"[setup] Author '{USERNAME}' → id={uid}")
    return uid


def build_text(tc):
    return f"**代號**: {tc.case_id}\n\n{tc.body}"


def upload_cases(rpc, cases, product_id, category_id, priority_id, status_id, author_id, plan_id, prefixes=None, dry_run=False):
    total = len(cases)
    created = 0
    failed = 0

    if prefixes:
        prefix_str = "".join([f"[{p}]" for p in prefixes])
    else:
        prefix_str = "[Phidias]"

    for i, tc in enumerate(cases, 1):
        kiwi_title = f"{prefix_str} {tc.case_id} | {tc.title}"
        print(f"[{i:3d}/{total}] {tc.case_id}  {kiwi_title[:65]}", end="  ")

        if dry_run:
            print("[DRY-RUN]")
            continue

        try:
            case_obj = rpc.TestCase.create({
                "summary":     kiwi_title,
                "product":     product_id,
                "category":    category_id,
                "priority":    priority_id,
                "case_status": status_id,
                "text":        build_text(tc),
                "author":      author_id,
            })
            new_id = case_obj["id"]

            rpc.TestCase.add_tag(new_id, tc.tag)
            rpc.TestPlan.add_case(plan_id, new_id)

            print(f"→ case #{new_id} ✓")
            created += 1

        except Exception as exc:
            print(f"→ FAILED: {exc}")
            failed += 1

    print(f"\n[done] created={created}  failed={failed}  total={total}")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse only, do not upload")
    parser.add_argument("--md-file", required=True,
                        help="Path to the markdown test plan file")
    parser.add_argument("--plan-id", type=int, required=True,
                        help="Kiwi TCMS plan ID to upload cases into")
    parser.add_argument("--prefixes", nargs="*", default=[],
                        help="List of prefixes to prepend to kiwi_title, e.g., --prefixes title1 title2")
    args = parser.parse_args()

    cases = parse_test_cases(args.md_file)
    print(f"[parse] Found {len(cases)} test cases in {args.md_file}")

    if args.dry_run:
        for tc in cases:
            print(f"  {tc.case_id} [{tc.tag}] {tc.title}")
        print(f"\n[dry-run] would upload {len(cases)} cases to plan #{args.plan_id}")
        return

    rpc, _ = make_rpc()
    login(rpc)

    product_id  = get_product_id(rpc)
    category_id = get_or_create_category(rpc, product_id)
    priority_id = get_priority_id(rpc)
    status_id   = get_case_status_id(rpc)
    author_id   = get_author_id(rpc)

    upload_cases(rpc, cases, product_id, category_id, priority_id, status_id, author_id,
                 plan_id=args.plan_id, prefixes=args.prefixes)

    rpc.Auth.logout()
    print("[auth] logged out")


if __name__ == "__main__":
    main()
