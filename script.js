const CAR_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 550" width="54" height="17" aria-hidden="true"><mask id="m911j"><rect width="1700" height="550" fill="#fff"/><path d="M402 156 L490 96 L550 78 L618 66 L636 170 L460 170Z" fill="#000" stroke="#000" stroke-width="10" stroke-linejoin="round"/><path d="M646 58 L868 44 L912 172 L668 172Z" fill="#000" stroke="#000" stroke-width="10" stroke-linejoin="round"/></mask><g fill="currentColor" mask="url(#m911j)"><path d="M23 359 L25 364 L36 371 L41 380 L48 388 L80 403 L95 408 L124 413 L173 415 L234 414 L241 411 L249 402 L264 346 L277 318 L294 294 L309 278 L333 263 L361 251 L392 244 L425 243 L454 247 L490 259 L509 270 L531 289 L548 311 L558 331 L567 356 L577 403 L582 410 L591 415 L641 417 L1173 416 L1181 414 L1189 403 L1193 379 L1200 351 L1214 319 L1230 295 L1248 277 L1269 263 L1302 249 L1326 244 L1356 243 L1383 247 L1412 256 L1439 273 L1460 293 L1472 310 L1484 331 L1494 359 L1510 429 L1516 437 L1521 439 L1612 440 L1639 438 L1646 433 L1646 425 L1643 417 L1645 404 L1651 397 L1670 383 L1676 380 L1680 375 L1679 321 L1635 295 L1583 275 L1575 265 L1565 244 L1550 216 L1542 206 L1529 199 L1509 193 L1474 187 L1396 179 L1298 174 L1143 171 L925 40 L913 30 L910 21 L905 17 L879 10 L833 7 L751 7 L701 9 L639 16 L597 23 L579 30 L567 41 L556 47 L437 85 L268 145 L253 144 L231 134 L211 130 L107 123 L88 124 L86 127 L86 133 L88 135 L148 190 L151 194 L152 203 L150 207 L145 213 L104 239 L77 261 L70 275 L65 302 L49 311 L42 319 L38 328 L33 333 L29 334 L24 339Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></g><circle cx="412" cy="391" r="136" fill="currentColor"/><circle cx="1348" cy="390" r="136" fill="currentColor"/></svg>`;
/* 911 Archive — vanilla JS, no build step required.
   Each car lives in assets/<folder>/<folder>-00-Card.txt; cars.txt lists the folders in display order. All asset paths are relative to this repository. */
