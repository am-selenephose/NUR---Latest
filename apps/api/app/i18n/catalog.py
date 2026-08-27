"""Authoritative backend metadata for NUR's 35 locale slots."""

from dataclasses import asdict, dataclass


SUPPORTED_LOCALES = (
    "en", "ur", "hi", "bn", "pa", "ar", "fa", "tr", "id", "ms",
    "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta", "te",
    "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt",
    "it", "nl", "sv", "ro", "sw",
)

QUALITY_STATES = {
    "CORE_POLISHED",
    "BETA_REVIEWED",
    "DRAFT_MACHINE_TRANSLATED",
    "MISSING_REVIEW",
}

LABELS = {
    "en": "English",
    "ur": "اردو",
    "hi": "हिन्दी",
    "bn": "বাংলা",
    "pa": "ਪੰਜਾਬੀ",
    "ar": "العربية",
    "fa": "فارسی",
    "tr": "Türkçe",
    "id": "Bahasa Indonesia",
    "ms": "Bahasa Melayu",
    "zh-Hans": "简体中文",
    "zh-Hant": "繁體中文",
    "ja": "日本語",
    "ko": "한국어",
    "vi": "Tiếng Việt",
    "th": "ไทย",
    "fil": "Filipino",
    "ta": "தமிழ்",
    "te": "తెలుగు",
    "mr": "मराठी",
    "gu": "ગુજરાતી",
    "kn": "ಕನ್ನಡ",
    "ml": "മലയാളം",
    "ru": "Русский",
    "uk": "Українська",
    "pl": "Polski",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "pt": "Português",
    "it": "Italiano",
    "nl": "Nederlands",
    "sv": "Svenska",
    "ro": "Română",
    "sw": "Kiswahili",
}

SCRIPT_BY_LOCALE = {
    "ur": "Arab",
    "ar": "Arab",
    "fa": "Arab",
    "hi": "Deva",
    "bn": "Beng",
    "pa": "Guru",
    "zh-Hans": "Hans",
    "zh-Hant": "Hant",
    "ja": "Jpan",
    "ko": "Kore",
    "th": "Thai",
    "ta": "Taml",
    "te": "Telu",
    "mr": "Deva",
    "gu": "Gujr",
    "kn": "Knda",
    "ml": "Mlym",
    "ru": "Cyrl",
    "uk": "Cyrl",
}


@dataclass(frozen=True)
class WritingVariant:
    preference: str
    label: str
    script: str
    direction: str
    quality_state: str = "MISSING_REVIEW"
    priority_for_review: bool = False


def writing_variants(locale: str) -> tuple[WritingVariant, ...]:
    locale = normalize_locale(locale)
    if locale == "ur":
        return (
            WritingVariant("roman", "Roman Urdu", "Latn", "ltr", priority_for_review=True),
            WritingVariant("script", "Urdu script", "Arab", "rtl", priority_for_review=True),
        )
    if locale == "hi":
        return (
            WritingVariant("roman", "Roman Hindi", "Latn", "ltr", priority_for_review=True),
            WritingVariant("script", "Hindi", "Deva", "ltr", priority_for_review=True),
        )
    script = SCRIPT_BY_LOCALE.get(locale, "Latn")
    direction = "rtl" if locale in {"ar", "fa"} else "ltr"
    return (
        WritingVariant(
            "script" if script != "Latn" else "default",
            LABELS[locale],
            script,
            direction,
            priority_for_review=locale == "en",
        ),
    )


def normalize_locale(value: str | None) -> str:
    raw = (value or "en").strip()
    if raw in SUPPORTED_LOCALES:
        return raw
    lowered = raw.lower()
    if lowered.startswith("zh-hant") or lowered in {"zh-tw", "zh-hk"}:
        return "zh-Hant"
    if lowered.startswith("zh"):
        return "zh-Hans"
    base = lowered.split("-", 1)[0]
    if base in SUPPORTED_LOCALES:
        return base
    raise ValueError("Unsupported NUR locale.")


def resolve_variant(locale: str, preference: str | None) -> WritingVariant:
    variants = writing_variants(locale)
    requested = (preference or "").strip().lower()
    if requested in {"", "default"}:
        return variants[0]
    for variant in variants:
        if variant.preference == requested:
            return variant
    raise ValueError("Unsupported writing preference for this locale.")


def locale_catalog() -> list[dict]:
    return [
        {
            "locale": locale,
            "label": LABELS[locale],
            "variants": [asdict(variant) for variant in writing_variants(locale)],
        }
        for locale in SUPPORTED_LOCALES
    ]
