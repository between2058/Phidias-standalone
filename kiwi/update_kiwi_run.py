#!/usr/bin/env python3
"""
Update a Kiwi TCMS test run with results from a Playwright JSON report.

Mapping strategy (no tag usage):
  Each Playwright spec file name (e.g. PHI-INT-N-006.spec.ts) contains a
  case ID.  upload_to_kiwi.py embeds that same ID in the Kiwi test case
  summary:  "[Phidias] PHI-INT-N-006 | 圖片生成 — 文字生成圖片"
  This script parses the ID from the summary with a regex and matches it
  to the spec file name — no tags needed.

Usage:
    # 1. Run tests and save JSON report
    PLAYWRIGHT_NO_SERVER=1 npx playwright test --project=standalone \\
        --reporter=json 2>/dev/null > results.json

    # 2. Dry-run: show what would be updated
    python3 update_kiwi_run.py --run-id 123 --json-report results.json --dry-run

    # 3. Update Kiwi
    python3 update_kiwi_run.py --run-id 123 --json-report results.json

Status mapping:
    passed      → PASSED
    failed      → FAILED
    timedOut    → FAILED
    skipped     → WAIVED  (test.fixme / test.skip)
"""

import xmlrpc.client
import ssl
import re
import json
import argparse
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────
KIWI_HOST = "https://kiwi.cambrian.pegatroncorp.com"
USERNAME  = "weifan_liu"
PASSWORD  = "pega#1234"
# ──────────────────────────────────────────────────────────────────────────────

STATUS_MAP = {
    "passed":      "PASSED",
    "failed":      "FAILED",
    "timedOut":    "FAILED",
    "interrupted": "FAILED",
    "skipped":     "WAIVED",
}

# Matches IDs like PHI-INT-N-006, WC-UI-001, WC-UPLOAD-012, PHI-INT-E-034
CASE_ID_RE = re.compile(r'\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3,})\b')


# ─── Kiwi transport ───────────────────────────────────────────────────────────
class KiwiTransport(xmlrpc.client.SafeTransport):
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
        raw = response.getheader("Set-Cookie", "")
        if raw:
            m = re.search(r'sessionid=([^;,\s]+)', raw)
            if m:
                self._session_cookie = f"sessionid={m.group(1)}"
        return super().parse_response(response)


def make_rpc():
    transport = KiwiTransport()
    return xmlrpc.client.ServerProxy(
        f"{KIWI_HOST}/xml-rpc/",
        transport=transport,
        allow_none=True,
    )


def login(rpc):
    token = rpc.Auth.login(USERNAME, PASSWORD)
    print(f"[auth] logged in, token: {str(token)[:20]}...")


# ─── Parse Playwright JSON report ─────────────────────────────────────────────
def parse_playwright_results(json_path: str) -> dict:
    """
    Returns {case_id: worst_status}.
    Extracts case_id from spec file name (PHI-INT-N-006.spec.ts → PHI-INT-N-006).
    Worst-case across retries: failed > skipped > passed.
    """
    SEVERITY = {"failed": 3, "timedOut": 3, "interrupted": 3, "skipped": 2, "passed": 1}

    with open(json_path, encoding="utf-8") as f:
        report = json.load(f)

    results: dict = {}

    def walk(suites):
        for suite in suites:
            file_path = suite.get("file", "")
            if file_path:
                stem = Path(file_path).name                  # e.g. PHI-INT-N-006.spec.ts
                case_id = re.sub(r'\.spec\.ts$', '', stem)  # e.g. PHI-INT-N-006
                for spec in suite.get("specs", []):
                    for test in spec.get("tests", []):
                        status = test.get("status", "unknown")
                        prev = results.get(case_id)
                        if prev is None or SEVERITY.get(status, 0) > SEVERITY.get(prev, 0):
                            results[case_id] = status
            walk(suite.get("suites", []))

    walk(report.get("suites", []))
    return results


# ─── Kiwi helpers ─────────────────────────────────────────────────────────────
def extract_case_id_from_summary(summary: str) -> str | None:
    """
    Extract the first Kiwi case ID embedded in a test case summary.
    e.g. "[Phidias] PHI-INT-N-006 | 圖片生成 — ..." → "PHI-INT-N-006"
    """
    m = CASE_ID_RE.search(summary)
    return m.group(1) if m else None