(() => {
  "use strict";
  const ORDER_URL = "./cars.txt";
  const root = document.body;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const formatPrice = car => {
    if (car.price_display) return car.price_display;
    if (typeof car.price === "number") return new Intl.NumberFormat("en-US", { style: "currency", currency: car.currency || "EUR", maximumFractionDigits: 0 }).format(car.price);
    return "Price on request";
  };
  const formatMileage = car => car.mileage_display || (car.mileage_km != null ? `${Number(car.mileage_km).toLocaleString("en-US")} km` : "Not specified");
  const formatDescription = value => Array.isArray(value) ? value.filter(Boolean).map(escapeHTML).join("<br><br>") : escapeHTML(value || "");
  const carHref = car => `./index.html?car=${encodeURIComponent(car.id)}`;
  const imagePath = path => path ? `./${String(path).replace(/^\.?\//, "")}` : "";
  const safeArray = value => Array.isArray(value) ? value : [];

  // ---- Image strategy: every photo exists as 4 WebP files -------------------
  //   <prefix>-<NN>-0300.webp  300x200   grid thumbnails (small screens / 1x)
  //   <prefix>-<NN>-0600.webp  600x400   cards + grid thumbnails (2x screens)
  //   <prefix>-<NN>-1200.webp  1200x800  lightbox on phones / tablets
  //   <prefix>-<NN>-1920.webp  1920x1280 lightbox on large screens
  // The browser picks the right file from srcset/sizes; width/height reserve space.
  const IMG_W = 1200, IMG_H = 800; // aspect ratio only (3:2); keeps layout from shifting
  const sizeLabel = size => String(size).padStart(4, "0");
  const variant = (stem, size) => `${stem}-${sizeLabel(size)}.webp`;
  const srcsetOf = (stem, sizes) => sizes.map(size => `${imagePath(variant(stem, size))} ${size}w`).join(", ");
  const CARD_SIZES = [300, 600, 1200];
  const THUMB_SIZES = [300, 600, 1200];
  const LIGHTBOX_SIZES = [1200, 1920];
  const CARD_SIZES_ATTR = "(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw";
  const THUMB_SIZES_ATTR = "(max-width: 700px) 50vw, (min-width: 1450px) 460px, 33vw";
  const LIGHTBOX_SIZES_ATTR = "100vw";

  // Gallery convention: Prefix-Main-0600.webp (cover), Prefix-01-0300.webp ... Prefix-01-1920.webp, Prefix-02-..., ...
  // Listing cards use the main image; the detail view discovers only photos that exist.
  function resolveCarImages(entry) {
    const folder = String(entry.folder || "").replace(/^\/+|\/+$/g, "");
    const prefix = String(entry.prefix || folder).replace(/^\/+|\/+$/g, "");
    if (!folder || !prefix) return [];
    const stem = `assets/${folder}/${prefix}-Main`;
    return [{ src: variant(stem, 600), stem, alt: entry.imageAlt || entry.title || "Porsche 911" }];
  }

  // Cheap existence check: only ever requests the 15 KB thumbnail, never a full-size file.
  const probeThumb = stem => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = variant(stem, 300);
  });

  async function discoverCarGallery(car) {
    const folder = String(car.folder || "").replace(/^\/+|\/+$/g, "");
    const prefix = String(car.prefix || folder).replace(/^\/+|\/+$/g, "");
    if (!folder || !prefix) return [];
    const dir = `assets/${folder}/${prefix}`;
    const altBase = car.imageAlt || car.title || "Porsche 911";
    const label = n => String(n).padStart(2, "0");
    const items = [];

    // Photos: probe 50 tiny thumbnails IN PARALLEL (one round trip, not one per photo) and keep the first unbroken run.
    // Add or delete photos in the folder and the gallery updates itself; nothing to edit in the card file.
    const hits = await Promise.all(Array.from({ length: 50 }, (_, i) => probeThumb(`${dir}-${label(i + 1)}`)));
    const photoCount = hits.indexOf(false) === -1 ? hits.length : hits.indexOf(false);
    for (let number = 1; number <= photoCount; number++) {
      const stem = `${dir}-${label(number)}`;
      items.push({ type: "photo", src: variant(stem, 600), stem, alt: `${altBase} — photo ${label(number)}` });
    }

    // Videos: check up to 5 filenames in parallel; missing ones are simply skipped.
    const videoChecks = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
      const number = index + 1;
      const src = `assets/${folder}/${prefix}-video-${label(number)}.mp4`;
      try {
        let response = await fetch(src, { method: "HEAD" });
        if (response.status === 405 || response.status === 501) response = await fetch(src, { headers: { Range: "bytes=0-0" } });
        if (response.ok || response.status === 206) return { number, item: { type: "video", src, stem: src, alt: `${altBase} — video ${label(number)}` } };
      } catch (_) { /* a missing video must not block the others */ }
      return null;
    }));
    for (const result of videoChecks.filter(Boolean).sort((x, y) => x.number - y.number)) items.push(result.item);
    return items;
  }


  // Generation from the model year when the title has no 964/993: F-model 1965-1973, G-model 1974-1989 (Porsche Classic).
  // A car can override this with a "series:" line in its card file.
  const seriesFromYear = value => {
    const year = parseInt(value, 10);
    if (!year) return "911";
    if (year <= 1973) return "911-F";
    if (year <= 1989) return "911-G";
    return "911";
  };
  const seriesName = series => (String(series || "").startsWith("911") ? `Porsche ${series}` : `Porsche 911 ${series || ""}`);

  // ---- Car data: one <folder>-00-Card.txt per car + cars.txt (one folder name per line, in display order) ----
  // The card file is plain "field: value" lines. description / history may span several lines; a blank line starts a new paragraph.
  const CAR_FIELDS = Object.fromEntries(["title", "series", "year", "mileage", "displacement", "power", "transmission", "price",
    "history", "description", "imageAlt", "prefix", "vin", "service_book", "color", "stock_number"].map(name => [name.toLowerCase(), name]));
  const MULTILINE_FIELDS = new Set(["history", "description"]);
  function parseCarText(text, folder) {
    const entry = { folder, prefix: folder };
    let key = null;
    let buffer = [];
    const flush = () => {
      if (!key) return;
      entry[key] = MULTILINE_FIELDS.has(key)
        ? buffer.join("\n").split(/\n\s*\n/).map(part => part.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean)
        : buffer.join(" ").trim();
    };
    String(text).replace(/^\uFEFF/, "").split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([A-Za-z_]+)\s*:\s?(.*)$/);
      if (match && CAR_FIELDS[match[1].toLowerCase()]) {
        flush();
        key = CAR_FIELDS[match[1].toLowerCase()];
        buffer = [match[2]];
      } else if (key) buffer.push(line);
    });
    flush();
    if (!entry.prefix) entry.prefix = folder;
    return entry;
  }

  async function loadCars() {
    try {
      const orderResponse = await fetch(ORDER_URL);
      if (!orderResponse.ok) throw new Error(`Could not load cars.txt (${orderResponse.status})`);
      const folders = (await orderResponse.text()).split(/\r?\n/).map(line => line.trim().replace(/^\/+|\/+$/g, ""))
        .filter(line => line && !line.startsWith("#"));
      const texts = await Promise.all(folders.map(folder => fetch(`./assets/${folder}/${folder}-00-Card.txt`)
        .then(response => (response.ok ? response.text() : null)).catch(() => null)));
      const entries = [];
      folders.forEach((folder, i) => {
        if (texts[i] === null) console.warn(`No ${folder}-00-Card.txt found in assets/${folder}/ - car skipped.`);
        else entries.push(parseCarText(texts[i], folder));
      });
      return entries.map((entry, index) => {
        const title = String(entry.title || `Porsche 911 ${index + 1}`);
        const seriesMatch = title.match(/\b(964|993)\b/);
        const photos = resolveCarImages(entry);
        const price = String(entry.price || "").trim();
        const mileage = String(entry.mileage || "").trim();
        const description = Array.isArray(entry.description)
          ? entry.description.filter(part => String(part).trim()).join("\n\n")
          : String(entry.description || "");
        return {
          ...entry,
          id: String(entry.folder || entry.prefix || `car-${index + 1}`),
          series: entry.series || (seriesMatch ? seriesMatch[1] : seriesFromYear(entry.year)),
          year: entry.year || (title.match(/\b(?:19|20)\d{2}\b/) || [])[0] || "",
          currency: "EUR",
          price_display: price || "Price on request",
          mileage_display: mileage || "Mileage not specified",
          engine: [entry.displacement, entry.power].filter(Boolean).join(" "),
          cover: photos[0]?.src || "",
          cover_alt: entry.imageAlt || `${title} exterior`,
          gallery: photos,
          description
        };
      });
    } catch (error) {
      console.error("Unable to load car inventory:", error);
      const grid = $("#car-grid");
      if (grid) grid.innerHTML = `<div class="load-error"><strong>Collection unavailable.</strong><p>${escapeHTML(error.message || "Unable to load the car list.")} Check that cars.txt is in the repository root and that the site is opened through GitHub Pages or a local web server.</p></div>`;
      return [];
    }
  }

  // If a WebP is missing, hide its tile / show the "911" placeholder instead of a broken-image icon.
  function attachImageFallbacks(parent = document) {
    $$("img[data-fallback]", parent).forEach(img => {
      if (img.dataset.fallbackBound === "true") return;
      img.dataset.fallbackBound = "true";
      const settle = () => {
        const button = img.closest(".gallery-photo");
        if (button) {
          button.hidden = true;
          const gallery = button.closest(".gallery-grid");
          if (gallery && !gallery.querySelector(".gallery-photo:not([hidden])")) {
            const empty = gallery.parentElement.querySelector(".gallery-empty");
            if (empty) empty.hidden = false;
          }
        } else {
          img.hidden = true;
          const fallback = img.nextElementSibling;
          if (fallback && fallback.classList.contains("car-image-fallback")) fallback.hidden = false;
        }
      };
      img.addEventListener("error", settle, { once: true });
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) settle();
    });
  }

  function renderCard(car) {
    const coverStem = car.gallery && car.gallery[0] ? car.gallery[0].stem : "";
    const img = coverStem ? imagePath(variant(coverStem, 600)) : "";
    const title = car.title || seriesName(car.series);
    const year = car.year || "Year not specified";
    const alt = car.cover_alt || `${title} exterior`;
    return `<article class="car-card">
      <a class="car-card-link" href="${escapeHTML(carHref(car))}" aria-label="View ${escapeHTML(title)}">
        <div class="car-image-wrap">
          ${img ? `<img class="car-image" data-fallback src="${escapeHTML(img)}" srcset="${escapeHTML(srcsetOf(coverStem, CARD_SIZES))}" sizes="${CARD_SIZES_ATTR}" width="${IMG_W}" height="${IMG_H}" alt="${escapeHTML(alt)}" loading="lazy" decoding="async"><div class="car-image-fallback" hidden>911</div>` : `<div class="car-image-fallback">911</div>`}
          <span class="card-arrow" aria-hidden="true">↗</span>
        </div>
        <div class="car-card-meta">
          <div class="card-overline"><span>${escapeHTML(year)}</span><span class="generation">${escapeHTML(car.series || "911")}</span></div>
          <h3>${escapeHTML(title)}</h3>
          <div class="card-price-row">
            <span class="card-price">${escapeHTML(formatPrice(car))}</span>
            <div class="card-specs"><span>${escapeHTML(formatMileage(car))}</span><span class="dot"></span><span>${escapeHTML(car.transmission || "Not specified")}</span></div>
          </div>
        </div>
      </a>
    </article>`;
  }

  function initListing(cars) {
    const grid = $("#car-grid");
    if (!grid) return;
    let activeSeries = "all";
    let query = "";
    const chips = $$(".filter-chip");
    const render = () => {
      const filtered = cars.filter(car => {
        const matchesSeries = activeSeries === "all" || String(car.series) === activeSeries;
        const haystack = [car.title, car.series, car.year, car.color, car.description, car.stock_number].filter(Boolean).join(" ").toLowerCase();
        return matchesSeries && haystack.includes(query.toLowerCase());
      });
      grid.innerHTML = filtered.map(renderCard).join("");
      attachImageFallbacks(grid);
      $("#results-count").textContent = (n => {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return `${n} машина найдена`;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} машины найдено`;
        return `${n} машин найдено`;
      })(filtered.length);
      $("#all-count").textContent = cars.length;
      $("#empty-state").hidden = filtered.length !== 0;
      grid.hidden = filtered.length === 0;
    };
    chips.forEach(chip => chip.addEventListener("click", () => {
      activeSeries = chip.dataset.series;
      chips.forEach(item => item.classList.toggle("active", item === chip));
      render();
    }));
    $("#search-input")?.addEventListener("input", event => { query = event.target.value.trim(); render(); });
    $("#reset-filters")?.addEventListener("click", () => {
      activeSeries = "all"; query = ""; $("#search-input").value = "";
      chips.forEach(item => item.classList.toggle("active", item.dataset.series === "all"));
      render();
    });
    render();
  }

  function detailTemplate(car) {
    const gallery = safeArray(car.gallery);
    const title = car.title || seriesName(car.series);
    const facts = [
      ["Год", car.year || "Not specified"], ["Поколение", car.series || "911"],
      ["Пробег", formatMileage(car)], ["Объём двигателя", car.displacement || "Not specified"],
      ["Мощность", car.power || "Not specified"], ["Трансмиссия", car.transmission || "Not specified"]
    ];
    const usableGallery = gallery.length ? gallery : safeArray(car.gallery);
    const galleryMarkup = usableGallery.length ? `
      <div class="gallery-grid" aria-label="Photographs of ${escapeHTML(title)}">
        ${usableGallery.map((photo, i) => `<button class="gallery-photo${photo.type === "video" ? " gallery-video" : ""}" type="button" data-index="${i}" data-type="${photo.type || "photo"}" data-stem="${photo.type === "video" ? "" : escapeHTML(photo.stem)}" aria-label="Open ${photo.type === "video" ? "video" : "photo"} ${i + 1}">
          ${photo.type === "video"
            ? `<video muted playsinline preload="none" data-lazy-video aria-label="${escapeHTML(photo.alt || `${title} video ${i + 1}`)}" style="display:block;width:100%;height:100%;object-fit:cover;pointer-events:none"><source src="${escapeHTML(imagePath(photo.src))}" type="video/mp4"></video><span class="gallery-photo-zoom" aria-hidden="true">▶</span>`
            : `<img data-fallback src="${escapeHTML(imagePath(variant(photo.stem, 600)))}" srcset="${escapeHTML(srcsetOf(photo.stem, THUMB_SIZES))}" sizes="${THUMB_SIZES_ATTR}" width="${IMG_W}" height="${IMG_H}" alt="${escapeHTML(photo.alt || `${title} photo ${i + 1}`)}" ${i < 3 ? `loading="eager"${i === 0 ? ' fetchpriority="high"' : ""}` : 'loading="lazy"'} decoding="async"><span class="gallery-photo-zoom" aria-hidden="true">↗</span>`}
        </button>`).join("")}
      </div>
      <div class="gallery-empty" hidden>No photographs found. Check the car's image filenames and folder.</div>
      <div class="gallery-lightbox" id="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Photo gallery" hidden>
        <button class="lightbox-close" type="button" aria-label="Close gallery">×</button>
        <button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous photo">‹</button>
        <figure class="lightbox-figure"><img id="lightbox-image" src="" alt="" decoding="async"><video id="lightbox-video" controls playsinline preload="metadata" hidden style="max-width:100%;max-height:calc(100vh - 130px);width:auto;height:auto;background:#000"><source id="lightbox-video-source" type="video/mp4"></video></figure>
        <button class="lightbox-nav lightbox-next" type="button" aria-label="Next photo">›</button>
        <div class="lightbox-counter" id="lightbox-counter"></div>
      </div>` : `<div class="gallery-empty">Add photos to this car's folder in assets/</div>`;
    const hasText = value => (Array.isArray(value) ? value : [value]).some(item => String(item || "").trim());
    const historyBlock = (hasText(car.history) || car.vin || car.service_book)
      ? `<div class="history-block">${hasText(car.history) ? `<p>${formatDescription(car.history)}</p>` : ""}${car.vin ? `<p><strong>VIN / chassis:</strong> ${escapeHTML(car.vin)}</p>` : ""}${car.service_book ? `<p><strong>Documentation:</strong> ${escapeHTML(car.service_book)}</p>` : ""}</div>`
      : "";
    // The history section appears only if there is something to show.
    const historySection = historyBlock
      ? `<section class="detail-section"><h2>History</h2><div class="history-grid">${historyBlock}</div></section>`
      : "";
    return `<div class="detail-page">
      <div class="detail-topbar"><a class="wordmark" href="./index.html"><span class="wordmark-mark">911</span><span class="wordmark-car">${CAR_LOGO}</span></a><a class="nav-telegram" href="https://t.me/Anna_Chernyakhovskaya" target="_blank" rel="noopener" aria-label="Telegram"><svg viewBox="4 6 16.5 12" width="30" height="22" aria-hidden="true"><path fill="#20231f" d="M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a></div>
      <main class="detail-container">
        <p class="detail-kicker">${escapeHTML(car.year || "")} &nbsp; / &nbsp; ${escapeHTML(seriesName(car.series))}</p>
        <div class="detail-title-row"><h1>${escapeHTML(title)}<span>.</span></h1><div class="detail-price">${escapeHTML(formatPrice(car))}</div></div>
        ${galleryMarkup}
        <section class="detail-overview"><div><h2>A closer look</h2><div class="detail-description">${formatDescription(car.description || "A full description for this example will be added shortly.")}</div></div>
          <div class="detail-facts">${facts.map(([label,value])=>`<div class="fact"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join("")}</div>
        </section>
        ${historySection}
        <section class="detail-cta"><div><h2>Interested in this 911?</h2><p>Request the full vehicle file, additional photographs or a delivery quote.</p></div></section>
      </main>
      <footer class="site-footer"><div class="footer-top"><a class="wordmark footer-wordmark" href="./index.html"><span class="wordmark-mark">911</span><span class="wordmark-car">${CAR_LOGO}</span></a></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} 911 Archive</span><a class="nav-telegram" href="https://t.me/Anna_Chernyakhovskaya" target="_blank" rel="noopener" aria-label="Telegram"><svg viewBox="4 6 16.5 12" width="30" height="22" aria-hidden="true"><path fill="#fff" d="M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a></div></footer>
    </div>`;
  }

  const revealDetail = () => document.documentElement.classList.remove("is-detail");

  async function initDetail(cars, id) {
    const car = cars.find(item => String(item.id) === id);
    if (!car) {
      root.innerHTML = `<div class="detail-not-found"><p class="eyebrow dark-eyebrow">404 / Car not found</p><h1>This 911 isn't in the collection.</h1><p>It may have been removed or the link may be incorrect.</p><a class="button button-dark" href="./index.html">Return to collection</a></div>`;
      revealDetail();
      return;
    }
    car.gallery = await discoverCarGallery(car);
    root.innerHTML = detailTemplate(car);
    revealDetail();
    attachImageFallbacks(root);
    // Videos: fetch metadata (first frame) only when a tile is about to scroll into view.
    const videos = $$("video[data-lazy-video]", root);
    if (videos.length) {
      const wake = video => { video.preload = "metadata"; video.load(); };
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting) { wake(entry.target); observer.unobserve(entry.target); }
        }), { rootMargin: "300px" });
        videos.forEach(video => observer.observe(video));
      } else videos.forEach(wake);
    }
    const lightbox = $("#gallery-lightbox");
    const lightboxImage = $("#lightbox-image");
    const lightboxVideo = $("#lightbox-video");
    const lightboxVideoSource = $("#lightbox-video-source");
    const lightboxCounter = $("#lightbox-counter");
    let activePhoto = 0;
    const visiblePhotos = () => $$(".gallery-photo", root).filter(button => {
      if (button.hidden) return false;
      if (button.dataset.type === "video") return true;
      // Lazy-loaded tiles are not "complete" yet; only tiles whose file failed are hidden by the fallback handler.
      const image = button.querySelector("img");
      return !!image && !image.hidden;
    });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let slideToken = 0;
    // A second <img> that shows the neighbouring photo while the finger drags, so you can see what is coming.
    const lightboxFigure = $(".lightbox-figure", lightbox);
    const ghost = document.createElement("img");
    ghost.className = "lightbox-ghost";
    ghost.alt = "";
    ghost.setAttribute("aria-hidden", "true");
    ghost.decoding = "async";
    ghost.hidden = true;
    lightboxFigure.appendChild(ghost);
    const clearMotion = () => {
      [lightboxImage, lightboxVideo, ghost].forEach(el => {
        el.getAnimations().forEach(animation => animation.cancel());
        el.style.transform = "";
      });
      ghost.hidden = true;
    };
    // Some cars have no 1920 file. If the 1920 candidate fails to load, remember that for this photo and
    // fall back to the 1200 file (works for the main image, the neighbour preview and the preloads).
    const without1920 = new Set();
    const onLightboxError = event => {
      const el = event.target;
      const stem = el.dataset.stem;
      if (!stem || !el.getAttribute("srcset")) return;
      without1920.add(stem);
      el.removeAttribute("srcset");
      el.src = imagePath(variant(stem, 1200));
    };
    const assignLightboxSource = (el, stem) => {
      el.dataset.stem = stem;
      el.sizes = LIGHTBOX_SIZES_ATTR;
      if (without1920.has(stem)) el.removeAttribute("srcset");
      else el.srcset = srcsetOf(stem, LIGHTBOX_SIZES); // browser picks 1200 or 1920 for this screen
      el.src = imagePath(variant(stem, 1200));
    };
    const preloadLightbox = stem => {
      const warm = new Image();
      warm.addEventListener("error", onLightboxError);
      assignLightboxSource(warm, stem);
      return warm;
    };
    lightboxImage.addEventListener("error", onLightboxError);
    ghost.addEventListener("error", onLightboxError);
    const setLightboxImage = (stem, alt) => {
      assignLightboxSource(lightboxImage, stem);
      lightboxImage.alt = alt;
    };
    // direction: +1 = next (slides in from the right), -1 = previous (from the left), 0 = no animation.
    const showPhoto = (index, direction = 0, onSettled = null) => {
      const photos = visiblePhotos();
      if (!photos.length) return;
      activePhoto = (index + photos.length) % photos.length;
      const button = photos[activePhoto];
      const isVideo = button.dataset.type === "video";
      const image = button.querySelector("img");
      const token = ++slideToken;
      const wasShowingImage = !lightboxImage.hidden;
      lightboxVideo.pause();
      lightboxVideo.hidden = !isVideo;
      lightboxImage.hidden = isVideo;
      if (isVideo) {
        clearMotion();
        const videoSource = button.querySelector("video source");
        lightboxVideoSource.src = videoSource ? videoSource.src : (button.querySelector("video").currentSrc || button.querySelector("video").src);
        lightboxVideo.load();
        lightboxVideo.currentTime = 0;
        lightboxVideo.play().catch(() => {});
      } else {
        lightboxVideoSource.removeAttribute("src");
        lightboxVideo.load();
        const stem = button.dataset.stem;
        if (direction && wasShowingImage && !reduceMotion.matches && lightboxImage.animate) {
          // 1) slide the current photo out while 2) the next one downloads and decodes, then 3) slide it in.
          lightboxImage.hidden = false;
          const slideOut = lightboxImage.animate(
            [{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-direction * 30}%)`, opacity: 0 }],
            { duration: 100, easing: "ease-in", fill: "forwards" });
          const incoming = preloadLightbox(stem);
          Promise.all([slideOut.finished.catch(() => {}), incoming.decode().catch(() => {})]).then(() => {
            if (token !== slideToken) return; // a newer swipe took over
            clearMotion();
            setLightboxImage(stem, image.alt);
            lightboxImage.animate(
              [{ transform: `translateX(${direction * 30}%)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
              { duration: 140, easing: "ease-out" });
          });
        } else if (onSettled) {
          // Finger-swipe hand-off: the neighbour photo is already on screen (ghost). Load it into the main image,
          // and only when it is decoded remove the ghost, so there is no flash.
          setLightboxImage(stem, image.alt);
          lightboxImage.decode().catch(() => {}).then(() => {
            if (token === slideToken) clearMotion();
            onSettled();
          });
        } else {
          clearMotion();
          setLightboxImage(stem, image.alt);
        }
        // Warm the cache with the previous and next photo only (not the whole set), so swiping shows them instantly.
        [1, -1].forEach(step => {
          const neighbour = photos[(activePhoto + step + photos.length) % photos.length];
          if (neighbour && neighbour.dataset.stem && neighbour !== button) {
            preloadLightbox(neighbour.dataset.stem);
          }
        });
      }
      lightboxCounter.textContent = `${activePhoto + 1} / ${photos.length}`;
      $(".lightbox-prev", lightbox).disabled = photos.length < 2;
      $(".lightbox-next", lightbox).disabled = photos.length < 2;
    };
    const closeLightbox = () => { clearMotion(); swipeBusy = false; lightboxVideo.pause(); lightboxVideoSource.removeAttribute("src"); lightboxVideo.load(); lightbox.hidden = true; document.body.classList.remove("lightbox-open"); };
    $$(".gallery-photo", root).forEach(button => button.addEventListener("click", () => {
      const photos = visiblePhotos();
      const clicked = photos.indexOf(button);
      if (clicked < 0) return;
      lightbox.hidden = false;
      document.body.classList.add("lightbox-open");
      showPhoto(clicked);
      $(".lightbox-close", lightbox).focus();
    }));
    $(".lightbox-close", lightbox)?.addEventListener("click", closeLightbox);
    $(".lightbox-prev", lightbox)?.addEventListener("click", () => showPhoto(activePhoto - 1, -1));
    $(".lightbox-next", lightbox)?.addEventListener("click", () => showPhoto(activePhoto + 1, 1));
    lightbox?.addEventListener("click", event => { if (event.target === lightbox) closeLightbox(); });
    // Finger-following swipe: the photo moves with your finger (both directions, any speed); a neighbour peeks in.
    // Releasing past ~25% of the width, or with a quick flick, completes the slide; otherwise it springs back.
    const GAP = 16;
    let drag = null;
    let swipeBusy = false;
    const movingElement = () => (lightboxVideo.hidden ? lightboxImage : lightboxVideo);
    const showGhost = side => {
      const photos = visiblePhotos();
      const neighbour = photos[(activePhoto + side + photos.length) % photos.length];
      if (photos.length < 2 || !neighbour || neighbour.dataset.type === "video" || !neighbour.dataset.stem) { ghost.hidden = true; return; }
      assignLightboxSource(ghost, neighbour.dataset.stem);
      ghost.hidden = false;
    };
    lightbox?.addEventListener("touchstart", event => {
      // Leave the video's own controls (scrubbing, volume) alone.
      if (swipeBusy || event.touches.length !== 1 || event.target.closest("video")) { drag = null; return; }
      const touch = event.touches[0];
      drag = { x0: touch.clientX, y0: touch.clientY, mode: null, dx: 0, side: 0, samples: [{ x: touch.clientX, t: performance.now() }] };
    }, { passive: true });
    lightbox?.addEventListener("touchmove", event => {
      if (!drag || !event.touches.length) return;
      const touch = event.touches[0];
      const dx = touch.clientX - drag.x0;
      const dy = touch.clientY - drag.y0;
      if (!drag.mode) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // vertical gesture: not ours
        drag.mode = "h";
      }
      const now = performance.now();
      drag.samples.push({ x: touch.clientX, t: now });
      drag.samples = drag.samples.filter(sample => now - sample.t < 100);
      const count = visiblePhotos().length;
      drag.dx = count < 2 ? dx * 0.3 : dx; // a single photo just resists
      const side = dx < 0 ? 1 : -1;
      if (count > 1 && side !== drag.side) { drag.side = side; showGhost(side); }
      const width = lightbox.clientWidth;
      movingElement().style.transform = `translateX(${drag.dx}px)`;
      if (!ghost.hidden) ghost.style.transform = `translateX(${drag.dx + side * (width + GAP)}px)`;
    }, { passive: true });
    const endDrag = cancelled => {
      if (!drag || drag.mode !== "h") { drag = null; return; }
      const { dx, side, samples } = drag;
      drag = null;
      const width = lightbox.clientWidth;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0; // px per ms
      const count = visiblePhotos().length;
      const direction = dx < 0 ? 1 : -1;
      const flickedBack = Math.abs(velocity) > 0.4 && Math.sign(velocity) !== Math.sign(dx);
      const commit = !cancelled && count > 1 && !flickedBack &&
        (Math.abs(dx) > width * 0.25 || (Math.abs(velocity) > 0.4 && Math.abs(dx) > 24));
      const el = movingElement();
      const distance = width + GAP;
      swipeBusy = true;
      if (commit) {
        const speed = Math.max(Math.abs(velocity), 1.2);
        const duration = reduceMotion.matches ? 0 : Math.min(240, Math.max(100, (distance - Math.abs(dx)) / speed));
        const options = { duration, easing: "ease-out", fill: "forwards" };
        const finished = [el.animate([{ transform: `translateX(${dx}px)` }, { transform: `translateX(${-direction * distance}px)` }], options).finished];
        if (!ghost.hidden) finished.push(ghost.animate([{ transform: `translateX(${dx + direction * distance}px)` }, { transform: "translateX(0)" }], options).finished);
        Promise.all(finished.map(p => p.catch(() => {}))).then(() => {
          const settled = () => { swipeBusy = false; };
          showPhoto(activePhoto + direction, 0, ghost.hidden ? null : settled);
          if (ghost.hidden) settled();
        });
      } else {
        const options = { duration: reduceMotion.matches ? 0 : 180, easing: "ease-out", fill: "forwards" };
        const finished = [el.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], options).finished];
        if (!ghost.hidden) finished.push(ghost.animate([{ transform: `translateX(${dx + side * distance}px)` }, { transform: `translateX(${side * distance}px)` }], options).finished);
        Promise.all(finished.map(p => p.catch(() => {}))).then(() => { clearMotion(); swipeBusy = false; });
      }
    };
    lightbox?.addEventListener("touchend", () => endDrag(false), { passive: true });
    lightbox?.addEventListener("touchcancel", () => endDrag(true), { passive: true });
    document.addEventListener("keydown", event => {
      if (!lightbox || lightbox.hidden) return;
      if (event.key === "Escape") closeLightbox();
      else if (event.key === "ArrowLeft") showPhoto(activePhoto - 1, -1);
      else if (event.key === "ArrowRight") showPhoto(activePhoto + 1, 1);
    });
  }

  // quotes.json holds the quotes and the timing settings; it is fetched once and shared.
  let settingsPromise = null;
  const getSettings = () => settingsPromise || (settingsPromise = fetch("quotes.json")
    .then(response => (response.ok ? response.json() : {}))
    .catch(() => ({})));

  // Rotating quotes in the hero. Text and timing come from quotes.json (intervalSeconds + a list of quotes).
  async function initQuotes() {
    const box = $(".hero-intro");
    if (!box) return;
    const config = await getSettings();
    const quotes = safeArray(config.quotes).filter(q => Array.isArray(q) && q.length);
    if (quotes.length < 1) return;
    const seconds = Number(config.quoteIntervalSeconds) > 0 ? Number(config.quoteIntervalSeconds) : 5;
    const render = quote => { box.innerHTML = quote.map(line => escapeHTML(String(line))).join("<br>"); };
    let index = 0;
    render(quotes[0]);
    if (quotes.length < 2) return;
    const fade = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.style.transition = fade ? "opacity .45s ease" : "";
    setInterval(() => {
      if (document.hidden) return;
      index = (index + 1) % quotes.length;
      if (!fade) { render(quotes[index]); return; }
      box.style.opacity = "0";
      setTimeout(() => { render(quotes[index]); box.style.opacity = "1"; }, 450);
    }, seconds * 1000);
  }

  // Hero slideshow. Finds assets/Home/Hero-01, Hero-02, ... automatically (stops at the first missing number).
  // Timing (heroIntervalSeconds, heroTransitionSeconds) is set in quotes.json.
  async function initHeroSlideshow() {
    const wrap = $(".hero-image");
    const first = wrap && $("img", wrap);
    if (!first) return;
    const config = await getSettings();
    const seconds = Number(config.heroIntervalSeconds) > 0 ? Number(config.heroIntervalSeconds) : 8;
    const fadeSeconds = Number(config.heroTransitionSeconds) >= 0 ? Number(config.heroTransitionSeconds) : 1.2;
    wrap.style.setProperty("--hero-fade", `${fadeSeconds}s`);
    // Wait until the first image and the page are done, so looking for more images never slows the first paint.
    if (document.readyState !== "complete") await new Promise(resolve => window.addEventListener("load", resolve, { once: true }));
    const label = n => String(n).padStart(2, "0");
    const stems = ["assets/Home/Hero-01"];
    for (let n = 2; n <= 20; n++) {
      const stem = `assets/Home/Hero-${label(n)}`;
      if (!(await probeThumb(stem))) break;
      stems.push(stem);
    }
    if (stems.length < 2) return;

    const second = first.cloneNode();
    second.removeAttribute("srcset");
    second.removeAttribute("src");
    second.alt = "";
    second.setAttribute("aria-hidden", "true");
    second.fetchPriority = "auto";
    second.classList.add("is-hidden");
    wrap.appendChild(second);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) wrap.classList.add("no-fade");

    let front = first, back = second, current = 0, busy = false;
    setInterval(async () => {
      if (busy || document.hidden) return;
      busy = true;
      const next = (current + 1) % stems.length;
      back.sizes = "100vw";
      back.srcset = srcsetOf(stems[next], [300, 600, 1200, 1920]);
      back.src = imagePath(variant(stems[next], 1200));
      await back.decode().catch(() => {}); // fade only once the next image is ready
      back.classList.remove("is-hidden");
      front.classList.add("is-hidden");
      [front, back] = [back, front];
      current = next;
      busy = false;
    }, seconds * 1000);
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const carId = params.get("car");
    if (!carId) { initQuotes(); initHeroSlideshow(); }
    const cars = await loadCars();
    if (carId) {
      document.title = `${cars.find(car => String(car.id) === carId)?.title || "Porsche 911"} — 911 Archive`;
      initDetail(cars, carId);
    } else {
      $("#year") && ($("#year").textContent = new Date().getFullYear());
      initListing(cars);
    }
  }
  boot();
})();