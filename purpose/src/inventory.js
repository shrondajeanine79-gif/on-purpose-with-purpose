import { loadInventory } from "./config.js";

export function inventorySummary() {
  const inv = loadInventory();
  const products = inv.products.products ?? [];
  const pages = inv.pages.pages ?? [];
  const articles = inv.pages.articles ?? [];
  const assets = inv.assets.assets ?? [];
  const revenue = inv.assets.revenueStreams ?? [];
  const links = inv.links.linksInBio?.entries ?? [];
  const icons = inv.links.siteSocialIcons ?? [];
  const emails = inv.links.contactEmails ?? [];

  const openReviews = [
    ...products,
    ...pages,
    ...assets,
    ...revenue,
    ...links,
    ...icons,
    ...emails,
  ].filter((item) => item.reviewStatus === "NEEDS OWNER REVIEW").length;

  return {
    products: products.length,
    pages: pages.length,
    articles: articles.length,
    assets: assets.length,
    revenueStreams: revenue.length,
    linkInBioEntries: links.length,
    socialIcons: icons.length,
    contactEmails: emails.length,
    openReviews,
    missingAssets: assets.filter((asset) => asset.status === "MISSING").map((asset) => asset.id),
    unconfiguredProducts: products
      .filter((product) => product.status !== "not-offered" && product.purchaseUrl === null)
      .map((product) => product.id),
    revenueNotActive: revenue.filter((stream) => stream.status === "NOT ACTIVE").map((s) => s.id),
  };
}

export function inventoryReview() {
  const inv = loadInventory();
  const findings = [];

  for (const product of inv.products.products ?? []) {
    if (product.purchaseUrl === null && product.status !== "not-offered") {
      findings.push({
        area: "products",
        id: product.id,
        finding: "No purchase URL and no price are defined.",
        action: "Owner must supply price, currency, and fulfillment before sales planning.",
      });
    }
    if (Array.isArray(product.blockers)) {
      for (const blocker of product.blockers) {
        findings.push({ area: "products", id: product.id, finding: blocker, action: "Owner review" });
      }
    }
  }

  for (const entry of inv.links.linksInBio?.entries ?? []) {
    if (entry.status && entry.status !== "OK") {
      findings.push({
        area: "links",
        id: entry.label,
        finding: `Published URL is ${entry.status}: ${entry.url}`,
        action: "Owner must supply the real URL. PURPOSE will not guess.",
      });
    }
  }

  for (const icon of inv.links.siteSocialIcons ?? []) {
    if (/^https:\/\/[a-z.-]+\.?[a-z]*\/?$/.test(icon.url)) {
      findings.push({
        area: "social",
        id: icon.platform,
        finding: `Social link is a bare domain: ${icon.url}`,
        action: "Owner must confirm the real profile URL.",
      });
    }
  }

  for (const email of inv.links.contactEmails ?? []) {
    findings.push({
      area: "contact",
      id: email.email,
      finding: `Contact email appears on ${email.source}.`,
      action: "Owner must confirm which email is canonical.",
    });
  }

  for (const asset of inv.assets.assets ?? []) {
    if (asset.status === "MISSING") {
      findings.push({
        area: "assets",
        id: asset.id,
        finding: `${asset.type} asset is missing.`,
        action: "Owner must supply the asset.",
      });
    }
  }

  for (const stream of inv.assets.revenueStreams ?? []) {
    if (stream.status !== "LINK ONLY") {
      findings.push({
        area: "revenue",
        id: stream.id,
        finding: `Revenue stream is ${stream.status}.`,
        action: "No activation without explicit owner approval.",
      });
    }
  }

  return findings;
}
