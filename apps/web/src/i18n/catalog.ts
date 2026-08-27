/** Bundled static catalogs. Runtime never fetches translations. */
import en from "./catalogs/en.json";
import urRoman from "./catalogs/ur-roman.json";
import urScript from "./catalogs/ur-script.json";
import hiRoman from "./catalogs/hi-roman.json";
import hiScript from "./catalogs/hi-script.json";
import bn from "./catalogs/bn.json";
import pa from "./catalogs/pa.json";
import ar from "./catalogs/ar.json";
import fa from "./catalogs/fa.json";
import tr from "./catalogs/tr.json";
import id from "./catalogs/id.json";
import ms from "./catalogs/ms.json";
import zhHans from "./catalogs/zh-Hans.json";
import zhHant from "./catalogs/zh-Hant.json";
import ja from "./catalogs/ja.json";
import ko from "./catalogs/ko.json";
import vi from "./catalogs/vi.json";
import th from "./catalogs/th.json";
import fil from "./catalogs/fil.json";
import ta from "./catalogs/ta.json";
import te from "./catalogs/te.json";
import mr from "./catalogs/mr.json";
import gu from "./catalogs/gu.json";
import kn from "./catalogs/kn.json";
import ml from "./catalogs/ml.json";
import ru from "./catalogs/ru.json";
import uk from "./catalogs/uk.json";
import pl from "./catalogs/pl.json";
import de from "./catalogs/de.json";
import fr from "./catalogs/fr.json";
import es from "./catalogs/es.json";
import pt from "./catalogs/pt.json";
import it from "./catalogs/it.json";
import nl from "./catalogs/nl.json";
import sv from "./catalogs/sv.json";
import ro from "./catalogs/ro.json";
import sw from "./catalogs/sw.json";

import { LOCALE_VARIANTS, SUPPORTED_LOCALES, UI_COPY_KEYS, normalizeLocale, resolveWritingPreference, type SupportedLocale, type UiCopyKey, type WritingPreference, type CatalogQuality } from "./schema";

export type CompleteCatalog = Record<UiCopyKey, string>;
const catalogs = {
  "en": en as CompleteCatalog,
  "ur-roman": urRoman as CompleteCatalog,
  "ur-script": urScript as CompleteCatalog,
  "hi-roman": hiRoman as CompleteCatalog,
  "hi-script": hiScript as CompleteCatalog,
  "bn": bn as CompleteCatalog,
  "pa": pa as CompleteCatalog,
  "ar": ar as CompleteCatalog,
  "fa": fa as CompleteCatalog,
  "tr": tr as CompleteCatalog,
  "id": id as CompleteCatalog,
  "ms": ms as CompleteCatalog,
  "zh-Hans": zhHans as CompleteCatalog,
  "zh-Hant": zhHant as CompleteCatalog,
  "ja": ja as CompleteCatalog,
  "ko": ko as CompleteCatalog,
  "vi": vi as CompleteCatalog,
  "th": th as CompleteCatalog,
  "fil": fil as CompleteCatalog,
  "ta": ta as CompleteCatalog,
  "te": te as CompleteCatalog,
  "mr": mr as CompleteCatalog,
  "gu": gu as CompleteCatalog,
  "kn": kn as CompleteCatalog,
  "ml": ml as CompleteCatalog,
  "ru": ru as CompleteCatalog,
  "uk": uk as CompleteCatalog,
  "pl": pl as CompleteCatalog,
  "de": de as CompleteCatalog,
  "fr": fr as CompleteCatalog,
  "es": es as CompleteCatalog,
  "pt": pt as CompleteCatalog,
  "it": it as CompleteCatalog,
  "nl": nl as CompleteCatalog,
  "sv": sv as CompleteCatalog,
  "ro": ro as CompleteCatalog,
  "sw": sw as CompleteCatalog,
} as const;

