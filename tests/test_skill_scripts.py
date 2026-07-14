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
sys.path.insert(0, str(SCRIPTS))

import compile_prompt as prompt_compiler  # noqa: E402
from compile_prompt import compile_evidence_report  # noqa: E402
from inspect_image import inspect_image  # noqa: E402
from validate_spec import validate_spec  # noqa: E402


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
            self.assertEqual(evidence["source"]["path"], image_path.name)
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
            use_now = (output_dir / "use-now.md").read_text(encoding="utf-8")
            evidence_report = (output_dir / "evidence-report.md").read_text(encoding="utf-8")
            self.assertIn("## 1. Mission and scope", prompt)
            self.assertIn("## 13. Unknown-handling rules", prompt)
            self.assertIn("Do not copy source brand assets", prompt)
            self.assertIn("Evidence: [visual-model] image.composition", prompt)
            self.assertIn("## Rights boundary", use_now)
            self.assertIn("## Design rules", use_now)
            self.assertIn("## Unknowns", use_now)
            self.assertNotIn("```", use_now)
            self.assertIn("## Evidence references", evidence_report)
            self.assertIn("[visual-model] image.composition", evidence_report)
            self.assertRegex(evidence_report, r"Evidence-backed sections: \d+/15")
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

    def test_validator_enforces_additional_properties_token_shapes_and_css_safety(self):
        cases = []

        extra = valid_spec()
        extra["metadata"]["extra"] = True
        cases.append((extra, "metadata.extra"))

        unsupported = valid_spec()
        unsupported["tokens"]["unsupported"] = {"value": "x"}
        cases.append((unsupported, "tokens.unsupported"))

        nested = valid_spec()
        nested["tokens"]["colors"]["accent"] = {"value": "#3157f5"}
        cases.append((nested, "tokens.colors.accent"))

        css_injection = valid_spec()
        css_injection["tokens"]["colors"]["attack"] = "red; } body { color: black"
        cases.append((css_injection, "unsafe CSS syntax"))

        for spec, expected in cases:
            with self.subTest(expected=expected):
                self.assertIn(expected, "\n".join(validate_spec(spec)))

    def test_css_compiler_refuses_unsafe_tokens_when_called_directly(self):
        spec = valid_spec()
        spec["tokens"]["colors"]["attack"] = "red; } body { color: black"

        with self.assertRaisesRegex(ValueError, "unsafe CSS syntax"):
            prompt_compiler.compile_css(spec)

    def test_image_inspection_rejects_size_limits_without_loading_and_hashes_safely(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            image_path = directory / "large.png"
            Image.new("RGB", (20, 20), "#3157F5").save(image_path)

            with self.assertRaisesRegex(ValueError, "pixel limit"):
                inspect_image(image_path, max_pixels=100)
            with self.assertRaisesRegex(ValueError, "file-size limit"):
                inspect_image(image_path, max_bytes=1)

    def test_use_now_and_evidence_report_are_semantic_complete_artifacts(self):
        spec = valid_spec()
        self.assertTrue(
            callable(getattr(prompt_compiler, "compile_use_now", None)),
            "compile_use_now must provide semantic generation instead of line slicing",
        )
        use_now = prompt_compiler.compile_use_now(spec)
        report = compile_evidence_report(spec)

        self.assertTrue(use_now.startswith("# Use now\n"))
        self.assertIn(spec["metadata"]["title"], use_now)
        self.assertIn(spec["sections"]["constraints"]["summary"], use_now)
        self.assertIn("Font files cannot be proven from pixels", use_now)
        self.assertIn("Evidence-backed sections:", report)
        self.assertIn("[derived] image.palette", report)

    def test_eval_files_use_packaged_relative_fixtures(self):
        evals_path = SKILL / "evals" / "evals.json"
        evals = json.loads(evals_path.read_text(encoding="utf-8"))

        for evaluation in evals["evals"]:
            for filename in evaluation.get("files", []):
                with self.subTest(filename=filename):
                    self.assertFalse(Path(filename).is_absolute())
                    self.assertTrue((SKILL / filename).is_file())


if __name__ == "__main__":
    unittest.main()
