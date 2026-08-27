import pytest

from app.i18n.catalog import (
    LABELS,
    LOCALE_QUALITY,
    STATIC_CATALOG_QUALITY_STATES,
    SUPPORTED_LOCALES,
    locale_catalog,
    normalize_locale,
    resolve_variant,
    writing_variants,
)


def test_backend_declares_exactly_35_locales_and_37_variant_catalogs():
    assert len(SUPPORTED_LOCALES) == 35
    assert len(set(SUPPORTED_LOCALES)) == 35
    assert set(LABELS) == set(SUPPORTED_LOCALES)
    assert sum(len(writing_variants(locale)) for locale in SUPPORTED_LOCALES) == 37
    assert len(locale_catalog()) == 35


def test_backend_writing_variants_match_static_quality_and_direction_contract():
    assert STATIC_CATALOG_QUALITY_STATES == {"MACHINE_DRAFT", "TECHNICALLY_COMPLETE", "HUMAN_REVIEWED"}
    for locale in SUPPORTED_LOCALES:
        variants = writing_variants(locale)
        assert all(variant.quality_state == LOCALE_QUALITY[locale] for variant in variants)
        assert all(variant.direction == ("rtl" if locale in {"ar", "fa"} or (locale == "ur" and variant.preference == "script") else "ltr") for variant in variants)
    assert [(variant.preference, variant.direction) for variant in writing_variants("ur")] == [
        ("roman", "ltr"),
        ("script", "rtl"),
    ]
    assert [(variant.preference, variant.direction) for variant in writing_variants("hi")] == [
        ("roman", "ltr"),
        ("script", "ltr"),
    ]


def test_backend_normalizes_browser_locale_aliases_and_rejects_unknown_values():
    assert normalize_locale("ur-PK") == "ur"
    assert normalize_locale("en-US") == "en"
    assert normalize_locale("zh-TW") == "zh-Hant"
    assert normalize_locale("zh-CN") == "zh-Hans"
    with pytest.raises(ValueError):
        normalize_locale("xx-YY")


def test_backend_resolves_default_alias_and_rejects_impossible_combinations():
    assert resolve_variant("ur", "default").preference == "roman"
    assert resolve_variant("ar", "default").preference == "script"
    assert resolve_variant("zh-Hant", "default").preference == "script"
    with pytest.raises(ValueError):
        resolve_variant("ar", "roman")
    with pytest.raises(ValueError):
        resolve_variant("en", "script")
    with pytest.raises(ValueError):
        resolve_variant("ur", "not-a-writing-variant")
