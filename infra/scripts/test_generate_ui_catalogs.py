import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("generate_ui_catalogs.py")
SPEC = importlib.util.spec_from_file_location("generate_ui_catalogs", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class GenerateUiCatalogsTests(unittest.TestCase):
    def test_generation_runtime_pins_the_known_good_transformers_loader(self):
        requirements = (
            MODULE_PATH.parent.parent / "requirements-i18n-generation.txt"
        ).read_text(encoding="utf-8")

        self.assertEqual(MODULE.VERIFIED_TRANSFORMERS, "4.57.6")
        self.assertIn("transformers==4.57.6", requirements.splitlines())

    def test_cuda_generation_uses_the_verified_float16_dtype(self):
        self.assertEqual(
            getattr(MODULE, "VERIFIED_CUDA_DTYPE", None),
            "float16",
        )

    def test_model_healthcheck_rejects_degenerate_smoke_translations(self):
        validator = getattr(MODULE, "validate_model_smoke_translation", None)
        self.assertIsNotNone(
            validator,
            "catalog generation must fail fast when the model loader emits empty or unknown output",
        )
        if validator is None:
            return

        validator("I love pizza!", "Ich liebe Pizza!")
        for broken in ("", "<unk>", "I love pizza!"):
            with self.subTest(broken=broken):
                with self.assertRaisesRegex(RuntimeError, "model health check failed"):
                    validator("I love pizza!", broken)

    def test_generation_budget_scales_with_input_and_remains_bounded(self):
        self.assertEqual(MODULE.generation_token_budget(2), 32)
        self.assertEqual(MODULE.generation_token_budget(20), 76)
        self.assertEqual(MODULE.generation_token_budget(200), 256)

    def test_shields_and_restores_brand_and_placeholders(self):
        source = "Saved {0} items for NUR at user@example.com."
        shielded, tokens = MODULE.shield_tokens(source)

        self.assertNotIn("NUR", shielded)
        self.assertNotIn("{0}", shielded)
        self.assertEqual(MODULE.restore_tokens(shielded, tokens), source)

    def test_splits_protected_tokens_out_of_model_input(self):
        source = "Saved {0} items for NUR at user@example.com."

        self.assertEqual(
            MODULE.split_for_translation(source),
            [
                (False, "Saved "),
                (True, "{0}"),
                (False, " items for "),
                (True, "NUR"),
                (False, " at "),
                (True, "user@example.com"),
                (False, "."),
            ],
        )

    def test_splits_placeholder_adjacent_version_marker_out_of_model_input(self):
        self.assertEqual(
            MODULE.split_for_translation("{0} · {1} v{2}"),
            [
                (True, "{0}"),
                (False, " · "),
                (True, "{1}"),
                (False, " "),
                (True, "v"),
                (True, "{2}"),
            ],
        )

    def test_variant_catalog_ids_cover_exactly_35_locales_and_37_catalogs(self):
        self.assertEqual(len(MODULE.SUPPORTED_LOCALES), 35)
        self.assertEqual(len(MODULE.catalog_targets()), 37)
        self.assertEqual(
            [row.catalog_id for row in MODULE.catalog_targets() if row.locale == "ur"],
            ["ur-roman", "ur-script"],
        )
        self.assertEqual(
            [row.catalog_id for row in MODULE.catalog_targets() if row.locale == "hi"],
            ["hi-roman", "hi-script"],
        )

    def test_validation_rejects_missing_keys_changed_brand_and_placeholders(self):
        english = {"NUR": "NUR", "Saved {0}": "Saved {0}", "Open": "Open"}

        with self.assertRaisesRegex(ValueError, "key parity"):
            MODULE.validate_catalog("de", english, {"NUR": "NUR"})
        with self.assertRaisesRegex(ValueError, "NUR invariant"):
            MODULE.validate_catalog("de", english, {"NUR": "NNR", "Saved {0}": "Gespeichert {0}", "Open": "Offen"})
        with self.assertRaisesRegex(ValueError, "placeholder parity"):
            MODULE.validate_catalog("de", english, {"NUR": "NUR", "Saved {0}": "Gespeichert", "Open": "Offen"})

    def test_roman_validation_rejects_native_script_leakage(self):
        english = {"NUR": "NUR", "Open": "Open"}
        with self.assertRaisesRegex(ValueError, "native-script leakage"):
            MODULE.validate_catalog("ur-roman", english, {"NUR": "NUR", "Open": "کھولیں"})
        with self.assertRaisesRegex(ValueError, "native-script leakage"):
            MODULE.validate_catalog("hi-roman", english, {"NUR": "NUR", "Open": "खोलें"})

    def test_validation_rejects_corrupt_date_and_repetition_outputs(self):
        english = {
            "NUR": "NUR",
            "Orbit Scan Free": "Orbit Scan Free",
            "Open Consultation": "Open Consultation",
        }

        with self.assertRaisesRegex(ValueError, "invented repeated dates|implausible output length"):
            MODULE.validate_catalog(
                "de",
                english,
                {
                    "NUR": "NUR",
                    "Orbit Scan Free": "2018.07.15 2018.07.16 2018.07.17 2018.07.18 2018.07.19",
                    "Open Consultation": "Offene Konsultation",
                },
            )
        with self.assertRaisesRegex(ValueError, "degenerate repeated tokens"):
            MODULE.validate_catalog(
                "fr",
                english,
                {
                    "NUR": "NUR",
                    "Orbit Scan Free": "Analyse orbitale gratuite",
                    "Open Consultation": "texte texte texte texte texte texte texte texte",
                },
            )

    def test_validation_detects_repetition_in_combining_mark_scripts(self):
        translated = (
            "घटनाक्रम, घटनाक्रम, घटनाक्रम, घटनाक्रम, घटनाक्रम, "
            "घटनाक्रम, घटनाक्रम, घटनाक्रम"
        )

        self.assertEqual(
            MODULE.translation_anomaly("A normal sentence about events.", translated),
            "degenerate repeated tokens",
        )

    def test_catalog_update_plan_regenerates_anomalous_existing_output(self):
        english = {"NUR": "NUR", "Orbit Scan Free": "Orbit Scan Free"}
        existing = {
            "NUR": "NUR",
            "Orbit Scan Free": "2018.07.15 2018.07.16 2018.07.17 2018.07.18 2018.07.19",
        }

        preserved, missing = MODULE.catalog_update_plan("de", english, existing)

        self.assertEqual(preserved, {"NUR": "NUR"})
        self.assertEqual(missing, ["Orbit Scan Free"])

    def test_empty_model_output_is_retried_individually_without_english_fallback(self):
        translator = object.__new__(MODULE.MadladTranslator)
        translator.batch_size = 4
        calls = []

        def generate(values, language, *, num_beams):
            calls.append((values, language, num_beams))
            if values == ["Consultation title."]:
                return ["परामर्श शीर्षक."]
            return ["" if value == "Consultation title" else "आकाश" for value in values]

        translator._generate_batch = generate

        self.assertEqual(
            translator._translate_pieces(["Consultation title", "Sky"], "hi"),
            {"Consultation title": "परामर्श शीर्षक", "Sky": "आकाश"},
        )
        self.assertEqual(
            calls,
            [
                (["Consultation title", "Sky"], "hi", 1),
                (["Consultation title"], "hi", 1),
                (["Consultation title."], "hi", 1),
            ],
        )

    def test_degenerate_model_output_is_retried_with_safe_prompt_variation(self):
        translator = object.__new__(MODULE.MadladTranslator)
        translator.batch_size = 4
        calls = []

        def generate(values, language, *, num_beams):
            calls.append((values, language, num_beams))
            if values == ["Context held gently."]:
                return ["متن نرمی سے رکھا"]
            return ["h h h h h h h h h h"]

        translator._generate_batch = generate

        self.assertEqual(
            translator._translate_pieces(["Context, held gently."], "ur"),
            {"Context, held gently.": "متن نرمی سے رکھا"},
        )
        self.assertEqual(
            calls,
            [
                (["Context, held gently."], "ur", 1),
                (["Context, held gently."], "ur", 1),
                (["Context held gently."], "ur", 1),
            ],
        )

    def test_invalid_batch_tokens_are_retried_individually_without_fallback(self):
        translator = object.__new__(MODULE.MadladTranslator)
        translator.batch_size = 4
        calls = []

        def generate(values, language, *, num_beams):
            calls.append((values, language, num_beams))
            if len(values) > 1:
                raise MODULE.InvalidModelTokenError("invalid generated token")
            return [f"translated {values[0]}"]

        translator._generate_batch = generate

        self.assertEqual(
            translator._translate_pieces(["First", "Second"], "de"),
            {"First": "translated First", "Second": "translated Second"},
        )
        self.assertEqual(
            calls,
            [
                (["First", "Second"], "de", 1),
                (["First"], "de", 1),
                (["Second"], "de", 1),
            ],
        )

    def test_catalog_update_plan_preserves_valid_entries_and_regenerates_only_gaps(self):
        english = {
            "NUR": "NUR",
            "Open": "Open",
            "Saved {0}": "Saved {0}",
            "New": "New",
        }
        existing = {
            "NUR": "NUR",
            "Open": "Offen",
            "Saved {0}": "Gespeichert",
            "Removed": "Entfernt",
        }

        preserved, missing = MODULE.catalog_update_plan("de", english, existing)

        self.assertEqual(preserved, {"NUR": "NUR", "Open": "Offen"})
        self.assertEqual(missing, ["Saved {0}", "New"])

    def test_catalog_update_plan_rejects_native_script_in_roman_catalog(self):
        english = {"NUR": "NUR", "Open": "Open"}
        existing = {"NUR": "NUR", "Open": "کھولیں"}

        preserved, missing = MODULE.catalog_update_plan("ur-roman", english, existing)

        self.assertEqual(preserved, {"NUR": "NUR"})
        self.assertEqual(missing, ["Open"])

    def test_catalog_update_plan_regenerates_unexplained_english(self):
        english = {"NUR": "NUR", "No persisted Timeline event yet.": "No persisted Timeline event yet."}
        existing = dict(english)

        preserved, missing = MODULE.catalog_update_plan("es", english, existing)

        self.assertEqual(preserved, {"NUR": "NUR"})
        self.assertEqual(missing, ["No persisted Timeline event yet."])

    def test_catalog_update_plan_allows_only_target_scoped_native_loanwords(self):
        english = {
            "NUR": "NUR",
            "lens": "lens",
            "Demo": "Demo",
            "DEMO": "DEMO",
            "plan": "plan",
            "Plan": "Plan",
            "Risk": "Risk",
            "{0} lens": "{0} lens",
        }

        turkish_preserved, turkish_missing = MODULE.catalog_update_plan("tr", english, dict(english))
        german_preserved, german_missing = MODULE.catalog_update_plan("de", english, dict(english))

        self.assertEqual(turkish_preserved, english)
        self.assertEqual(turkish_missing, [])
        self.assertEqual(german_preserved, {"NUR": "NUR"})
        self.assertEqual(
            german_missing,
            ["lens", "Demo", "DEMO", "plan", "Plan", "Risk", "{0} lens"],
        )

    def test_reviewed_translation_overrides_are_target_scoped(self):
        expected = {
            "Moderator": "Moderatör",
            "Momentum": "İvme",
            "Roman / transliterated": "Latin / çevriyazılı",
            "V90 master star": "V90 ana yıldız",
        }
        self.assertEqual(
            {source: MODULE.reviewed_translation_override("tr", source) for source in expected},
            expected,
        )
        self.assertIsNone(MODULE.reviewed_translation_override("de", "Moderator"))

    def test_product_and_structural_names_remain_global_invariants(self):
        english = {
            "NUR": "NUR",
            "NUR Plus": "NUR Plus",
            "Omega": "Omega",
            "Plus": "Plus",
            "R": "R",
        }

        preserved, missing = MODULE.catalog_update_plan("de", english, dict(english))

        self.assertEqual(preserved, english)
        self.assertEqual(missing, [])

    def test_catalog_update_plan_preserves_cryptographic_identifiers(self):
        english = {
            "NUR": "NUR",
            "· sha256": "· sha256",
            "SHA-256": "SHA-256",
            "{0} · sha256 {1}… · {2}": "{0} · sha256 {1}… · {2}",
        }

        preserved, missing = MODULE.catalog_update_plan("ur-script", english, dict(english))

        self.assertEqual(preserved, english)
        self.assertEqual(missing, [])

    def test_catalog_update_plan_preserves_structural_version_templates(self):
        english = {
            "NUR": "NUR",
            "{0} · {1} v{2}": "{0} · {1} v{2}",
            "{0} · v{1}": "{0} · v{1}",
        }

        preserved, missing = MODULE.catalog_update_plan("ur-script", english, dict(english))

        self.assertEqual(preserved, english)
        self.assertEqual(missing, [])

    def test_translation_isolates_decorative_separators_from_semantic_text(self):
        translator = object.__new__(MODULE.MadladTranslator)
        calls = []

        def translate_pieces(values, language):
            calls.append((values, language))
            return {"members": "ارکان", "status": "حالت"}

        translator._translate_pieces = translate_pieces

        self.assertEqual(
            translator.translate(["members · {0}", "· status"], "ur"),
            ["ارکان · {0}", "· حالت"],
        )
        self.assertEqual(calls, [(["members", "status"], "ur")])

    def test_isolates_percentage_marker_from_semantic_text(self):
        self.assertEqual(
            MODULE.isolate_decorative_edges("% confidence"),
            ("% ", "confidence", ""),
        )

    def test_retry_prompts_sentence_case_lowercase_ui_labels(self):
        self.assertEqual(
            MODULE.model_retry_prompts("owner timeline"),
            ["owner timeline", "Owner timeline."],
        )

    def test_primary_retry_uses_lazy_secondary_translator_before_failing(self):
        translator = object.__new__(MODULE.MadladTranslator)
        translator._fallback = None
        fallback_loads = []

        class Fallback:
            def translate_one(self, source, language):
                self.last_call = (source, language)
                return "Aksi"

        fallback = Fallback()
        translator._fallback_factory = lambda: fallback_loads.append(True) or fallback
        translator._generate_batch = lambda values, language, *, num_beams: list(values)

        self.assertEqual(translator._retry_piece("action", "id"), "Aksi")
        self.assertEqual(fallback.last_call, ("action", "id"))
        self.assertEqual(fallback_loads, [True])

    def test_secondary_source_identical_output_remains_a_hard_failure(self):
        translator = object.__new__(MODULE.MadladTranslator)
        translator._fallback = None

        class Fallback:
            def translate_one(self, source, language):
                return source

        translator._fallback_factory = Fallback
        translator._generate_batch = lambda values, language, *, num_beams: list(values)

        with self.assertRaisesRegex(ValueError, "source-identical model output"):
            translator._retry_piece("Milestone", "id")

    def test_m2m100_language_map_is_explicit_and_uses_tagalog_for_filipino(self):
        self.assertEqual(MODULE.M2M100_LANGUAGE["fil"], "tl")
        self.assertEqual(MODULE.M2M100_LANGUAGE["id"], "id")
        self.assertNotIn(
            "te",
            MODULE.M2M100_LANGUAGE,
            "M2M100 does not support Telugu; the generator must not invent a language id",
        )

    def test_reviewed_indonesian_terms_are_native_and_target_scoped(self):
        expected = {
            "Milestone": "Tonggak pencapaian",
            "Neural Upgrade Rewiring": "Peningkatan dan pengawatan ulang saraf",
            "V90 master star": "bintang utama V90",
        }
        self.assertEqual(
            {source: MODULE.reviewed_translation_override("id", source) for source in expected},
            expected,
        )
        self.assertIsNone(MODULE.reviewed_translation_override("ms", "Milestone"))

    def test_reviewed_vietnamese_demo_label_is_not_an_english_fallback(self):
        self.assertEqual(MODULE.reviewed_translation_override("vi", "Demo"), "Bản thử")
        self.assertEqual(MODULE.reviewed_translation_override("vi", "DEMO"), "BẢN THỬ")
        self.assertIsNone(MODULE.reviewed_translation_override("id", "DEMO"))

    def test_degenerate_compound_sentence_retries_comma_delimited_clauses(self):
        translator = object.__new__(MODULE.MadladTranslator)
        translator._fallback = None
        translator._fallback_factory = None
        source = "Projects keeps objective, tasks, reviews and owner approval."
        full_prompts = set(MODULE.model_retry_prompts(source))
        translations = {
            "Projects keeps objective": "ലക്ഷ്യം സൂക്ഷിക്കുന്നു",
            "tasks": "ചുമതലകൾ",
            "reviews and owner approval.": "അവലോകനങ്ങളും ഉടമയുടെ അംഗീകാരവും.",
        }

        def generate(values, language, *, num_beams):
            value = values[0]
            if value in full_prompts:
                return ["റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ റിപ്പോർട്ടുകൾ"]
            return [translations[value]]

        translator._generate_batch = generate

        self.assertEqual(
            translator._retry_piece(source, "ml"),
            "ലക്ഷ്യം സൂക്ഷിക്കുന്നു, ചുമതലകൾ, അവലോകനങ്ങളും ഉടമയുടെ അംഗീകാരവും.",
        )


if __name__ == "__main__":
    unittest.main()
