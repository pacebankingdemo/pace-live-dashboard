#!/usr/bin/env python3
"""
Restore S7 to the v1.0-s7-baseline state from the DB snapshot.

This script:
  1. Deletes all existing data for the run (logs, artifacts, recordings)
  2. Re-inserts the exact rows from the snapshot
  3. Resets the run status

Usage:
    python3 restore_s7_baseline.py                     # Restore to original run ID
    python3 restore_s7_baseline.py --new               # Create a fresh run with snapshot data
    python3 restore_s7_baseline.py --code-only          # Print git instructions only

Requires: pip install requests
"""

import argparse
import json
import os
import sys
import uuid

try:
    import requests
except ImportError:
    print("ERROR: 'requests' required. Install: pip install requests")
    sys.exit(1)

SUPABASE_URL = "https://csvjcpmxndgaujxlvikw.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3"
    "Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhw"
    "IjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To"
)
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
SNAPSHOT_FILE = os.path.join(os.path.dirname(__file__), "s7_baseline_snapshot.json")


def sb_post(table, rows):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=rows)
    if r.status_code not in (200, 201):
        print(f"  ERROR {table}: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    return r.json()


def sb_delete(table, filters):
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/{table}?{filters}", headers=HEADERS)
    if r.status_code not in (200, 204):
        print(f"  ERROR deleting {table}: {r.status_code} {r.text[:200]}")
        sys.exit(1)


def sb_patch(table, filters, data):
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/{table}?{filters}", headers=HEADERS, json=data)
    if r.status_code not in (200, 204):
        print(f"  ERROR patching {table}: {r.status_code} {r.text[:200]}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--new", action="store_true", help="Create a fresh run instead of restoring in-place")
    parser.add_argument("--code-only", action="store_true", help="Print git rollback instructions only")
    args = parser.parse_args()

    if args.code_only:
        print("\nTo roll back the code to v1.0-s7-baseline:\n")
        print("  git checkout v1.0-s7-baseline")
        print("  # or to reset main branch to it:")
        print("  git reset --hard v1.0-s7-baseline && git push --force origin main\n")
        return

    snap = json.load(open(SNAPSHOT_FILE))
    meta = snap["_meta"]
    run_id = meta["run_id"]

    if args.new:
        run_id = str(uuid.uuid4())
        print(f"\n  Creating NEW run: {run_id}\n")
    else:
        print(f"\n  Restoring run: {run_id}\n")
        print("  [1/5] Clearing existing logs...")
        sb_delete("activity_logs", f"run_id=eq.{run_id}")
        print("  [2/5] Clearing existing artifacts...")
        sb_delete("artifacts", f"run_id=eq.{run_id}")
        print("  [3/5] Clearing existing recordings...")
        sb_delete("browser_recordings", f"run_id=eq.{run_id}")

    if args.new:
        print("  [1/5] Creating run...")
        run_data = snap["run"].copy()
        run_data["id"] = run_id
        run_data.pop("created_at", None)
        run_data.pop("updated_at", None)
        sb_post("activity_runs", run_data)
    else:
        print("  [4/5] Resetting run status...")
        sb_patch("activity_runs", f"id=eq.{run_id}", {
            "status": snap["run"]["status"],
            "name": snap["run"]["name"],
            "current_status_text": snap["run"]["current_status_text"],
        })

    # Re-insert logs
    logs = []
    for l in snap["logs"]:
        row = {k: v for k, v in l.items() if k not in ("id", "created_at")}
        row["run_id"] = run_id
        logs.append(row)
    sb_post("activity_logs", logs)
    print(f"  {'[2' if args.new else '[4'}/5] Inserted {len(logs)} logs")

    # Re-insert artifacts
    arts = []
    for a in snap["artifacts"]:
        row = {k: v for k, v in a.items() if k != "created_at"}
        if args.new:
            row["id"] = str(uuid.uuid4())
        row["run_id"] = run_id
        arts.append(row)
    sb_post("artifacts", arts)
    print(f"  {'[3' if args.new else '[4'}/5] Inserted {len(arts)} artifacts")

    # Re-insert recordings
    recs = []
    for r in snap["recordings"]:
        row = {k: v for k, v in r.items() if k not in ("id", "created_at")}
        row["run_id"] = run_id
        recs.append(row)
    sb_post("browser_recordings", recs)
    print(f"  {'[4' if args.new else '[5'}/5] Inserted {len(recs)} recordings")

    url = f"https://pace-live-dashboard.vercel.app/run/{run_id}"
    print(f"\n  RESTORED to v1.0-s7-baseline!")
    print(f"  Run: {run_id}")
    print(f"  Dashboard: {url}\n")


if __name__ == "__main__":
    main()
