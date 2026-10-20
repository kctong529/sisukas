import sys
import json
import subprocess
import tempfile
import unittest
from copy import deepcopy
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from reconcile_active_courses import reconcile_active_courses


AS_OF = date(2026, 10, 20)


def course(id, end_date, **overrides):
    return {
        "id": id,
        "endDate": end_date,
        "code": f"TEST-{id}",
        **overrides,
    }


def ids(records):
    return {record["id"] for record in records}


class TestReconcileActiveCourses(unittest.TestCase):
    def reconcile(self, previous, latest):
        return reconcile_active_courses(
            deepcopy(previous),
            deepcopy(latest),
            AS_OF,
        )

    def test_retains_implementation_ending_today(self):
        old = course("today", "2026-10-20")

        active, archived, retained = self.reconcile([old], [course("baseline", "2027-12-31")])

        self.assertEqual(ids(active), {"today", "baseline"})
        self.assertEqual(ids(retained), {"today"})
        self.assertEqual(archived, [])
        self.assertEqual(active[-1], old)

    def test_retains_future_implementation(self):
        old = course("future", "2027-01-15")

        active, archived, retained = self.reconcile([old], [course("baseline", "2027-12-31")])

        self.assertEqual(ids(active), {"future", "baseline"})
        self.assertEqual(ids(retained), {"future"})
        self.assertEqual(archived, [])

    def test_archives_implementation_ended_yesterday(self):
        old = course("expired", "2026-10-19")

        active, archived, retained = self.reconcile([old], [course("baseline", "2027-12-31")])

        self.assertEqual(ids(active), {"baseline"})
        self.assertEqual(ids(archived), {"expired"})
        self.assertEqual(retained, [])

    def test_prefers_latest_record(self):
        old = course("same", "2026-12-31", code="OLD")
        new = course("same", "2027-01-31", code="NEW")

        active, archived, retained = self.reconcile([old], [new])

        self.assertEqual(active, [new])
        self.assertEqual(archived, [])
        self.assertEqual(retained, [])

    def test_rejects_duplicate_previous_ids(self):
        with self.assertRaisesRegex(ValueError, "duplicate id"):
            self.reconcile([course("a", "2027-01-01"), course("a", "2027-01-01")],
                           [course("b", "2027-01-01")])

    def test_rejects_duplicate_latest_ids(self):
        with self.assertRaisesRegex(ValueError, "duplicate id"):
            self.reconcile([], [course("a", "2027-01-01"), course("a", "2027-01-01")])

    def test_rejects_empty_latest_catalog(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            self.reconcile([course("a", "2027-01-01")], [])

    def test_rejects_non_array_input(self):
        with self.assertRaisesRegex(ValueError, "JSON array"):
            self.reconcile({"id": "a"}, [course("b", "2027-01-01")])

    def test_rejects_missing_id(self):
        with self.assertRaisesRegex(ValueError, "invalid id"):
            self.reconcile([{"endDate": "2027-01-01"}], [course("b", "2027-01-01")])

    def test_includes_new_implementation(self):
        new = course("new", "2027-01-31")

        active, archived, retained = self.reconcile([], [new])

        self.assertEqual(active, [new])
        self.assertEqual(archived, [])
        self.assertEqual(retained, [])

    def test_partitions_mixed_dataset(self):
        previous = [
            course("today", "2026-10-20"),
            course("future", "2026-12-01"),
            course("expired", "2026-10-19"),
            course("unchanged", "2026-11-01"),
        ]
        latest = [
            course("unchanged", "2026-11-15"),
            course("new", "2027-01-01"),
        ]

        active, archived, retained = self.reconcile(
            previous, latest
        )

        self.assertEqual(
            ids(active),
            {"today", "future", "unchanged", "new"},
        )
        self.assertEqual(ids(archived), {"expired"})
        self.assertEqual(ids(retained), {"today", "future"})

    def test_is_deterministic(self):
        previous = [course("future", "2027-01-01")]
        latest = [course("new", "2027-02-01")]

        first = self.reconcile(previous, latest)
        second = self.reconcile(previous, latest)

        self.assertEqual(first, second)

    def test_rejects_invalid_end_date(self):
        previous = [course("invalid", "not-a-date")]

        with self.assertRaises(ValueError):
            self.reconcile(previous, [course("baseline", "2027-12-31")])

    def test_cli_override_requires_exact_count(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            prev = root / "previous.json"
            latest = root / "latest.json"
            prev.write_text(json.dumps([course("old", "2026-10-19"),
                                        course("current", "2026-10-20")]))
            latest.write_text(json.dumps([course("new", "2027-01-01")]))
            paths = [root / f"out-{name}.json" for name in ("active", "archive", "retained")]
            base = [sys.executable, str(Path(__file__).resolve().parents[1] / "reconcile_active_courses.py"),
                    "--previous", str(prev), "--latest", str(latest), "--as-of", "2026-10-20",
                    "--active-out", str(paths[0]), "--archive-out", str(paths[1]),
                    "--retained-out", str(paths[2]), "--max-archive-fraction", "0.20"]
            refused = subprocess.run(base, capture_output=True, text=True)
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn("limit is 20.0%", refused.stderr)
            self.assertTrue(all(not path.exists() for path in paths))

            wrong = subprocess.run(base + ["--allow-large-archive", "--expected-archive-count", "2"],
                                   capture_output=True, text=True)
            self.assertNotEqual(wrong.returncode, 0)
            self.assertIn("expected 2", wrong.stderr)
            self.assertTrue(all(not path.exists() for path in paths))

            approved = subprocess.run(base + ["--allow-large-archive", "--expected-archive-count", "1"],
                                      capture_output=True, text=True)
            self.assertEqual(approved.returncode, 0, approved.stderr)
            self.assertIn("reviewed override", approved.stdout)
            self.assertTrue(all(path.exists() for path in paths))
            self.assertEqual({c["id"] for c in json.loads(paths[0].read_text())},
                             {"current", "new"})

    def test_cli_rejects_override_without_count(self):
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / "reconcile_active_courses.py"),
             "--previous", "p.json", "--latest", "l.json",
             "--active-out", "a.json", "--archive-out", "b.json", "--retained-out", "c.json",
             "--allow-large-archive"], capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("requires --expected-archive-count", result.stderr)

    def test_does_not_mutate_inputs(self):
        previous = [course("future", "2027-01-01")]
        latest = [course("new", "2027-02-01")]

        previous_copy = deepcopy(previous)
        latest_copy = deepcopy(latest)

        self.reconcile(previous, latest)

        self.assertEqual(previous, previous_copy)
        self.assertEqual(latest, latest_copy)


if __name__ == "__main__":
    unittest.main()