export type CatalogId = `${SupportedLocale}:${WritingPreference}`;
export const CATALOG_IDS = SUPPORTED_LOCALES.flatMap((locale) => (LOCALE_VARIANTS[locale] as readonly WritingPreference[]).map((variant) => `${locale}:${variant}`)) as CatalogId[];
export const CATALOG_QUALITY: Record<CatalogId, CatalogQuality> = Object.fromEntries(
  SUPPORTED_LOCALES.flatMap((locale) => (LOCALE_VARIANTS[locale] as readonly WritingPreference[]).map((variant) => [`${locale}:${variant}`, locale === "en" ? "TECHNICALLY_COMPLETE" : "MACHINE_DRAFT"])),
) as Record<CatalogId, CatalogQuality>;

const catalogByLocaleVariant: Record<SupportedLocale, Partial<Record<WritingPreference, CompleteCatalog>>> = {
  "en": { default: catalogs["en"] },
  "ur": { roman: catalogs["ur-roman"], script: catalogs["ur-script"] },
  "hi": { roman: catalogs["hi-roman"], script: catalogs["hi-script"] },
  "bn": { default: catalogs["bn"] },
  "pa": { default: catalogs["pa"] },
  "ar": { script: catalogs["ar"] },
  "fa": { script: catalogs["fa"] },
  "tr": { default: catalogs["tr"] },
  "id": { default: catalogs["id"] },
  "ms": { default: catalogs["ms"] },
  "zh-Hans": { default: catalogs["zh-Hans"] },
  "zh-Hant": { default: catalogs["zh-Hant"] },
  "ja": { default: catalogs["ja"] },
  "ko": { default: catalogs["ko"] },
  "vi": { default: catalogs["vi"] },
  "th": { default: catalogs["th"] },
  "fil": { default: catalogs["fil"] },
  "ta": { default: catalogs["ta"] },
  "te": { default: catalogs["te"] },
  "mr": { default: catalogs["mr"] },
  "gu": { default: catalogs["gu"] },
  "kn": { default: catalogs["kn"] },
  "ml": { default: catalogs["ml"] },
  "ru": { default: catalogs["ru"] },
  "uk": { default: catalogs["uk"] },
  "pl": { default: catalogs["pl"] },
  "de": { default: catalogs["de"] },
  "fr": { default: catalogs["fr"] },
  "es": { default: catalogs["es"] },
  "pt": { default: catalogs["pt"] },
  "it": { default: catalogs["it"] },
  "nl": { default: catalogs["nl"] },
  "sv": { default: catalogs["sv"] },
  "ro": { default: catalogs["ro"] },
  "sw": { default: catalogs["sw"] },
};

export function getCatalog(rawLocale: string | null | undefined, requested?: WritingPreference | null): CompleteCatalog {
  const locale = normalizeLocale(rawLocale);
  const variant = resolveWritingPreference(locale, requested);
  const catalog = catalogByLocaleVariant[locale][variant];
  if (!catalog) throw new Error(`Missing bundled catalog for ${locale}:${variant}`);
  return catalog;
}

export function getUiCopy(locale: SupportedLocale | string, key: UiCopyKey, requested?: WritingPreference | null, params?: Record<string, unknown>): string {
  const catalog = getCatalog(locale, requested);
  const value = catalog[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing copy for ${String(locale)}:${String(key)}`);
  if (!params) return value;
  return Object.entries(params).reduce((result, [name, replacement]) => result.replaceAll(`{{${name}}}`, String(replacement)), value);
}

export function assertCatalogShape(catalog: Record<string, unknown>): asserts catalog is CompleteCatalog {
  const actual = Object.keys(catalog).sort();
  const expected = [...UI_COPY_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("Catalog key parity violation");
  for (const key of UI_COPY_KEYS) {
    if (typeof catalog[key] !== "string" || !catalog[key].trim()) throw new Error(`Blank catalog value for ${key}`);
  }
}

export function catalogId(locale: SupportedLocale, variant: WritingPreference): CatalogId {
  const resolved = resolveWritingPreference(locale, variant);
  return `${locale}:${resolved}`;
}
