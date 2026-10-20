"""Offline regression tests for the catalogue tooling; run with unittest."""
import csv
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
COLUMNS = ['record_id', 'kind', 'name', 'official_code', 'basic_studies_code',
           'curriculum_period', 'source_url', 'previous_review_status', 'notes',
           'review_decision', 'verified_code', 'verified_source_url', 'verified_period',
           'review_notes', 'reviewed_on']


class CatalogueCLITest(unittest.TestCase):
    def test_verifier_preserves_review_fields_and_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'catalogue-reviewed.csv'
            row = dict.fromkeys(COLUMNS, '')
            row.update(record_id='stable123', kind='major', name='Example major',
                       curriculum_period='2026-2028',
                       source_url='https://www.aalto.fi/en/minors',
                       review_decision='include', verified_code='SCI9999',
                       verified_period='2026-2028', reviewed_on='2026-10-20',
                       review_notes='Manually verified')
            with source.open('w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=COLUMNS)
                writer.writeheader()
                writer.writerow(row)
            original = source.read_bytes()
            output = root / 'generated'
            result = subprocess.run([sys.executable, str(HERE/'verify_catalogue.py'),
                                     '--input', str(source), '--output', str(output)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(source.read_bytes(), original)
            with (output/'verification.csv').open(encoding='utf-8', newline='') as f:
                generated = list(csv.DictReader(f))
            self.assertEqual(len(generated), 1)
            self.assertEqual(generated[0]['record_id'], 'stable123')
            self.assertEqual(generated[0]['review_decision'], 'include')
            self.assertEqual(generated[0]['verified_code'], 'SCI9999')
            self.assertEqual(generated[0]['review_notes'], 'Manually verified')
            self.assertIn('include: 1', (output/'REPORT.md').read_text())

    def test_checklist_marks_reviewed_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root/'sample.csv'
            with source.open('w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=COLUMNS)
                writer.writeheader()
                writer.writerow(dict.fromkeys(COLUMNS, '') | {'kind': 'major', 'name': 'A', 'review_decision': 'include'})
                writer.writerow(dict.fromkeys(COLUMNS, '') | {'kind': 'major', 'name': 'B'})
            output = root/'checklist.md'
            result = subprocess.run([sys.executable, str(HERE/'generate_checklist.py'), '--input', str(source), '--output', str(output)], capture_output=True,text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            content=output.read_text()
            self.assertIn('- [x] A',content)
            self.assertIn('- [ ] B',content)


if __name__=='__main__':
    unittest.main()
