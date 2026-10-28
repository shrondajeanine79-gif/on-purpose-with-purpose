import { loadInventory } from "./config.js";

/**
 * Read-only inventory summary for the dashboard. No URLs are rewritten.
 */
export function summarizeInventory() {
  const inv = loadInventory();
  const products = inv.products.products ?? [];
  const pages = inv.pages.pages ?? [];
  const articles = inv.pages.articles ?? [];
  const assets = inv.assets.assets ?? [];
  const revenue = inv.assets.revenueStreams ?? [];
  const links = inv.links.linksInBio?.entries ?? [];
  const socialIcons = inv.links.siteSocialIcons ?? [];
  const contactEmails = inv.links.contactEmails ?? [];

  const flagged = [];
  const add = (area, id, finding, action) => flagged.push({ area, id, finding, action });

  for (const entry of links) {
    if (entry.status && entry.status !== "OK") {
      add("link-in-bio", entry.label, `Published URL is ${entry.status}: ${entry.url}`, "Owner must supply the real URL. PURPOSE will not guess.");
    }
  }
  for (const icon of socialIcons) {
    if (/^https?:\/\/[^/]+\/?$/.test(icon.url)) {
      add("social", icon.platform, `Bare domain link: ${icon.url}`, "Owner must confirm the real profile URL.");
    }
  }
  for (const email of contactEmails) {
    add("contact", email.email, `Email appears on ${email.source}.`, "Owner must confirm the canonical email.");
  }
  for (const asset of assets) {
    if (asset.status === "MISSING") {
      add("asset", asset.id, `${asset.type} asset is missing.`, "Owner must supply the asset.");
    }
  }
  for (const product of products) {
    if (product.status !== "not-offered" && product.purchaseUrl === null) {
      add("product", product.id, "No purchase URL or price.", "Owner must supply pricing and fulfillment.");
    }
  }
  for (const stream of revenue) {
    if (stream.status !== "LINK ONLY") {
      add("revenue", stream.id, `Revenue stream is ${stream.status}.`, "No activation without explicit owner approval.");
    }
  }

  return {
    counts: {
      products: products.length,
      pages: pages.length,
      articles: articles.length,
      assets: assets.length,
      revenueStreams: revenue.length,
      linkInBioEntries: links.length,
      socialIcons: socialIcons.length,
      contactEmails: contactEmails.length,
    },
    missingAssets: assets.filter((a) => a.status === "MISSING").map((a) => a.id),
    activeRevenueStreams: revenue.filter((s) => s.status === "LINK ONLY").map((s) => s.id),
    products: products.map((p) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      status: p.status,
      price: p.price,
      purchaseUrl: p.purchaseUrl,
      reviewStatus: p.reviewStatus,
    })),
    pages: pages.map((p) => ({
      id: p.id,
      path: p.path,
      title: p.title,
      kind: p.kind,
      canonical: p.canonical,
    })),
    linkInBio: links.map((entry) => ({
      label: entry.label,
      url: entry.url,
      status: entry.status,
      reviewStatus: entry.reviewStatus,
    })),
    socialIcons: socialIcons.map((icon) => ({
      platform: icon.platform,
      url: icon.url,
      reviewStatus: icon.reviewStatus,
    })),
    contactEmails: contactEmails.map((email) => ({ email: email.email, source: email.source })),
    revenueStreams: revenue.map((stream) => ({
      id: stream.id,
      status: stream.status,
      provider: stream.provider,
    })),
    flagged,
    readOnly: true,
  };
}