def build_summary_map(rpc, run_id: int) -> dict:
    """
    Returns {case_id_string: execution_id} by:
      1. Fetching all executions in the run
      2. Fetching all test case summaries in the run's plan
      3. Parsing case_id from each summary
    Only one batch API call per step — no per-case queries.
    """
    # Step 1: get run → plan_id
    runs = rpc.TestRun.filter({"id": run_id})
    if not runs:
        raise RuntimeError(f"TestRun #{run_id} not found")
    plan_id = runs[0]["plan_id"]
    print(f"[setup] Run #{run_id} belongs to plan #{plan_id}")

    # Step 2: get all executions in the run  {kiwi_tc_int_id → exec_id}
    executions = rpc.TestExecution.filter({"run": run_id})
    print(f"[setup] Found {len(executions)} executions in run #{run_id}")
    tc_to_exec = {ex["case_id"]: ex["id"] for ex in executions}

    # Step 3: get all test cases in the plan  {kiwi_tc_int_id → summary}
    cases = rpc.TestCase.filter({"plan": plan_id})
    print(f"[setup] Found {len(cases)} test cases in plan #{plan_id}")

    # Step 4: parse case_id from summary and build final map
    mapping: dict = {}
    for case in cases:
        kiwi_tc_id = case["id"]
        summary = case.get("summary", "")
        case_id_str = extract_case_id_from_summary(summary)
        if case_id_str and kiwi_tc_id in tc_to_exec:
            mapping[case_id_str] = tc_to_exec[kiwi_tc_id]

    print(f"[setup] Mapped {len(mapping)} case IDs to executions via summary")
    return mapping


def get_execution_status_ids(rpc) -> dict:
    statuses = rpc.TestExecutionStatus.filter({})
    mapping = {s["name"].upper(): s["id"] for s in statuses}
    print(f"[setup] Kiwi execution statuses: {list(mapping.keys())}")
    return mapping


# ─── Main update logic ────────────────────────────────────────────────────────
def update_run(rpc, run_id: int, playwright_results: dict, dry_run: bool = False):
    status_ids = get_execution_status_ids(rpc)
    summary_map = build_summary_map(rpc, run_id)

    updated = not_found = skipped_fixme = 0

    print(f"\n{'CASE ID':<28} {'PW STATUS':<14} {'KIWI STATUS':<12} RESULT")
    print("-" * 72)

    for case_id in sorted(playwright_results.keys()):
        pw_status = playwright_results[case_id]
        kiwi_status_name = STATUS_MAP.get(pw_status, "FAILED").upper()

        # Resolve Kiwi status ID (exact then partial match)
        status_id = status_ids.get(kiwi_status_name)
        if status_id is None:
            for name, sid in status_ids.items():
                if kiwi_status_name in name:
                    status_id = sid
                    kiwi_status_name = name
                    break

        exec_id = summary_map.get(case_id)

        if exec_id is None:
            print(f"{case_id:<28} {pw_status:<14} {kiwi_status_name:<12} "
                  f"⚠  not found in run (case not in test run, or summary format mismatch)")
            not_found += 1
            continue

        if pw_status == "skipped":
            skipped_fixme += 1

        if dry_run:
            print(f"{case_id:<28} {pw_status:<14} {kiwi_status_name:<12} [DRY-RUN] exec_id={exec_id}")
            continue

        if status_id is None:
            print(f"{case_id:<28} {pw_status:<14} {kiwi_status_name:<12} ✗  status not found in Kiwi")
            not_found += 1
            continue

        try:
            rpc.TestExecution.update(exec_id, {"status": status_id})
            print(f"{case_id:<28} {pw_status:<14} {kiwi_status_name:<12} ✓  exec_id={exec_id}")
            updated += 1
        except Exception as exc:
            print(f"{case_id:<28} {pw_status:<14} {kiwi_status_name:<12} ✗  {exc}")
            not_found += 1

    total = len(playwright_results)
    print("-" * 72)
    print(f"[done] updated={updated}  not_found={not_found}  "
          f"skipped(fixme/skip)={skipped_fixme}  total={total}")

    if skipped_fixme:
        print(f"\n[note] {skipped_fixme} WAIVED test(s) were skipped (test.fixme / test.skip).")
        print("       These need k8s configmap changes before they can run — see e2e/README.md")

    if not_found:
        print(f"\n[hint] {not_found} case(s) not found. Possible causes:")
        print("  1. Case not added to this test run → add via Kiwi UI or TestRun.add_case()")
        print("  2. Summary format mismatch → verify summary contains e.g. 'PHI-INT-N-006'")
        print("  3. Cases uploaded before the summary format change → re-upload with upload_to_kiwi.py")


# ─── Entry point ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--run-id", type=int, required=True,
                        help="Kiwi TCMS TestRun ID to update")
    parser.add_argument("--json-report", required=True,
                        help="Path to Playwright JSON report (from --reporter=json)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show mapping without updating Kiwi")
    args = parser.parse_args()

    playwright_results = parse_playwright_results(args.json_report)
    print(f"[parse] Found {len(playwright_results)} test results in {args.json_report}\n")

    rpc = make_rpc()
    login(rpc)
    update_run(rpc, args.run_id, playwright_results, dry_run=args.dry_run)
    rpc.Auth.logout()
    print("[auth] logged out")


if __name__ == "__main__":
    main()
