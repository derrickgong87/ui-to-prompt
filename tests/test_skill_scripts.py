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
        "schemaVersion": "1.0",
        "metadata": {
            "title": "Editorial analytics reference",
            "rightsMode": "style-only",
        },
        "source": {"kind": "image", "ref": "fixture.png"},
        "tokens": {
            "colors": {
                "canvas": "#F4F1E8",
                "ink": "#191A17",
            },
            "typography": {},
            "spacing": {},
            "radii": {},
            "shadows": {},
        },
        "sections": {
            "visualIntent": {
                "status": "inferred",
                "confidence": 0.75,
                "evidence": [{"label": "visual-model", "ref": "image.composition"}],
                "summary": "Use editorial hierarchy with evidence-led accents.",
                "details": {"invariants": ["Keep the palette role relationships."]},
            },
            "layout": {"status": "inferred", "confidence": 0.6, "evidence": [{"label": "screenshot", "ref": "fixture.png"}], "summary": "Use an asymmetric editorial grid."},
            "color": {"status": "computed", "confidence": 0.98, "evidence": [{"label": "derived", "ref": "image.palette"}], "summary": "Use warm canvas and dark ink roles."},
            "typography": {"status": "unknown", "confidence": 0, "evidence": [], "summary": "The exact font family is unavailable.", "unknownReason": "Font files cannot be proven from pixels."},
            "spacing": {"status": "inferred", "confidence": 0.55, "evidence": [{"label": "screenshot", "ref": "fixture.png"}], "summary": "Use a restrained spacing rhythm."},
            "surfaces": {"status": "observed", "confidence": 0.8, "evidence": [{"label": "screenshot", "ref": "fixture.png"}], "summary": "Use thin rules and restrained shadows."},
            "components": {"status": "inferred", "confidence": 0.6, "evidence": [{"label": "visual-model", "ref": "image.regions"}], "summary": "Use evidence-led cards and controls."},
            "imagery": {"status": "observed", "confidence": 0.8, "evidence": [{"label": "screenshot", "ref": "fixture.png"}], "summary": "Use editorial crops with original imagery."},
            "iconography": {"status": "unknown", "confidence": 0, "evidence": [], "summary": "Icon rules were not visible.", "unknownReason": "No representative icons are present."},
            "responsiveness": {"status": "unknown", "confidence": 0, "evidence": [], "summary": "Responsive behavior is not available.", "unknownReason": "Only one desktop image was supplied."},
            "interactions": {"status": "unknown", "confidence": 0, "evidence": [], "summary": "Interaction states are not available.", "unknownReason": "A static image contains no interaction evidence."},
            "motion": {"status": "unknown", "confidence": 0, "evidence": [], "summary": "Motion is not available.", "unknownReason": "A static image contains no timing evidence."},
            "accessibility": {"status": "inferred", "confidence": 0.5, "evidence": [{"label": "derived", "ref": "image.contrast"}], "summary": "Meet semantic, contrast, focus, and reduced-motion requirements."},
            "content": {"status": "inferred", "confidence": 0.7, "evidence": [{"label": "screenshot", "ref": "fixture.png"}], "summary": "Keep concise editorial copy density."},
            "constraints": {"status": "user", "confidence": 1, "evidence": [{"label": "user", "ref": "rights-mode"}], "summary": "Do not copy source brand assets."},
        },
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
            invalid["sections"]["visualIntent"]["status"] = "guessed-without-evidence"
            invalid_path.write_text(json.dumps(invalid), encoding="utf-8")

            accepted = run_script("validate_spec.py", "--input", valid_path)
            rejected = run_script("validate_spec.py", "--input", invalid_path)

            self.assertEqual(accepted.returncode, 0, accepted.stderr)
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("status", rejected.stderr.lower())


if __name__ == "__main__":
    unittest.main()
