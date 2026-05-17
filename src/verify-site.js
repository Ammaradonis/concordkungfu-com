const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const sourceHost = "www.concordkungfu.com";

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function outputNameForUrl(url) {
  const parsed = new URL(url);
  if (parsed.pathname === "/" || parsed.pathname === "") return "index.html";
  return parsed.pathname.replace(/^\//, "");
}

function readCaptures() {
  const files = fs
    .readdirSync(root)
    .filter((file) => /^www_concordkungfu_com.*\.json$/.test(file))
    .sort();

  const captures = files.map((file) => {
    const data = readJson(file);
    return { file, data, output: outputNameForUrl(data.page.url) };
  });

  const selected = new Map();
  for (const capture of captures) {
    const existing = selected.get(capture.output);
    if (!existing || capture.file.includes("_index_html")) {
      selected.set(capture.output, capture);
    }
  }

  return { captures, pages: Array.from(selected.values()).sort((a, b) => a.output.localeCompare(b.output)) };
}

function localPagePath(href, fromFile) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;

  let parsed;
  try {
    parsed = new URL(href, `https://${sourceHost}/${fromFile}`);
  } catch {
    return null;
  }

  if (parsed.hostname !== sourceHost) return null;
  if (parsed.pathname === "/" || parsed.pathname === "") return "index.html";
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}

function extractHtmlAttributes(html, attr) {
  const values = [];
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "gi");
  for (const match of html.matchAll(pattern)) {
    values.push(match[1]);
  }
  return values;
}

function verify() {
  const { captures, pages } = readCaptures();

  if (!fs.existsSync(dist)) fail("dist directory does not exist. Run npm run build first.");

  const expectedPages = new Set(pages.map((page) => page.output));
  expectedPages.add("404.html");
  for (const page of expectedPages) {
    if (!fs.existsSync(path.join(dist, page))) fail(`Missing generated page: ${page}`);
  }

  const requiredAssets = ["assets/styles.css", "assets/site.js", "source-manifest.json"];
  for (const asset of requiredAssets) {
    if (!fs.existsSync(path.join(dist, asset))) fail(`Missing generated asset: ${asset}`);
  }

  const indexHtml = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  if (!/<h1>\s*Concord Kung Fu Academy\s*<\/h1>/i.test(indexHtml)) {
    fail("index.html is not the Concord Kung Fu Academy homepage.");
  }

  const htmlFiles = fs.readdirSync(dist).filter((file) => file.endsWith(".html"));
  const allHtml = htmlFiles.map((file) => fs.readFileSync(path.join(dist, file), "utf8")).join("\n");

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(dist, file), "utf8");
    const refs = [
      ...extractHtmlAttributes(html, "href"),
      ...extractHtmlAttributes(html, "src")
    ];

    for (const ref of refs) {
      const local = localPagePath(ref, file);
      if (!local) continue;

      const clean = local.split("#")[0];
      if (!clean || clean.includes("?")) continue;
      if (clean.endsWith(".html") && !fs.existsSync(path.join(dist, clean))) {
        fail(`Broken local page link in ${file}: ${ref}`);
      }
      if (clean.startsWith("assets/") && !fs.existsSync(path.join(dist, clean))) {
        fail(`Broken local asset link in ${file}: ${ref}`);
      }
    }
  }

  const capturedImages = new Set();
  for (const capture of captures) {
    for (const image of capture.data.images || []) {
      if (image.src) capturedImages.add(image.src);
    }
  }

  const missingImages = [...capturedImages].filter((src) => !allHtml.includes(src));
  if (missingImages.length) {
    fail(`Captured image URLs missing from generated HTML:\n${missingImages.join("\n")}`);
  }

  console.log(`Verified ${pages.length} generated pages, ${htmlFiles.length} HTML files, and ${capturedImages.size} captured image URLs.`);
}

verify();
