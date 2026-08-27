#!/usr/bin/env python3
"""Generate complete, offline NUR UI catalogs from the canonical English schema.

Generation is a maintainer operation, not a runtime dependency. The default
model is Apache-2.0 MADLAD-400; generated catalogs remain explicitly marked for
native-language review in the product metadata.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import re
import sys
import unicodedata
from collections.abc import Iterable
from pathlib import Path
from typing import NamedTuple


SUPPORTED_LOCALES = (
    "en", "ur", "hi", "bn", "pa", "ar", "fa", "tr", "id", "ms",
    "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta", "te",
    "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt",
    "it", "nl", "sv", "ro", "sw",
)

MODEL_LANGUAGE = {
    locale: language
    for locale, language in {
        "ur": "ur", "hi": "hi", "bn": "bn", "pa": "pa", "ar": "ar",
        "fa": "fa", "tr": "tr", "id": "id", "ms": "ms", "zh-Hans": "zh",
        "zh-Hant": "zh", "ja": "ja", "ko": "ko", "vi": "vi", "th": "th",
        "fil": "fil", "ta": "ta", "te": "te", "mr": "mr", "gu": "gu",
        "kn": "kn", "ml": "ml", "ru": "ru", "uk": "uk", "pl": "pl",
        "de": "de", "fr": "fr", "es": "es", "pt": "pt", "it": "it",
        "nl": "nl", "sv": "sv", "ro": "ro", "sw": "sw",
    }.items()
}

# M2M100 is an MIT-licensed, maintainer-only fallback for isolated labels that
# MADLAD cannot render. Its published language inventory uses ``tl`` for
# Filipino and does not include Telugu, so unsupported targets remain a hard
# failure instead of being silently assigned the wrong language.
M2M100_LANGUAGE = {
    language: language
    for language in set(MODEL_LANGUAGE.values())
    if language not in {"fil", "te"}
}
M2M100_LANGUAGE["fil"] = "tl"

PROTECTED = re.compile(
    r"NUR|\bv(?=\{\d+\})|\{\d+\}|https?://[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|</?[^>]+>",
    re.UNICODE,
)
PLACEHOLDER = re.compile(r"\{\d+\}")
ROMAN_SCRIPT_LEAKAGE = re.compile(r"[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f]")
DATE_FRAGMENT = re.compile(r"\b\d{4}[./-]\d{2}[./-]\d{2}\b")
WORD_TOKEN = re.compile(r"\w+", re.UNICODE)
VERIFIED_PYTHON = (3, 12)
VERIFIED_TRANSFORMERS = "4.57.6"
VERIFIED_TORCH = "2.8.0"
VERIFIED_CUDA_DTYPE = "float16"
APPROVED_SOURCE_INVARIANTS = {
    "NUR",
    "NUR Plus",
    "OpenAI",
    "Omega",
    "Plus",
    "R",
    "Amina Rahman",
    "Naval Ravikant",
    "Seth Godin",
    "Sharon Salzberg",
    "Adrienne Maree Brown",
    "you@example.com",
    "NUR DIAG RM:{0}",
}
TARGET_NATIVE_LOANWORDS = {
    "tr": frozenset({"lens", "demo", "plan", "risk"}),
    "id": frozenset({
        "audit", "demo", "internal", "interval", "moderator", "momentum",
        "operator", "orbit", "provider", "status",
    }),
}
REVIEWED_TRANSLATION_OVERRIDES = {
    "tr": {
        "Moderator": "Moderatör",
        "Momentum": "İvme",
        "Roman / transliterated": "Latin / çevriyazılı",
        "V90 master star": "V90 ana yıldız",
    },
    "id": {
        "Draft": "Draf",
        "Draft Plan": "Rencana draf",
        "GLOWS": "PIJAR",
        "Horizon": "Cakrawala",
        "Horizons": "Cakrawala",
        "IN_APP_ONLY": "HANYA DI APLIKASI",
        "Milestone": "Tonggak pencapaian",
        "Milestones": "Tonggak pencapaian",
        "Neural Upgrade": "Peningkatan saraf",
        "Neural Upgrade Rewiring": "Peningkatan dan pengawatan ulang saraf",
        "ORIENT": "ARAHKAN",
        "Orient": "Arahkan",
        "Path": "Jalur",
        "Present": "Sekarang",
        "Self": "Diri",
        "V90 master star": "bintang utama V90",
        "draft": "draf",
    },
    "vi": {
        "DEMO": "BẢN THỬ",
        "Demo": "Bản thử",
    },
}
ADDRESS_OR_PATH = re.compile(r"^(?:https?://|[^\s@]+@[^\s@]+\.[^\s@]+|/[A-Za-z0-9_./-]+$)")
INVARIANT_UNIT = re.compile(r"^\{\d+\}\s*(?:B|KB|MB|GB|TB)$")
CRYPTOGRAPHIC_IDENTIFIER = re.compile(
    r"^[\s·:()\[\].…-]*(?:sha-?256|sha-?512|md5)[\s·:()\[\].…-]*$",
    re.IGNORECASE,
)
VERSION_TEMPLATE = re.compile(
    r"^(?:\{\d+\}[\s·|:()/-]*)*v\{\d+\}$",
    re.IGNORECASE,
)


class CatalogTarget(NamedTuple):
    locale: str
    preference: str
    catalog_id: str


class InvalidModelTokenError(ValueError):
    """Raised when generation returns token ids the tokenizer cannot decode."""


def catalog_targets() -> list[CatalogTarget]:
    targets: list[CatalogTarget] = [CatalogTarget("en", "default", "en")]
    for locale in SUPPORTED_LOCALES[1:]:
        if locale in {"ur", "hi"}:
            targets.extend((
                CatalogTarget(locale, "roman", f"{locale}-roman"),
                CatalogTarget(locale, "script", f"{locale}-script"),
            ))
        else:
            preference = "script" if locale in {
                "bn", "pa", "ar", "fa", "zh-Hans", "zh-Hant", "ja", "ko",
                "th", "ta", "te", "mr", "gu", "kn", "ml", "ru", "uk",
            } else "default"
            targets.append(CatalogTarget(locale, preference, locale))
    return targets


def shield_tokens(source: str) -> tuple[str, list[tuple[str, str]]]:
    tokens: list[tuple[str, str]] = []

    def replace(match: re.Match[str]) -> str:
        marker = f"ZXQPROTECTED{len(tokens)}QXZ"
        tokens.append((marker, match.group(0)))
        return marker

    return PROTECTED.sub(replace, source), tokens


def restore_tokens(value: str, tokens: list[tuple[str, str]]) -> str:
    restored = value
    for marker, original in tokens:
        if marker not in restored:
            raise ValueError(f"translation dropped protected token {original!r}")
        restored = restored.replace(marker, original)
    return restored


def split_for_translation(source: str) -> list[tuple[bool, str]]:
    """Keep placeholders, brand, markup and addresses out of model input."""
    segments: list[tuple[bool, str]] = []
    cursor = 0
    for match in PROTECTED.finditer(source):
        if match.start() > cursor:
            segments.append((False, source[cursor:match.start()]))
        segments.append((True, match.group(0)))
        cursor = match.end()
    if cursor < len(source):
        segments.append((False, source[cursor:]))
    return segments


def has_words(value: str) -> bool:
    return any(character.isalnum() for character in value)


def isolate_decorative_edges(value: str) -> tuple[str, str, str]:
    prefix_match = re.match(r"^[%·|→←↻✦◆◇○◉◎⌕]+\s*", value, re.UNICODE)
    prefix = prefix_match.group(0) if prefix_match else ""
    without_prefix = value[len(prefix):]
    suffix_match = re.search(r"\s*[%·|→←↻✦◆◇○◉◎⌕]+$", without_prefix, re.UNICODE)
    suffix = suffix_match.group(0) if suffix_match else ""
    semantic = without_prefix[:len(without_prefix) - len(suffix)] if suffix else without_prefix
    return prefix, semantic, suffix


def approved_source_invariant(source: str) -> bool:
    if source in APPROVED_SOURCE_INVARIANTS:
        return True
    semantic = PLACEHOLDER.sub("", source)
    if semantic.strip(" ·:()[]-.…") in APPROVED_SOURCE_INVARIANTS:
        return True
    if (
        ADDRESS_OR_PATH.match(source)
        or INVARIANT_UNIT.match(source)
        or CRYPTOGRAPHIC_IDENTIFIER.match(semantic)
        or VERSION_TEMPLATE.match(source)
    ):
        return True
    return not any(character.isalpha() for character in semantic)


def approved_source_identical(target: str, source: str) -> bool:
    locale = target.split("-", 1)[0]
    normalized = source.casefold()
    loanwords = (
        TARGET_NATIVE_LOANWORDS.get(target, frozenset())
        | TARGET_NATIVE_LOANWORDS.get(locale, frozenset())
    )
    semantic = PLACEHOLDER.sub("", source)
    _, semantic, _ = isolate_decorative_edges(semantic.strip())
    semantic_words = [word.casefold() for word in WORD_TOKEN.findall(semantic)]
    return (
        approved_source_invariant(source)
        or normalized in loanwords
        or (bool(semantic_words) and all(word in loanwords for word in semantic_words))
    )


def reviewed_translation_override(target: str, source: str) -> str | None:
    locale = target.split("-", 1)[0]
    return (
        REVIEWED_TRANSLATION_OVERRIDES.get(target, {}).get(source)
        or REVIEWED_TRANSLATION_OVERRIDES.get(locale, {}).get(source)
    )


def translation_anomaly(source: str, translated: str) -> str | None:
    """Reject model degeneration without policing legitimate short translations."""
    stripped = translated.strip()
    if len(stripped) > max(96, len(source.strip()) * 6):
        return "implausible output length"
    if not any(character.isdigit() for character in source) and len(DATE_FRAGMENT.findall(stripped)) >= 2:
        return "invented repeated dates"

    repetition_text = "".join(
        character
        for character in unicodedata.normalize("NFKD", stripped)
        if unicodedata.category(character) not in {"Mn", "Mc", "Me"}
    )
    words = [token.casefold() for token in WORD_TOKEN.findall(repetition_text)]
    if len(words) >= 8:
        most_common = max(words.count(token) for token in set(words))
        if most_common >= 5 and most_common / len(words) >= 0.45:
            return "degenerate repeated tokens"

    semantic_characters = [character.casefold() for character in stripped if character.isalnum()]
    if len(semantic_characters) >= 24 and len(set(semantic_characters)) <= 2:
        return "degenerate low-diversity output"
    return None


def require_verified_generation_runtime() -> None:
    python_version = sys.version_info[:2]
    if python_version != VERIFIED_PYTHON:
        raise RuntimeError(
            "Catalog generation requires the verified Python "
            f"{VERIFIED_PYTHON[0]}.{VERIFIED_PYTHON[1]} environment; got "
            f"{python_version[0]}.{python_version[1]}."
        )
    installed = {
        package: importlib.metadata.version(package)
        for package in ("transformers", "torch")
    }
    expected = {
        "transformers": VERIFIED_TRANSFORMERS,
        "torch": VERIFIED_TORCH,
    }
    if installed != expected:
        raise RuntimeError(
            "Catalog generation dependency mismatch; install "
            "infra/requirements-i18n-generation.txt. "
            f"Expected {expected!r}, got {installed!r}."
        )


def validate_catalog(catalog_id: str, english: dict[str, str], catalog: dict[str, str]) -> None:
    if set(catalog) != set(english):
        missing = sorted(set(english) - set(catalog))[:5]
        extra = sorted(set(catalog) - set(english))[:5]
        raise ValueError(f"{catalog_id}: key parity failure; missing={missing!r} extra={extra!r}")
    if catalog.get("NUR") != "NUR":
        raise ValueError(f"{catalog_id}: NUR invariant changed")
    for source, translated in catalog.items():
        if not isinstance(translated, str) or not translated.strip():
            raise ValueError(f"{catalog_id}: empty translation for {source!r}")
        if sorted(PLACEHOLDER.findall(source)) != sorted(PLACEHOLDER.findall(translated)):
            raise ValueError(f"{catalog_id}: placeholder parity failure for {source!r}")
        anomaly = translation_anomaly(source, translated)
        if anomaly:
            raise ValueError(f"{catalog_id}: {anomaly} for {source!r}: {translated!r}")
        if catalog_id != "en" and source == translated and not approved_source_identical(catalog_id, source):
            raise ValueError(
                f"{catalog_id}: unexplained English source-identical translation for {source!r}"
            )
    if catalog_id in {"ur-roman", "hi-roman"}:
        leaked = next((value for value in catalog.values() if ROMAN_SCRIPT_LEAKAGE.search(value)), None)
        if leaked:
            raise ValueError(f"{catalog_id}: native-script leakage in {leaked!r}")


def reusable_translation(catalog_id: str, source: str, translated: object) -> bool:
    if not isinstance(translated, str) or not translated.strip():
        return False
    if source == "NUR" and translated != "NUR":
        return False
    if sorted(PLACEHOLDER.findall(source)) != sorted(PLACEHOLDER.findall(translated)):
        return False
    if translation_anomaly(source, translated):
        return False
    if catalog_id != "en" and source == translated and not approved_source_identical(catalog_id, source):
        return False
    if catalog_id in {"ur-roman", "hi-roman"} and ROMAN_SCRIPT_LEAKAGE.search(translated):
        return False
    return True


def catalog_update_plan(
    catalog_id: str,
    english: dict[str, str],
    existing: dict[str, object],
) -> tuple[dict[str, str], list[str]]:
    preserved: dict[str, str] = {}
    missing: list[str] = []
    for source in english:
        translated = existing.get(source)
        if reusable_translation(catalog_id, source, translated):
            preserved[source] = translated
        else:
            missing.append(source)
    return preserved, missing


def render_variant(target: CatalogTarget, native: dict[str, str]) -> dict[str, str]:
    if target.catalog_id.endswith("-roman"):
        from anyascii import anyascii
        return {
            source: ("NUR" if source == "NUR" else anyascii(value))
            for source, value in native.items()
        }
    if target.locale == "zh-Hant":
        from opencc import OpenCC
        converter = OpenCC("s2t")
        return {
            source: ("NUR" if source == "NUR" else converter.convert(value))
            for source, value in native.items()
        }
    return native


def batches(values: list[str], size: int) -> Iterable[list[str]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]


def generation_token_budget(input_width: int) -> int:
    return min(256, max(32, input_width * 3 + 16))


def model_retry_prompts(source: str) -> list[str]:
    normalized = re.sub(r"\s*[,;:]\s*", " ", source).strip()
    prompts = list(dict.fromkeys((source, normalized)))
    terminal_source = normalized or source
    if terminal_source:
        sentence_cased = f"{terminal_source[0].upper()}{terminal_source[1:]}"
        if not sentence_cased.endswith((".", "!", "?")):
            sentence_cased = f"{sentence_cased}."
        if sentence_cased not in prompts:
            prompts.append(sentence_cased)
    return prompts


def validate_model_smoke_translation(source: str, translated: str) -> None:
    normalized = translated.strip()
    if (
        not normalized
        or "<unk>" in normalized.casefold()
        or normalized.casefold() == source.strip().casefold()
    ):
        raise RuntimeError(
            "MADLAD model health check failed: the verified loader must produce "
            f"a non-empty translation, got {translated!r}."
        )


class M2M100Translator:
    """Lazy secondary translator for labels MADLAD cannot resolve."""

    def __init__(self, model_id: str, device: str = "auto", threads: int | None = None) -> None:
        require_verified_generation_runtime()
        import torch
        from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer

        self.torch = torch
        selected_device = "cuda" if device == "auto" and torch.cuda.is_available() else device
        if selected_device == "auto":
            selected_device = "cpu"
        if selected_device == "cpu" and threads:
            torch.set_num_threads(threads)
        self.tokenizer = M2M100Tokenizer.from_pretrained(model_id)
        self.tokenizer.src_lang = "en"
        self.model = M2M100ForConditionalGeneration.from_pretrained(
            model_id,
            dtype=getattr(torch, VERIFIED_CUDA_DTYPE) if selected_device == "cuda" else torch.float32,
        ).to(selected_device)
        self.model.eval()

    def _generate_one(self, source: str, language: str) -> str:
        target_language = M2M100_LANGUAGE.get(language)
        if target_language is None:
            raise ValueError(f"M2M100 does not support language {language!r}")
        encoded = self.tokenizer(
            [source],
            return_tensors="pt",
            truncation=True,
            max_length=384,
        ).to(self.model.device)
        with self.torch.inference_mode():
            output = self.model.generate(
                **encoded,
                forced_bos_token_id=self.tokenizer.get_lang_id(target_language),
                max_new_tokens=generation_token_budget(encoded["input_ids"].shape[1]),
                num_beams=1,
            )
        return self.tokenizer.batch_decode(output, skip_special_tokens=True)[0].strip()

    def translate_one(self, source: str, language: str) -> str:
        last_failure = "empty fallback output"
        for prompt in model_retry_prompts(source):
            rendered = self._generate_one(prompt, language)
            if prompt.endswith(".") and not source.endswith((".", "!", "?")) and rendered.endswith("."):
                rendered = rendered[:-1].rstrip()
            anomaly = translation_anomaly(source, rendered)
            source_identical = (
                rendered.casefold() == source.casefold()
                and not approved_source_identical(language, source)
            )
            if rendered and anomaly is None and not source_identical:
                return rendered
            last_failure = anomaly or (
                "source-identical model output" if source_identical else "empty fallback output"
            )
        raise ValueError(f"{last_failure} for {source!r} in {language!r}")


class MadladTranslator:
    def __init__(
        self,
        model_id: str,
        batch_size: int,
        device: str = "auto",
        threads: int | None = None,
        fallback_factory=None,
    ) -> None:
        require_verified_generation_runtime()
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.torch = torch
        selected_device = "cuda" if device == "auto" and torch.cuda.is_available() else device
        if selected_device == "auto":
            selected_device = "cpu"
        if selected_device == "cpu" and threads:
            torch.set_num_threads(threads)
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            model_id,
            dtype=getattr(torch, VERIFIED_CUDA_DTYPE) if selected_device == "cuda" else torch.float32,
            device_map=selected_device,
        )
        self.model.eval()
        self.batch_size = batch_size
        self._fallback = None
        self._fallback_factory = fallback_factory
        smoke_source = "I love pizza!"
        smoke_translation = self._generate_batch(
            [smoke_source],
            "de",
            num_beams=1,
        )[0]
        validate_model_smoke_translation(smoke_source, smoke_translation)

    def _generate_batch(self, values: list[str], language: str, *, num_beams: int) -> list[str]:
        prepared = [f"<2{language}> {value}" for value in values]
        encoded = self.tokenizer(
            prepared,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=384,
        ).to(self.model.device)
        with self.torch.inference_mode():
            output = self.model.generate(
                **encoded,
                max_new_tokens=generation_token_budget(encoded["input_ids"].shape[1]),
                num_beams=num_beams,
            )
        token_rows = output.detach().to("cpu").tolist()
        vocabulary_size = len(self.tokenizer)
        invalid = next((
            token
            for row in token_rows
            for token in row
            if token < 0 or token >= vocabulary_size
        ), None)
        if invalid is not None:
            raise InvalidModelTokenError(
                f"model generated token id {invalid} outside vocabulary size {vocabulary_size}"
            )
        try:
            decoded = self.tokenizer.batch_decode(token_rows, skip_special_tokens=True)
        except OverflowError as error:
            raise InvalidModelTokenError("tokenizer rejected generated token ids") from error
        return [
            rendered.strip()
            for rendered in decoded
        ]

    def _retry_piece(
        self,
        source: str,
        language: str,
        *,
        allow_clause_split: bool = True,
    ) -> str:
        last_failure = "empty model output"
        for prompt in model_retry_prompts(source):
            try:
                rendered = self._generate_batch([prompt], language, num_beams=1)[0]
            except InvalidModelTokenError:
                last_failure = "invalid generated token"
                continue
            if prompt.endswith(".") and not source.endswith((".", "!", "?")) and rendered.endswith("."):
                rendered = rendered[:-1].rstrip()
            anomaly = translation_anomaly(source, rendered)
            source_identical = (
                rendered.casefold() == source.casefold()
                and not approved_source_identical(language, source)
            )
            if rendered and anomaly is None and not source_identical:
                return rendered
            last_failure = anomaly or ("source-identical model output" if source_identical else "empty model output")

        fallback_factory = getattr(self, "_fallback_factory", None)
        if fallback_factory is not None:
            if getattr(self, "_fallback", None) is None:
                self._fallback = fallback_factory()
            try:
                rendered = self._fallback.translate_one(source, language)
            except ValueError as error:
                fallback_failure = str(error).split(" for ", 1)[0]
                if fallback_failure:
                    last_failure = fallback_failure
            else:
                anomaly = translation_anomaly(source, rendered)
                source_identical = (
                    rendered.casefold() == source.casefold()
                    and not approved_source_identical(language, source)
                )
                if rendered and anomaly is None and not source_identical:
                    return rendered
                last_failure = anomaly or (
                    "source-identical model output" if source_identical else "empty fallback output"
                )

        if allow_clause_split and ("," in source or ";" in source):
            clause_parts = re.split(r"(\s*[,;]\s*)", source)
            rendered_parts: list[str] = []
            try:
                for part in clause_parts:
                    if not part or re.fullmatch(r"\s*[,;]\s*", part):
                        rendered_parts.append(part)
                        continue
                    leading = part[:len(part) - len(part.lstrip())]
                    trailing = part[len(part.rstrip()):]
                    semantic = part.strip()
                    rendered_parts.append(
                        f"{leading}{self._retry_piece(semantic, language, allow_clause_split=False)}{trailing}"
                    )
            except ValueError:
                pass
            else:
                rendered = "".join(rendered_parts)
                anomaly = translation_anomaly(source, rendered)
                source_identical = (
                    rendered.casefold() == source.casefold()
                    and not approved_source_identical(language, source)
                )
                if rendered and anomaly is None and not source_identical:
                    return rendered
        raise ValueError(f"{last_failure} for {source!r} in {language!r}")

    def _translate_pieces(self, pieces: list[str], language: str) -> dict[str, str]:
        translated: dict[str, str] = {}
        for batch in batches(pieces, self.batch_size):
            try:
                decoded = self._generate_batch(batch, language, num_beams=1)
            except InvalidModelTokenError:
                decoded = [
                    self._retry_piece(source, language)
                    for source in batch
                ]
            translated.update(zip(batch, decoded, strict=True))

            for source in (
                item for item in batch
                if (
                    not translated[item]
                    or translation_anomaly(item, translated[item]) is not None
                    or (
                        translated[item].casefold() == item.casefold()
                        and not approved_source_identical(language, item)
                    )
                )
            ):
                translated[source] = self._retry_piece(source, language)
        return translated

    def translate(self, values: list[str], language: str) -> list[str]:
        segmented = [split_for_translation(value) for value in values]
        pieces = list(dict.fromkeys(
            isolate_decorative_edges(piece.strip())[1]
            for segments in segmented
            for protected, piece in segments
            if not protected and has_words(isolate_decorative_edges(piece.strip())[1])
        ))
        translated_pieces = self._translate_pieces(pieces, language)

        translated: list[str] = []
        for segments in segmented:
            rendered: list[str] = []
            for protected, piece in segments:
                core = piece.strip()
                if protected or not core or not re.search(r"\w", core, re.UNICODE):
                    rendered.append(piece)
                    continue
                leading = piece[:len(piece) - len(piece.lstrip())]
                trailing = piece[len(piece.rstrip()):]
                decorative_prefix, semantic, decorative_suffix = isolate_decorative_edges(core)
                rendered.append(
                    f"{leading}{decorative_prefix}{translated_pieces[semantic]}"
                    f"{decorative_suffix}{trailing}"
                )
            translated.append("".join(rendered))
        return translated


def write_catalog(path: Path, catalog: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--model", default="google/madlad400-3b-mt")
    parser.add_argument("--fallback-model", default="facebook/m2m100_418M")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--threads", type=int)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--catalog", action="append", dest="catalogs")
    args = parser.parse_args()

    catalog_dir = args.root / "apps/web/src/lib/i18n/catalogs"
    english_path = catalog_dir / "en.json"
    english: dict[str, str] = json.loads(english_path.read_text(encoding="utf-8"))
    selected = [row for row in catalog_targets() if not args.catalogs or row.catalog_id in args.catalogs]
    unknown = set(args.catalogs or ()) - {row.catalog_id for row in catalog_targets()}
    if unknown:
        raise ValueError(f"Unknown catalog ids: {sorted(unknown)!r}")

    translator = None
    native_cache: dict[str, dict[str, str]] = {"en": english}
    for target in selected:
        destination = catalog_dir / f"{target.catalog_id}.json"
        if target.catalog_id == "en":
            validate_catalog("en", english, english)
            print(f"CATALOG=en status=source keys={len(english)}", flush=True)
            continue

        existing: dict[str, object] = {}
        if destination.exists() and not args.force:
            existing = json.loads(destination.read_text(encoding="utf-8"))
            try:
                validate_catalog(target.catalog_id, english, existing)
            except ValueError:
                pass
            else:
                print(f"CATALOG={target.catalog_id} status=existing keys={len(existing)}", flush=True)
                continue

        preserved, missing = catalog_update_plan(target.catalog_id, english, existing)
        native = native_cache.setdefault(target.locale, {})
        for source in missing:
            override = reviewed_translation_override(target.locale, source)
            if override is not None:
                native[source] = override
        uncached = [source for source in missing if source not in native]
        if uncached:
            if translator is None:
                translator = MadladTranslator(
                    args.model,
                    args.batch_size,
                    args.device,
                    args.threads,
                    fallback_factory=lambda: M2M100Translator(
                        args.fallback_model,
                        args.device,
                        args.threads,
                    ),
                )
            outputs = translator.translate(uncached, MODEL_LANGUAGE[target.locale])
            native.update(dict(zip(uncached, outputs, strict=True)))
        native["NUR"] = "NUR"

        translated_missing = render_variant(
            target,
            {source: native[source] for source in missing},
        )
        result = {
            source: preserved[source] if source in preserved else translated_missing[source]
            for source in english
        }

        validate_catalog(target.catalog_id, english, result)
        write_catalog(destination, result)
        status = "generated" if not existing or args.force else "updated"
        print(
            f"CATALOG={target.catalog_id} status={status} keys={len(result)} "
            f"preserved={len(preserved)} translated={len(missing)}",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
