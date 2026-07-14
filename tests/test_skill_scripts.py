import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "ui-to-prompt"
SCRIPTS = SKILL / "scripts"


def run_script(name, *args):
    return subprocess.run(
        [sys.executable, str(SCRIPTS / name), *map(str, args)],
        capture_output=True,
        text=True,
        check=False,
    )


def valid_spec():
    return {
        "schema_version": "1.0.0",
        "metadata": {
            "title": "Editorial analytics reference",
            "source_kind": "image",
            "rights_mode": "style-only",
        },
        "provenance": {"source": "fixture.png", "captured_at": "2026-07-14T00:00:00Z"},
        "visual_principles": [
            {
                "value": "Editorial hierarchy with evidence-led accents",
                "status": "inferred",
                "confidence": 0.75,
                "evidence": ["image.composition"],
            }
        ],
        "design_tokens": {
            "colors": {
                "canvas": {
                    "value": "#F4F1E8",
                    "status": "computed",
                    "confidence": 0.98,
                    "evidence": ["image.palette.0"],
                },
                "ink": {
                    "value": "#191A17",
                    "status": "computed",
                    "confidence": 0.98,
                    "evidence": ["image.palette.1"],
                },
            },
            "typography": {},
            "spacing": {},
            "radii": {},
            "shadows": {},
        },
        "layout": [],
        "components": [],
        "responsive_rules": [],
        "interaction_motion": [],
        "accessibility": [],
        "negative_constraints": ["Do not copy source brand assets."],
        "uncertainties": [
            {
                "field": "typography.family",
                "reason": "The font family cannot be proven from pixels.",
                "status": "unknown",
            }
        ],
        "acceptance_targets": ["Keep the palette role relationships."],
    }


class SkillScriptTests(unittest.TestCase):
    def test_image_inspection_emits_measured_palette_and_unknown_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            image_path = directory / "fixture.png"
            output_path = directory / "evidence.json"
            image = Image.new("RGB", (8, 8), "#F4F1E8")
            for x in range(4, 8):
                for y in range(8):
                    image.putpixel((x, y), (49, 87, 245))
            image.save(image_path)

            result = run_script(
                "inspect_image.py", "--input", image_path, "--output", output_path
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            evidence = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(evidence["source"]["kind"], "image")
            self.assertEqual(evidence["source"]["width"], 8)
            self.assertEqual(evidence["source"]["height"], 8)
            self.assertGreaterEqual(len(evidence["palette"]), 2)
            self.assertTrue(all(item["status"] == "computed" for item in evidence["palette"]))
            self.assertEqual(evidence["unknowns"]["responsive"], "unknown")
            self.assertEqual(evidence["unknowns"]["font_family"], "unknown")

    def test_compiler_writes_prompt_css_and_evidence_report(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            spec_path = directory / "style-spec.json"
            output_dir = directory / "package"
            spec_path.write_text(json.dumps(valid_spec()), encoding="utf-8")

            result = run_script(
                "compile_prompt.py", "--input", spec_path, "--output-dir", output_dir
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            prompt = (output_dir / "systematic-prompt.md").read_text(encoding="utf-8")
            self.assertIn("## 1. Mission and scope", prompt)
            self.assertIn("## 13. Unknown-handling rules", prompt)
            self.assertIn("Do not copy source brand assets", prompt)
            self.assertTrue((output_dir / "variables.css").stat().st_size > 0)
            self.assertTrue((output_dir / "evidence-report.md").stat().st_size > 0)

    def test_validator_accepts_complete_spec_and_rejects_unsupported_status(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            valid_path = directory / "valid.json"
            invalid_path = directory / "invalid.json"
            valid_path.write_text(json.dumps(valid_spec()), encoding="utf-8")
            invalid = valid_spec()
            invalid["visual_principles"][0]["status"] = "guessed-without-evidence"
            invalid_path.write_text(json.dumps(invalid), encoding="utf-8")

            accepted = run_script("validate_spec.py", "--input", valid_path)
            rejected = run_script("validate_spec.py", "--input", invalid_path)

            self.assertEqual(accepted.returncode, 0, accepted.stderr)
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("status", rejected.stderr.lower())


if __name__ == "__main__":
    unittest.main()
