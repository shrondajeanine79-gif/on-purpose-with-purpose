import { loadBrandStandard } from "./config.js";

export function gapList(brandStandard) {
  const fields = brandStandard.fields ?? {};
  const gaps = [];
  for (const [key, field] of Object.entries(fields)) {
    if (field.approved === true) continue;
    if (field.value !== null && field.status !== "NEEDS OWNER REVIEW") continue;
    gaps.push({
      key,
      status: field.status ?? "NEEDS OWNER REVIEW",
      hasObservedValue: field.value !== null,
      note: field.note ?? null,
    });
  }
  return gaps;
}

export function requiredGaps(brandStandard) {
  const required = brandStandard.requiredForContent ?? [];
  const gaps = gapList(brandStandard);
  return gaps.filter((gap) => required.includes(gap.key));
}

export function assertContentReady(brandStandard) {
  const gaps = requiredGaps(brandStandard);
  if (gaps.length > 0) {
    return {
      ready: false,
      reason: "Required brand standards are not approved. PURPOSE must not create content.",
      gaps,
    };
  }
  return { ready: true, gaps: [] };
}

export function summarizeGaps() {
  const brand = loadBrandStandard();
  return {
    total: Object.keys(brand.fields ?? {}).length,
    open: gapList(brand).length,
    requiredOpen: requiredGaps(brand).length,
    gaps: gapList(brand),
  };
}
