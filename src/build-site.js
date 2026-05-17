const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const assetsDir = path.join(dist, "assets");
const sourceHost = "www.concordkungfu.com";
const logo = "https://www.concordkungfu.com/images/ckfa-logo.png";
const logo2x = "https://www.concordkungfu.com/images/ckfa-logo@2x.png";

const nav = [
  ["Home", "index.html"],
  ["Academy", "academy.html"],
  ["Classes", "classes.html"],
  ["Programs", "programs.html"],
  ["Schedule", "schedule.html"],
  ["Contact Us", "contact_us.html"],
  ["News & Events", "news_events.html"]
];

const eventNav = [
  ["Newsletter", "newsletter.html"],
  ["School Events", "school_events.html"],
  ["Seminars & Workshops", "seminar.html"],
  ["Mark Your Calendar", "mark_your_calendar.html"],
  ["Recent News", "recent_news.html"],
  ["Training Tips", "training_tips.html"],
  ["Recent Promotions", "recent_promotions.html"]
];

const scheduleLinks = [
  ["Class Master Schedule", "schedule.html"],
  ["Tigers - Kids", "classes.html#tigers-kids"],
  ["Leopards - Youth", "classes.html#leopards-youth"],
  ["Lions - Tweens", "classes.html#lions"],
  ["Dragons - Teens & Adults", "classes.html#dragons"],
  ["Tai Chi - Adults", "classes.html#tai-chi"]
];

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function localizeHref(href) {
  if (!href) return null;
  try {
    const parsed = new URL(href);
    if (parsed.hostname === sourceHost || parsed.hostname === `www.${sourceHost}`) {
      const extension = path.extname(parsed.pathname).toLowerCase();
      if (extension && extension !== ".html") return href;
      const file = parsed.pathname === "/" ? "index.html" : parsed.pathname.replace(/^\//, "");
      return `${file || "index.html"}${parsed.hash || ""}`;
    }
    return href;
  } catch {
    return href;
  }
}

function outputNameForUrl(url) {
  const parsed = new URL(url);
  if (parsed.pathname === "/" || parsed.pathname === "") return "index.html";
  return parsed.pathname.replace(/^\//, "");
}

function titleFromOutput(output) {
  if (output === "index.html") return "Concord Kung Fu Academy";
  return output
    .replace(/\.html$/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readCaptures() {
  const files = fs
    .readdirSync(root)
    .filter((file) => /^www_concordkungfu_com.*\.json$/.test(file))
    .sort();

  const captures = files.map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    const output = outputNameForUrl(data.page.url);
    return { file, data, output };
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

function siteImages(capture) {
  const seen = new Set();
  return (capture.data.images || [])
    .filter((image) => image && image.src)
    .filter((image) => {
      if (seen.has(image.src)) return false;
      seen.add(image.src);
      return true;
    });
}

function contentImages(capture) {
  return siteImages(capture).filter((image) => !/ckfa-logo/i.test(image.src));
}

function stripSiteChrome(text) {
  const navText = "Home Academy Classes Programs Schedule Contact Us News & Events";
  let result = cleanText(text);
  if (result.startsWith(navText)) {
    result = result.slice(navText.length).trim();
  }

  const footerStart = result.indexOf('About Us "Train Harder, Live Better!"');
  if (footerStart >= 0) result = result.slice(0, footerStart).trim();
  return result;
}

function contentHeadings(capture) {
  const skip = new Set(["Sitemap"]);
  return (capture.data.content.headings || [])
    .map((heading) => ({
      level: heading.level || "h2",
      text: cleanText(heading.text)
    }))
    .filter((heading) => heading.text && !skip.has(heading.text));
}

function sectionize(capture) {
  const text = stripSiteChrome(capture.data.content.visible_text || "");
  const headings = contentHeadings(capture);

  if (!text) return [];
  if (!headings.length) {
    return [{ level: "h1", title: titleFromOutput(capture.output), body: text, id: slugify(capture.output) }];
  }

  const occurrences = [];
  let cursor = 0;
  const lowerText = text.toLowerCase();
  for (const heading of headings) {
    const needle = heading.text.toLowerCase();
    const index = lowerText.indexOf(needle, cursor);
    if (index >= 0) {
      occurrences.push({ ...heading, index });
      cursor = index + needle.length;
    }
  }

  if (!occurrences.length) {
    return [{ level: "h1", title: titleFromOutput(capture.output), body: text, id: slugify(capture.output) }];
  }

  const sections = [];
  const intro = text.slice(0, occurrences[0].index).trim();
  if (intro) {
    sections.push({ level: "p", title: "Overview", body: intro, id: "overview" });
  }

  for (let index = 0; index < occurrences.length; index += 1) {
    const current = occurrences[index];
    const next = occurrences[index + 1];
    const start = current.index + current.text.length;
    const end = next ? next.index : text.length;
    const body = text.slice(start, end).trim();
    sections.push({
      level: current.level,
      title: current.text,
      body,
      id: slugify(current.text) || `section-${index + 1}`
    });
  }

  return sections.filter((section) => section.title || section.body);
}

function splitParagraphs(text) {
  const clean = cleanText(text);
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [clean];
  const paragraphs = [];
  let current = "";

  for (const sentence of sentences.map(cleanText).filter(Boolean)) {
    if ((current + " " + sentence).trim().length > 420 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

function renderTimeline(text) {
  const clean = cleanText(text);
  const matches = Array.from(clean.matchAll(/\b(?:19|20)\d{2}\s+-\s+/g));
  if (matches.length < 3) return null;

  const intro = clean.slice(0, matches[0].index).trim();
  const items = matches.map((match, index) => {
    const next = matches[index + 1];
    return clean.slice(match.index, next ? next.index : clean.length).trim();
  });

  return `
    ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
    <ul class="timeline">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderRichText(text) {
  const timeline = renderTimeline(text);
  if (timeline) return timeline;

  return splitParagraphs(text)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function renderCtas(capture, extra = []) {
  const seen = new Set();
  const ctas = [...((capture.data.content.ctas || [])), ...extra]
    .map((cta) => ({
      text: cleanText(cta.text || cta[0]),
      href: localizeHref(cta.href || cta[1])
    }))
    .filter((cta) => cta.text && cta.href)
    .filter((cta) => {
      const key = `${cta.text}|${cta.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!ctas.length) return "";
  return `
    <div class="cta-list" aria-label="Page links">
      ${ctas.map((cta, index) => `<a class="button ${index ? "secondary" : ""}" href="${escapeAttr(cta.href)}">${escapeHtml(cta.text)}</a>`).join("")}
    </div>
  `;
}

function pageTitle(capture) {
  const headings = contentHeadings(capture).filter((heading) => heading.text !== "About Us");
  if (capture.output === "index.html") return "Concord Kung Fu Academy";
  return headings[0]?.text || titleFromOutput(capture.output);
}

function renderHeader(currentOutput) {
  const links = nav
    .map(([label, href]) => {
      const current = href === currentOutput || (currentOutput === "index.html" && href === "index.html");
      return `<a href="${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
    })
    .join("");

  return `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand-lockup" href="index.html">
          <img src="${logo}" srcset="${logo2x} 2x" alt="Concord Kung Fu Academy">
          <span>
            <span class="brand-name">Concord Kung Fu Academy</span>
            <span class="brand-tagline">Train Harder, Live Better</span>
          </span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-nav-toggle>
          <span></span>
        </button>
        <nav class="primary-nav" id="primary-nav" aria-label="Primary navigation">${links}</nav>
      </div>
    </header>
  `;
}

function renderFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-grid">
          <section>
            <h2>About Us</h2>
            <p>"Train Harder, Live Better!"&reg;</p>
            <p>We teach Choy Li Fut Kung Fu and Yang Tai Chi Chuan.</p>
          </section>
          <section>
            <h3>Concord Kung Fu Academy</h3>
            <p>5442 Ygnacio Valley Road Suite 90<br>Concord, CA 94521</p>
            <p>Phone: <a href="tel:+19253046688">(925) 304-6688</a><br>Email: <a href="contact_us.html">Contact Us Here</a></p>
          </section>
          <section>
            <h3>Sitemap</h3>
            <nav class="footer-nav" aria-label="Footer navigation">
              ${nav.map(([label, href]) => `<a href="${href}">${label}</a>`).join("")}
            </nav>
          </section>
        </div>
        <div class="copyright">
          &copy;2026 Iron &amp; Silk, Inc. <a href="terms.html">Terms of Use</a> / <a href="privacy.html">Privacy Policy</a>
          <span> Webmaster@Concordkungfu.com &middot; (925) 304-6688</span>
        </div>
      </div>
    </footer>
  `;
}

function renderLayout(capture, main) {
  const title = capture.data.page.title || pageTitle(capture);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(capture.data.page.meta_description || "Concord Kung Fu Academy in Concord, California.")}">
  <link rel="canonical" href="${escapeAttr(capture.data.page.url)}">
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
${renderHeader(capture.output)}
<main id="main">
${main}
</main>
${renderFooter()}
<script src="assets/site.js" defer></script>
</body>
</html>`;
}

function imageByFile(capture, fragment) {
  return contentImages(capture).find((image) => decodeURIComponent(image.src).toLowerCase().includes(fragment.toLowerCase()));
}

function renderHome(capture) {
  const images = contentImages(capture);
  const battlefield = imageByFile(capture, "battlefield")?.src || images[0]?.src || "";
  const reasons = images.filter((image) => /reason-\d/i.test(image.src));
  const reasonHeadings = contentHeadings(capture)
    .map((heading) => heading.text)
    .filter((text) => !/concord kung fu|start your training|traditional training|battlefield|reasons to train/i.test(text));

  return `
    <section class="hero" style="--hero-image: url('${escapeAttr(battlefield)}')">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">"Train Harder, Live Better!" &reg;</p>
          <h1>Concord Kung Fu Academy</h1>
          <p class="hero-lede">We teach Choy Li Fut Kung Fu and Yang Tai Chi Chuan through traditional training for the modern day warrior.</p>
          <div class="button-row">
            <a class="button" href="introductory_course.html">Start Your Training Now</a>
            <a class="button secondary" href="classes.html">View Classes</a>
          </div>
        </div>
        <div class="hero-mark">
          <img src="${logo}" srcset="${logo2x} 2x" alt="Concord Kung Fu Academy">
        </div>
      </div>
    </section>

    <section class="band">
      <div class="band-inner split-feature">
        <div>
          <p class="eyebrow">Traditional Training</p>
          <h2>The Battlefield Has Changed</h2>
          <p>Find balance and harmony in your training with forms practice plus practical application, including external, internal, and combat arts.</p>
          <div class="button-row">
            <a class="button" href="academy.html">About The Academy</a>
            <a class="button secondary" href="programs.html">Training Programs</a>
          </div>
        </div>
        ${battlefield ? `<img src="${escapeAttr(battlefield)}" alt="The battlefield has changed">` : ""}
      </div>
    </section>

    <section class="band dark">
      <div class="band-inner">
        <p class="eyebrow">Reasons to Train</p>
        <h2>Reasons to Train at the Concord Kung Fu Academy</h2>
        <div class="reason-list" style="margin-top: 1.4rem">
          ${reasons.map((image, index) => {
            const title = cleanText(image.alt) || reasonHeadings[index] || "Martial arts training";
            return `
              <article class="reason-card">
                <img src="${escapeAttr(image.src)}" alt="${escapeAttr(title)}">
                <h3>${escapeHtml(title)}</h3>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

function findImageForHeading(capture, heading) {
  const images = contentImages(capture);
  const text = heading.toLowerCase();
  const pairs = [
    ["tiger", "tigers"],
    ["leopard", "leopards"],
    ["lion", "lions"],
    ["dragon", "dragons"],
    ["tai chi", "taichi"],
    ["champion", "champion"],
    ["novice", "novice"],
    ["recreational", "recreational"],
    ["trial", "class_card"],
    ["lion dance", "lion_gold"],
    ["performance", "lion_gold"]
  ];
  const match = pairs.find(([needle]) => text.includes(needle));
  if (!match) return null;
  return images.find((image) => decodeURIComponent(image.src).toLowerCase().includes(match[1]));
}

function renderCardSections(capture, headingText, introText) {
  const sections = sectionize(capture).filter((section) => section.body || section.title);
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Concord Kung Fu Academy</p>
        <h1>${escapeHtml(headingText || pageTitle(capture))}</h1>
        ${introText ? `<p>${escapeHtml(introText)}</p>` : ""}
        ${renderCtas(capture)}
      </div>
      <div class="card-grid">
        ${sections.map((section) => {
          const image = findImageForHeading(capture, section.title);
          const aliases = aliasesForSection(section.title).map((alias) => `<span id="${escapeAttr(alias)}"></span>`).join("");
          return `
            <article class="media-card" id="${escapeAttr(section.id)}">
              ${aliases}
              ${image ? `<figure><img src="${escapeAttr(image.src)}" alt="${escapeAttr(cleanText(image.alt) || section.title)}"></figure>` : ""}
              <div class="media-card-body">
                <h2>${escapeHtml(section.title)}</h2>
                ${renderRichText(section.body)}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAcademy(capture) {
  const sections = academySections(capture);
  const images = contentImages(capture);
  const heroImage = imageByFile(capture, "all-group")?.src || imageByFile(capture, "shaolintemplemural")?.src;
  const gallery = images.filter((image) => image.src !== heroImage);
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">About Us</p>
        <h1>Concord Kung Fu Academy</h1>
        <p>Personal development and fitness through the martial arts.</p>
        ${renderCtas(capture)}
      </div>
      <div class="split-feature">
        <div class="section-grid">
          ${sections.slice(0, 2).map((section) => `
            <section class="content-section" id="${escapeAttr(section.id)}">
              <h2>${escapeHtml(section.title)}</h2>
              ${renderRichText(section.body)}
            </section>
          `).join("")}
        </div>
        ${heroImage ? `<img src="${escapeAttr(heroImage)}" alt="Concord Kung Fu Academy group">` : ""}
      </div>
      <div class="section-grid" style="margin-top: 1.35rem">
        ${sections.slice(2).map((section) => `
          <section class="content-section" id="${escapeAttr(section.id)}">
            <h2>${escapeHtml(section.title)}</h2>
            ${renderRichText(section.body)}
          </section>
        `).join("")}
      </div>
      ${renderAssetGallery(gallery, "Academy images and affiliations")}
    </section>
  `;
}

function academySections(capture) {
  const text = stripSiteChrome(capture.data.content.visible_text || "");
  const markers = [
    { title: "About Us", marker: "About Us" },
    { title: "Instructors", marker: "Instructors" },
    { title: "Choy Li Fut Kung Fu", marker: "Choy Li Fut Kung Fu Shaolin Roots", bodyOffset: "Choy Li Fut Kung Fu".length },
    { title: "Yang Tai Chi", marker: "Yang Tai Chi Tai Chi Chuan", bodyOffset: "Yang Tai Chi".length },
    { title: "Plum Blossom International Federation Member", marker: "Plum Blossom International Federation Member" },
    { title: "Affiliate Schools of the Plum Blossom International Federation", marker: "Affiliate Schools of the Plum Blossom International Federation" }
  ];

  const positions = [];
  let cursor = 0;
  for (const item of markers) {
    const index = text.indexOf(item.marker, cursor);
    if (index < 0) return sectionize(capture);
    const bodyStart = index + (item.bodyOffset || item.marker.length);
    positions.push({ ...item, index, bodyStart });
    cursor = bodyStart;
  }

  return positions.map((item, index) => {
    const next = positions[index + 1];
    return {
      level: "h1",
      title: item.title,
      body: text.slice(item.bodyStart, next ? next.index : text.length).trim(),
      id: slugify(item.title)
    };
  });
}

function aliasesForSection(title) {
  const text = title.toLowerCase();
  if (text.includes("leopard")) return ["leopards-beginner-7-12-yrs"];
  if (text.includes("tiger")) return ["tigers-kids"];
  if (text.includes("lion")) return ["lions"];
  if (text.includes("dragon")) return ["dragons"];
  if (text.includes("tai chi")) return ["tai-chi"];
  return [];
}

function renderAssetGallery(images, title = "Gallery") {
  if (!images.length) return "";
  return `
    <section style="margin-top: 2rem">
      <div class="page-heading" style="margin-bottom: 1rem">
        <p class="eyebrow">Gallery</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="asset-grid">
        ${images.map((image) => `
          <article class="media-card">
            <figure><img src="${escapeAttr(image.src)}" alt="${escapeAttr(cleanText(image.alt) || "Concord Kung Fu Academy image")}"></figure>
            <div class="media-card-body">
              <h3>${escapeHtml(cleanText(image.alt) || path.basename(image.src))}</h3>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSchedule(capture) {
  const body = stripSiteChrome(capture.data.content.visible_text || "");
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Class Schedule</p>
        <h1>Schedule</h1>
        ${renderRichText(body)}
      </div>
      <div class="card-grid">
        ${scheduleLinks.map(([label, href]) => `
          <article class="info-card">
            <h2>${escapeHtml(label)}</h2>
            <p>View schedule details and related class information.</p>
            <div class="button-row"><a class="button secondary" href="${href}">View Schedule</a></div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderContact(capture) {
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Contact Us</p>
        <h1>Start Your Kung Fu Journey</h1>
        <p>Concord Kung Fu Academy is located at 5442 Ygnacio Valley Road Suite 90 in Concord, California.</p>
      </div>
      <div class="forms-grid">
        ${renderForm("Contact Us", "Send a message to the academy.", "contact")}
        <aside>
          <a class="map-link" href="https://www.google.com/maps/search/?api=1&query=5442%20Ygnacio%20Valley%20Road%20Suite%2090%20Concord%20CA%2094521">
            <span class="eyebrow">Concord, CA</span>
            <strong>5442 Ygnacio Valley Road Suite 90</strong>
            <span>Open in Google Maps</span>
          </a>
          <div class="contact-strip">
            <div class="info-card"><h3>Phone</h3><p><a href="tel:+19253046688">(925) 304-6688</a></p></div>
            <div class="info-card"><h3>Email</h3><p><a href="mailto:Webmaster@Concordkungfu.com">Webmaster@Concordkungfu.com</a></p></div>
            <div class="info-card"><h3>Programs</h3><p><a href="introductory_course.html">Introductory Course</a></p></div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderForm(title, note, type = "general") {
  const interestOptions = type === "intro"
    ? ["Introductory course", "Tigers - Kids", "Leopards - Youth", "Dragons - Teens & Adults", "Tai Chi"]
    : ["General inquiry", "Classes", "Programs", "Schedule", "Lion dance booking"];

  return `
    <form class="form-panel" data-static-form>
      <h2>${escapeHtml(title)}</h2>
      <p class="form-note">${escapeHtml(note)} Submitting opens your email app with the message details.</p>
      <div class="field-grid">
        <label>Name<input name="name" autocomplete="name" required></label>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Phone<input name="phone" autocomplete="tel"></label>
        <label>Interest
          <select name="interest">
            ${interestOptions.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
        <label class="full-field">Message<textarea name="message" required></textarea></label>
      </div>
      <div class="button-row">
        <button class="button" type="submit">Submit</button>
      </div>
      <div class="form-status" data-form-status></div>
    </form>
  `;
}

function renderFormPage(capture, title, note, type) {
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Concord Kung Fu Academy</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(note)}</p>
      </div>
      <div class="forms-grid">
        ${renderForm(title, note, type)}
        <aside class="content-section">
          <h2>Academy Contact</h2>
          <p>Concord Kung Fu Academy<br>5442 Ygnacio Valley Road Suite 90<br>Concord, CA 94521</p>
          <p>Phone: <a href="tel:+19253046688">(925) 304-6688</a></p>
          <p>Email: <a href="mailto:Webmaster@Concordkungfu.com">Webmaster@Concordkungfu.com</a></p>
          ${renderCtas(capture)}
        </aside>
      </div>
    </section>
  `;
}

function renderNewsHub(capture) {
  const body = stripSiteChrome(capture.data.content.visible_text || "");
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">News & Events</p>
        <h1>Check out our News and Events</h1>
        ${renderRichText(body.replace(/^Check out our News and Events/i, ""))}
      </div>
      <div class="card-grid">
        ${eventNav.map(([label, href]) => `
          <article class="info-card">
            <h2>${escapeHtml(label)}</h2>
            <p>View ${escapeHtml(label.toLowerCase())} updates from Concord Kung Fu Academy.</p>
            <div class="button-row"><a class="button secondary" href="${href}">View Page</a></div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLionDance(capture, title) {
  const sections = sectionize(capture);
  const lion = imageByFile(capture, "lion_gold")?.src;
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Lion Dance</p>
        <h1>${escapeHtml(title)}</h1>
        ${renderCtas(capture, [["Contact Us", "contact_us.html"]])}
      </div>
      <div class="split-feature">
        <div class="section-grid">
          ${sections.map((section) => `
            <section class="content-section" id="${escapeAttr(section.id)}">
              <h2>${escapeHtml(section.title)}</h2>
              ${renderRichText(section.body)}
            </section>
          `).join("") || `<section class="content-section"><h2>Lion Dance Booking</h2><p>Contact Concord Kung Fu Academy to inquire about lion dance performances and booking.</p></section>`}
        </div>
        ${lion ? `<img src="${escapeAttr(lion)}" alt="Lion dance">` : ""}
      </div>
    </section>
  `;
}

function renderGeneric(capture) {
  const sections = sectionize(capture);
  const title = pageTitle(capture);
  const images = contentImages(capture);
  return `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Concord Kung Fu Academy</p>
        <h1>${escapeHtml(title)}</h1>
        ${renderCtas(capture)}
      </div>
      <div class="section-grid">
        ${sections.map((section) => `
          <section class="content-section" id="${escapeAttr(section.id)}">
            <h2>${escapeHtml(section.title)}</h2>
            ${renderRichText(section.body)}
          </section>
        `).join("")}
      </div>
      ${renderAssetGallery(images.filter((image) => !/ckfa-logo/i.test(image.src)))}
    </section>
  `;
}

function renderPage(capture) {
  switch (capture.output) {
    case "index.html":
      return renderHome(capture);
    case "academy.html":
      return renderAcademy(capture);
    case "classes.html":
      return renderCardSections(capture, "Classes", "Age-specific kung fu and tai chi classes for children, teens, and adults.");
    case "programs.html":
      return renderCardSections(capture, "Training Programs", "Choose the training structure that fits your goals and schedule.");
    case "schedule.html":
      return renderSchedule(capture);
    case "contact_us.html":
      return renderContact(capture);
    case "general_inquiries.html":
      return renderFormPage(capture, "General Inquiries", "Use this form to contact the academy with general questions.", "general");
    case "introductory_course.html":
      return renderFormPage(capture, "$20 Introductory Course", "Quick pre-registration for the introductory course.", "intro");
    case "news_events.html":
      return renderNewsHub(capture);
    case "lion_dance_booking.html":
      return renderLionDance(capture, "Lion Dance Booking");
    case "lion_dance_performances.html":
      return renderLionDance(capture, "Lion Dance Performances");
    default:
      return renderGeneric(capture);
  }
}

function copyAsset(name) {
  fs.copyFileSync(path.join(__dirname, name), path.join(assetsDir, name));
}

function imageRequests(capture) {
  const imagePattern = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i;
  return (capture.data.network.requests || [])
    .filter((request) => request.type === "image" || imagePattern.test(request.url || ""))
    .map((request) => request.url)
    .filter(Boolean);
}

function writeManifest(allCaptures, pages) {
  const manifest = {
    generated_at: new Date().toISOString(),
    source_files: allCaptures.map((capture) => capture.file),
    pages: pages.map((capture) => ({
      file: capture.file,
      output: capture.output,
      url: capture.data.page.url,
      title: capture.data.page.title,
      images: siteImages(capture).map((image) => image.src),
      network_images: Array.from(new Set(imageRequests(capture)))
    }))
  };
  fs.writeFileSync(path.join(dist, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function write404(pages) {
  const homeCapture = pages.find((page) => page.output === "index.html") || pages[0];
  const main = `
    <section class="page-shell">
      <div class="page-heading">
        <p class="eyebrow">Not Found</p>
        <h1>Page not found</h1>
        <p>The requested page was not found in the generated Concord Kung Fu Academy site.</p>
        <div class="button-row"><a class="button" href="index.html">Return Home</a></div>
      </div>
    </section>
  `;
  fs.writeFileSync(path.join(dist, "404.html"), renderLayout(homeCapture, main));
}

function build() {
  const { captures, pages } = readCaptures();
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  copyAsset("styles.css");
  copyAsset("site.js");

  for (const capture of pages) {
    const html = renderLayout(capture, renderPage(capture));
    fs.writeFileSync(path.join(dist, capture.output), html);
  }

  write404(pages);
  writeManifest(captures, pages);
  console.log(`Built ${pages.length} pages into ${path.relative(root, dist)}.`);
}

build();
