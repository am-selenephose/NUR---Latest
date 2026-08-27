# NUR 35-Language Offline Localization

**Status:** `MACHINE_DRAFT` catalogs with `TECHNICALLY_COMPLETE` implementation evidence pending the final release gate. No catalog is labeled `HUMAN_REVIEWED` because native-speaker review has not been completed.

## Scope and catalog contract

NUR supports exactly **35 locale IDs**: `en`, `ur`, `hi`, `bn`, `pa`, `ar`, `fa`, `tr`, `id`, `ms`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `vi`, `th`, `fil`, `ta`, `te`, `mr`, `gu`, `kn`, `ml`, `ru`, `uk`, `pl`, `de`, `fr`, `es`, `pt`, `it`, `nl`, `sv`, `ro`, and `sw`. The bundled catalog set contains **37 writing variants**: English default; Roman and native-script Urdu; Roman and Devanagari Hindi; script Arabic and Persian; and one valid default variant for every other supported locale.

The canonical frontend source manifest contains **944 typed UI copy keys**. Every catalog contains exactly the same key set, with nonblank values, matching placeholder multisets, preserved `NUR` branding, and no supported-locale lookup that falls back to English. Unsupported external locale input may be normalized to English before lookup; a supported locale with an impossible writing variant is rejected rather than silently substituted.

`apps/web/src/i18n/schema.ts` is the typed authority for locale IDs, writing variants, direction, labels, quality metadata, normalization, and strict variant resolution. `apps/web/src/i18n/catalog.ts` statically imports every JSON catalog and provides total lookup through `getCatalog` and `getUiCopy`. `apps/web/src/lib/i18n.ts` remains a compatibility facade only; it is not a second source of copy.

## Runtime behavior and source ownership

The product ships all static UI copy in the frontend bundle. It does not fetch `/translations`, call an LLM, or invoke an external translation service during rendering. V197 construction and hydration, authentication and bridge controls, settings and adjunct chambers, Insights, Map, Orbit, Timeline, and other bridge-created surfaces use strict `v197Copy` calls for manifest-owned static text. Dynamic user-authored, model-generated, API-provided, technical-ID, URL, and database values remain unchanged unless the user explicitly initiates a content translation flow.

Canonical V197 geometry, star-seal identity, routes, animations, and visual structure remain owned by the existing V197 host and iframe document. Keyed locale application updates only known static slots; it does not perform global post-render string replacement. The NUR brand, technical identifiers, URLs, and persisted content are not translated.

Urdu Roman is LTR; Urdu script is RTL. Hindi Roman and Devanagari are LTR. Arabic and Persian are RTL. `writingOptionsForLocale` and the V197 scope-modal controls expose only valid variants for the selected locale, and the backend `/api/v1/profile/preferences` endpoint normalizes aliases and returns `422` for impossible locale-writing pairs such as Arabic Roman or English script.

## Backend parity

`apps/api/app/i18n/catalog.py` mirrors the frontend’s exact locale, variant, label, direction, and normalization semantics. Static catalog quality is exposed separately from the historical lifecycle states used for explicitly requested dynamic content translations. The translations endpoint therefore cannot be mistaken for the static UI authority, and owner visibility rules remain independent of language selection.

## Translation provenance and quality

Catalog values were prepared at build time using locally installed Argos Translate packages where available and the locally cached `facebook/nllb-200-distilled-600M` model for targets without a direct Argos package. The source-generation process was external to the product runtime and introduces no translation dependency or network requirement to the shipped application. The relevant references are [Argos Translate](https://github.com/argosopentech/argos-translate), the [Argos package index](https://www.argosopentech.com/argospm/index/), and [NLLB-200](https://huggingface.co/facebook/nllb-200-distilled-600M).

All non-English catalogs are labeled `MACHINE_DRAFT` until qualified native-speaker review. `TECHNICALLY_COMPLETE` is reserved for implementation evidence: exact catalog parity, extraction and fallback gates, typecheck, build, deterministic tests, backend validation, and browser evidence. `HUMAN_REVIEWED` must not be assigned without documented native-speaker review of the relevant locale and variant.

## Deterministic gates and evidence

The repository provides `npm run web:i18n-catalog-parity` for exact 35-locale/37-variant/944-key parity, placeholder and brand invariants, and Roman-script checks. `npm run web:i18n-extraction` scans all non-test bridge producers for raw visible static copy, unsafe locale fallback patterns, and known DOM-copy helper violations. `npm run web:e2e:localization-representative` is the bounded Chromium CI gate; `npm run web:e2e:localization-35` is the full release matrix covering all 37 variants, reload persistence, user/model-content preservation, and representative overflow checks.

Native-speaker review remains an explicit follow-up deliverable. It must cover terminology, grammar, mixed-script conventions, RTL visual reading order, long-copy line breaking, and all user-facing static surfaces before any catalog quality is promoted to `HUMAN_REVIEWED`.
