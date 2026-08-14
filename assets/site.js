(() => {
  "use strict";

  const SHEET_BASE = "https://docs.google.com/spreadsheets/d/1St2Nqx9SoFAaOX2Q62aBV69W9RbWx4fRGifG-P_Fh_U/gviz/tq?tqx=out:json&sheet=";
  const INFO_URL = `${SHEET_BASE}info`;
  const BLOG_URL = `${SHEET_BASE}blog`;

  const infoContainer = document.getElementById("info-content");
  const blogContainer = document.getElementById("blog-content");
  const mobileFooterContainer = document.getElementById("mobile-footer");
  const leftPanel = document.getElementById("left");
  const rightPanel = document.getElementById("right");
  const discoveryVeil = document.getElementById("discovery-veil");
  const discoveryWindows = document.getElementById("discovery-windows");
  const lineWindows = document.getElementById("line-windows");
  const veilWindowGradient = document.getElementById("veil-window-gradient");
  const lineWindowGradient = document.getElementById("line-window-gradient");
  const structureLines = document.getElementById("structure-lines");
  const visitorCirclesLayer = document.getElementById("visitor-circles");
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  // Add or remove colors here to control the available visitor-circle palette.
  const VISITOR_COLORS = ["#BF0000", "#262A8F", "#D29E00"];
  // Fallbacks used only if a real visitor has not supplied a field.
  const PLACEHOLDER_VISITOR_INFO = {
    device: "Okänd enhet",
    timezone: "Okänd tidszon"
  };
  // PPPangram's glyphs overhang their line box slightly at this tight tracking.
  // Keep a small optical inset so its visible left/right margins match the panel padding.
  const TITLE_OPTICAL_FIT = 0.975;
  // The face the title is measured against. Safari resolves document.fonts.ready
  // without waiting for a face that layout has not requested yet, so the fit has
  // to ask for this one by name before it can trust its own measurement.
  const TITLE_FONT_FACE = '700 100px "PPPangram Sans Rounded"';
  // One pass is enough when text width scales linearly with font size; the extra
  // passes only correct the browsers where it does not quite.
  const TITLE_FIT_PASSES = 3;
  const TITLE_FIT_TOLERANCE = 0.25;
  let activeTitle = null;
  let titleFitQueued = false;
  let structureLinesQueued = false;
  let structureLineIndex = 0;
  let startWindowReveal = () => {};

  // A refreshed mobile page should always introduce itself from the logo, not
  // from Safari's restored document position.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const resetInitialScroll = () => {
    window.scrollTo(0, 0);
    rightPanel.scrollTop = 0;
  };
  resetInitialScroll();
  window.addEventListener("pageshow", resetInitialScroll);

  function addStructureLine(x1, y1, x2, y2) {
    let line = structureLines.children[structureLineIndex];
    if (!line) {
      line = document.createElementNS(SVG_NAMESPACE, "line");
      line.setAttribute("stroke", "black");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      structureLines.append(line);
    }
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    structureLineIndex += 1;
  }

  function renderStructureLines() {
    if (!discoveryVeil || !structureLines) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightBounds = rightPanel.getBoundingClientRect();
    const stackedLayout = window.matchMedia("(max-width: 900px)").matches;
    const leftDividerEnd = stackedLayout ? viewportWidth : rightBounds.left;
    const feedDividerStart = stackedLayout ? 0 : rightBounds.left;
    discoveryVeil.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
    structureLineIndex = 0;

    // On desktop the left panel has a vertical edge. On mobile it is stacked,
    // so its horizontal dividers instead span the full viewport.
    if (!stackedLayout) addStructureLine(rightBounds.left, 0, rightBounds.left, viewportHeight);
    const title = activeTitle || document.getElementById("site-title");
    const footer = stackedLayout
      ? mobileFooterContainer?.querySelector(".left-footer")
      : infoContainer.querySelector(".left-footer");
    if (title) {
      const titleBounds = title.getBoundingClientRect();
      addStructureLine(0, titleBounds.bottom, leftDividerEnd, titleBounds.bottom);
    }
    if (footer) {
      const footerBounds = footer.getBoundingClientRect();
      addStructureLine(0, footerBounds.top, leftDividerEnd, footerBounds.top);
    }

    // The feed moves beneath the fixed veil, so its separators use its current
    // viewport positions and are redrawn as that panel scrolls.
    blogContainer.querySelectorAll(".right-group").forEach(group => {
      const heading = group.querySelector(":scope > .right-h3");
      const posts = [...group.querySelectorAll(":scope > .blog-post")];
      if (!posts.length) return;

      if (heading) {
        const headingBounds = heading.getBoundingClientRect();
        const firstPostBounds = posts[0].getBoundingClientRect();
        const dividerY = (headingBounds.bottom + firstPostBounds.top) / 2;
        addStructureLine(feedDividerStart, dividerY, viewportWidth, dividerY);
      }

      posts.slice(0, -1).forEach((post, index) => {
        const currentBounds = post.getBoundingClientRect();
        const nextBounds = posts[index + 1].getBoundingClientRect();
        const dividerY = (currentBounds.bottom + nextBounds.top) / 2;
        addStructureLine(feedDividerStart, dividerY, viewportWidth, dividerY);
      });
    });

    // Keep the SVG collection in sync with the current number of dividers
    // without tearing down and recreating it every scroll frame.
    while (structureLines.children.length > structureLineIndex) {
      structureLines.lastElementChild.remove();
    }
  }

  function scheduleStructureLines() {
    if (structureLinesQueued) return;
    structureLinesQueued = true;
    requestAnimationFrame(() => {
      structureLinesQueued = false;
      renderStructureLines();
    });
  }

  // A clone lets the browser measure the longest <br>-separated line with the
  // actual font, kerning, and letter-spacing applied.
  function measureTitleLine(size) {
    const measure = activeTitle.cloneNode(true);
    measure.removeAttribute("id");
    Object.assign(measure.style, {
      position: "fixed",
      top: "-10000px",
      left: "-10000px",
      visibility: "hidden",
      width: "max-content",
      maxWidth: "none",
      margin: "0",
      whiteSpace: "nowrap",
      fontSize: `${size}px`
    });
    document.body.append(measure);
    const width = measure.getBoundingClientRect().width;
    measure.remove();
    return width;
  }

  function fitTitleToPanel() {
    if (!activeTitle || !activeTitle.isConnected) return;

    // Start from the CSS fallback size on every pass, rather than compounding scale changes.
    activeTitle.style.removeProperty("font-size");
    const availableWidth = activeTitle.getBoundingClientRect().width;
    if (!availableWidth) return;
    const baseSize = Number.parseFloat(getComputedStyle(activeTitle).fontSize);
    if (!baseSize) return;

    const targetWidth = availableWidth * TITLE_OPTICAL_FIT;
    let size = baseSize;
    // Re-measure at the size we are about to apply instead of trusting a single
    // ratio, so a browser whose text width is not exactly proportional to the
    // font size still lands inside the panel rather than under the green column.
    for (let pass = 0; pass < TITLE_FIT_PASSES; pass++) {
      const textWidth = measureTitleLine(size);
      if (!textWidth) return;
      const corrected = size * (targetWidth / textWidth);
      const settled = Math.abs(corrected - size) <= TITLE_FIT_TOLERANCE;
      size = corrected;
      if (settled) break;
    }

    activeTitle.style.fontSize = `${size}px`;
    scheduleStructureLines();
  }

  // Resolves once the display face is genuinely usable, not merely once the
  // browser considers its own pending font work finished.
  function whenTitleFontReady() {
    if (!document.fonts) return Promise.resolve();
    return document.fonts.load(TITLE_FONT_FACE)
      .catch(() => {})
      .then(() => document.fonts.ready)
      .catch(() => {});
  }

  function scheduleTitleFit() {
    if (titleFitQueued) return;
    titleFitQueued = true;
    requestAnimationFrame(() => {
      titleFitQueued = false;
      fitTitleToPanel();
    });
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleTitleFit).observe(leftPanel);
  } else {
    window.addEventListener("resize", scheduleTitleFit);
  }
  // The panel never resizes when a face swaps in, so the fit has to be told.
  document.fonts?.addEventListener?.("loadingdone", scheduleTitleFit);
  rightPanel.addEventListener("scroll", scheduleStructureLines, { passive: true });
  window.addEventListener("resize", scheduleStructureLines);
  window.addEventListener("scroll", scheduleStructureLines, { passive: true });

  // On the desktop split layout, scrolling anywhere controls the green feed.
  document.addEventListener("wheel", event => {
    if (!window.matchMedia("(min-width: 901px)").matches || event.ctrlKey) return;
    const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight
      : 1;
    rightPanel.scrollBy({
      top: event.deltaY * multiplier,
      left: event.deltaX * multiplier
    });
    event.preventDefault();
  }, { passive: false });

  // Hidden viewing shortcut: V reveals the page, V again restores the veil.
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() !== "v" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.matches("input, textarea, select, [contenteditable='true']")) return;
    document.body.classList.toggle("is-veil-hidden");
  });

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function friendlyDeviceName() {
    const userAgent = navigator.userAgent;
    if (/iPhone/i.test(userAgent)) return "iPhone";
    if (/iPad/i.test(userAgent)) return "iPad";
    if (/Android/i.test(userAgent)) return "Android";
    if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
    if (/Windows/i.test(userAgent)) return "Windows";
    if (/Linux/i.test(userAgent)) return "Linux";
    return "Okänd enhet";
  }

  function utcOffset() {
    const offset = -new Date().getTimezoneOffset() / 60;
    return `UTC${offset >= 0 ? "+" : ""}${offset}`;
  }

  function formatVisitDuration(joinedAt) {
    if (!Number.isFinite(Number(joinedAt))) return "just nu";
    const seconds = Math.max(0, Math.floor((Date.now() - Number(joinedAt)) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  }

  async function getSheet(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
    const text = await response.text();
    const match = text.match(/setResponse\((.*)\);\s*$/s);
    if (!match) throw new Error("Unexpected Sheet response");
    return JSON.parse(match[1]).table;
  }

  function cellsToObject(row, headers) {
    return headers.reduce((record, header, index) => {
      record[header] = row.c[index]?.v ?? "";
      return record;
    }, {});
  }

  // The info sheet's first data row is its header row; this keeps the sheet easy to edit.
  async function loadInfo() {
    try {
      const table = await getSheet(INFO_URL);
      const [headerRow, contentRow] = table.rows;
      if (!headerRow || !contentRow) throw new Error("Info sheet has no content row");
      const headers = headerRow.c.map(cell => cell?.v?.trim().toLowerCase() ?? "");
      renderInfo(cellsToObject(contentRow, headers));
    } catch (error) {
      console.error("Could not load info sheet", error);
      infoContainer.replaceChildren(makeElement("p", "error-message", "Kunde inte ladda informationen just nu."));
    } finally {
      infoContainer.setAttribute("aria-busy", "false");
    }
  }

  function appendSafeRichText(container, html) {
    const source = new DOMParser().parseFromString(html || "", "text/html").body;
    const allowedProtocols = new Set(["mailto:", "tel:", "https:", "http:"]);

    function appendNode(parent, node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(node.textContent);
        return;
      }

      if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(node.nodeName)) return;

      if (node.nodeName === "BR") {
        parent.append(document.createElement("br"));
        return;
      }

      if (node.nodeName === "A") {
        const href = node.getAttribute("href") || "";
        try {
          const url = new URL(href, window.location.href);
          if (allowedProtocols.has(url.protocol)) {
            const link = makeElement("a");
            link.href = href;
            if (url.protocol === "http:" || url.protocol === "https:") {
              link.target = "_blank";
              link.rel = "noopener noreferrer";
            }
            [...node.childNodes].forEach(child => appendNode(link, child));
            parent.append(link);
            return;
          }
        } catch (_) { /* Render invalid links as text. */ }
      }

      if (["EM", "I", "STRONG", "B"].includes(node.nodeName)) {
        const tag = node.nodeName === "I" ? "em" : node.nodeName === "B" ? "strong" : node.nodeName.toLowerCase();
        const formatted = document.createElement(tag);
        [...node.childNodes].forEach(child => appendNode(formatted, child));
        parent.append(formatted);
        return;
      }

      // Unsupported markup is removed, but its safe textual/formatted children remain.
      [...node.childNodes].forEach(child => appendNode(parent, child));
    }

    [...source.childNodes].forEach(node => appendNode(container, node));
  }

  function renderInfo(info) {
    const fragment = document.createDocumentFragment();
    const title = makeElement("h1", "left-title");
    title.id = "site-title";
    appendSafeRichText(title, info.rubrik || "Frilansare för fred");
    fragment.append(title);

    ["stycke1", "stycke2", "stycke3", "stycke4"].forEach((key, index) => {
      if (info[key]) {
        const paragraph = makeElement("p", `left-manifesto manifesto-${index + 1}`);
        appendSafeRichText(paragraph, info[key]);
        fragment.append(paragraph);
      }
    });

    const footer = makeElement("div", "left-footer");
    [
      ["HITTA HIT:", "hitta hit"],
      ["KONTAKTA OSS:", "kontakta oss"],
      ["ENGAGERA DIG:", "engagera dig"]
    ].forEach(([heading, key]) => {
      const column = makeElement("section", "footer-col");
      column.append(makeElement("h2", "left-h3", heading));
      const body = makeElement("p", "left-block");
      appendSafeRichText(body, info[key]);
      column.append(body);
      footer.append(column);
    });
    fragment.append(footer);
    infoContainer.replaceChildren(fragment);
    // The mobile composition places the same footer after the green feed.
    // Keep a separate rendered copy so the desktop DOM and layout stay intact.
    mobileFooterContainer?.replaceChildren(footer.cloneNode(true));
    activeTitle = title;
    scheduleTitleFit();
    scheduleStructureLines();
    // The first pass may use the fallback font; fit once more after the display
    // font itself is loaded, then again if any later face swaps in.
    whenTitleFontReady().then(scheduleTitleFit);
  }

  async function loadBlog() {
    try {
      const table = await getSheet(BLOG_URL);
      const headers = table.cols.map(column => column.label.trim().toLowerCase());
      const posts = table.rows
        .map(row => cellsToObject(row, headers))
        .filter(post => post.published === true && post.title);
      renderBlog(posts);
    } catch (error) {
      console.error("Could not load blog sheet", error);
      blogContainer.replaceChildren(makeElement("p", "error-message", "Kunde inte ladda evenemangen just nu."));
    } finally {
      blogContainer.setAttribute("aria-busy", "false");
    }
  }

  function formatDate(value) {
    const match = String(value).match(/Date\((\d+),(\d+),(\d+)/);
    if (!match) return "";
    const date = new Date(Number(match[1]), Number(match[2]), Number(match[3]));
    const formatted = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function formatTime(value) {
    const match = String(value).match(/Date\(\d+,\d+,\d+,(\d+),(\d+)/);
    return match ? `Kl ${match[1]}:${match[2].padStart(2, "0")}` : (value ? `Kl ${value}` : "");
  }

  function imageUrl(value) {
    if (!value || typeof value !== "string") return null;
    try {
      const url = new URL(value.trim(), window.location.href);
      if (!["https:", "http:"].includes(url.protocol)) return null;

      // Also accept the regular Google Drive sharing URL. The Drive file must be
      // shared with "Anyone with the link" for site visitors to view it.
      if (url.hostname === "drive.google.com") {
        const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
        const id = fileMatch?.[1] || url.searchParams.get("id");
        if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
      }
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function renderPostImage(post) {
    const src = imageUrl(post.image_url);
    if (!src) return null;

    const figure = makeElement("figure", "post-image-figure");
    const frame = makeElement("div", "post-image-frame");
    const image = document.createElement("img");
    image.src = src;
    image.alt = post.image_alt || "";
    image.loading = "lazy";
    image.decoding = "async";
    frame.append(image);
    figure.append(frame);

    if (post.image_credit) {
      const credit = makeElement("figcaption", "post-image-credit");
      appendSafeRichText(credit, post.image_credit);
      figure.append(credit);
    }

    // A broken pasted link should not leave an empty image frame or credit behind.
    image.addEventListener("error", () => figure.remove());
    return figure;
  }

  function renderBlog(posts) {
    const fragment = document.createDocumentFragment();
    [["Kommande", "KOMMANDE:"], ["Tidigare", "TIDIGARE:"]].forEach(([type, label]) => {
      const matchingPosts = posts.filter(post => post.type === type);
      if (!matchingPosts.length) return;
      const group = makeElement("section", "right-group");
      group.append(makeElement("h2", "right-h3", label));
      matchingPosts.forEach(post => group.append(renderPost(post)));
      fragment.append(group);
    });
    blogContainer.replaceChildren(fragment);
    scheduleStructureLines();
  }

  function renderPost(post) {
    const article = makeElement("article", "blog-post");
    const title = makeElement("h3", "right-h2");
    appendSafeRichText(title, post.title);
    article.append(title);
    const meta = makeElement("p", "post-meta");
    const dateAndTime = [formatDate(post.date), formatTime(post.time)].filter(Boolean).join(" ");
    if (dateAndTime) meta.append(makeElement("time", "", dateAndTime));
    if (post.location) {
      const location = makeElement("span", "location");
      appendSafeRichText(location, post.location);
      meta.append(location);
    }
    if (meta.childNodes.length) article.append(meta);
    const image = renderPostImage(post);
    if (image) article.append(image);
    if (post.body) {
      const body = makeElement("p", "right-body");
      appendSafeRichText(body, post.body);
      article.append(body);
    }
    return article;
  }

  function initializeCircles() {
    if (!window.firebase) return;
    const config = {
      apiKey: "AIzaSyCkTn4tmo-tzwCR1KuzniDhDTe7R8MNNUo",
      authDomain: "fff1-74e23.firebaseapp.com",
      databaseURL: "https://fff1-74e23-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "fff1-74e23",
      storageBucket: "fff1-74e23.appspot.com",
      messagingSenderId: "24568244243",
      appId: "1:24568243:web:419b04ff26b007756877e6"
    };
    if (!firebase.apps.length) firebase.initializeApp(config);
    const db = firebase.database();
    const circle = document.getElementById("my-circle");
    const sessionKey = "fff-circle-user-id";
    const joinedAtKey = "fff-circle-joined-at";
    let userId = sessionStorage.getItem(sessionKey);
    if (!userId) {
      userId = `user_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(sessionKey, userId);
    }
    let joinedAt = Number(sessionStorage.getItem(joinedAtKey));
    if (!Number.isFinite(joinedAt) || joinedAt <= 0) {
      joinedAt = Date.now();
      sessionStorage.setItem(joinedAtKey, String(joinedAt));
    }
    const userRef = db.ref(`circles/${userId}`);
    const circlesRef = db.ref("circles");
    const otherCircles = new Map();
    let position = { x: .5, y: .5 };
    let dragging = false;
    let pointerOffset = { x: 0, y: 0 };
    let lastWrite = 0;
    let circleWidth = circle.offsetWidth;
    let circleHeight = circle.offsetHeight;
    let discoveryRenderQueued = false;
    let windowAnimationFrame = null;
    let dragPointerId = null;
    let dragStartedAt = null;
    let suppressVeilClick = false;
    let revealScale = 0;
    let revealStarted = false;
    let revealAnimationFrame = null;
    let resizePositionWriteTimer = null;
    let dragScrollAnimationFrame = null;
    let dragScrollLastTime = null;
    let dragScrollZone = resolvedCssLength("--window-scroll-zone");
    let dragScrollMaxSpeed = resolvedCssLength("--window-scroll-max-speed");

    const refreshCircleDimensions = () => {
      circleWidth = circle.offsetWidth;
      circleHeight = circle.offsetHeight;
    };
    const travelDistance = (viewportSize, elementSize) => {
      const distance = viewportSize - elementSize;
      // Preserve a signed distance when the window is larger than the viewport.
      // That is what lets a mobile-sized window travel sideways beyond its edges.
      return Math.abs(distance) < .01 ? 1 : distance;
    };
    const centeredPosition = () => ({
      x: (window.innerWidth / 2 - circleWidth / 2) / travelDistance(window.innerWidth, circleWidth),
      y: (window.innerHeight / 2 - circleHeight / 2) / travelDistance(window.innerHeight, circleHeight)
    });
    const pixelsFor = ({ x, y }, element = circle) => {
      const width = element === circle ? circleWidth : element.offsetWidth;
      const height = element === circle ? circleHeight : element.offsetHeight;
      return {
        left: x * travelDistance(window.innerWidth, width),
        top: y * travelDistance(window.innerHeight, height)
      };
    };
    const place = (element, pos) => {
      const { left, top } = pixelsFor(pos, element);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    };

    function resolvedCssLength(variableName) {
      const probe = document.createElement("div");
      probe.style.cssText = `position:fixed; visibility:hidden; width:var(${variableName});`;
      document.body.append(probe);
      const pixels = Number.parseFloat(getComputedStyle(probe).width);
      probe.remove();
      return pixels;
    }

    function readWindowMaskSettings() {
      return {
        veilDiameter: resolvedCssLength("--veil-window-diameter"),
        veilBlur: resolvedCssLength("--veil-window-blur"),
        lineDiameter: resolvedCssLength("--line-window-diameter"),
        lineBlur: resolvedCssLength("--line-window-blur")
      };
    }

    let windowMaskSettings = readWindowMaskSettings();
    let visitorCircleDiameter = resolvedCssLength("--visitor-circle-diameter");
    let visitorCircleTextPadding = resolvedCssLength("--visitor-circle-text-padding");
    function setGradientFeather(gradient, diameter, blur) {
      if (!gradient) return;
      const radius = Math.max(1, diameter / 2);
      const core = Math.max(0, Math.min(1, 1 - (blur / radius)));
      const feather = 1 - core;
      const offsets = [0, core, core + feather * .24, core + feather * .56, core + feather * .82, 1];
      [...gradient.querySelectorAll("stop")].forEach((stop, index) => {
        stop.setAttribute("offset", String(offsets[index] ?? 1));
      });
    }
    function applyWindowMaskSettings() {
      setGradientFeather(veilWindowGradient, windowMaskSettings.veilDiameter, windowMaskSettings.veilBlur);
      setGradientFeather(lineWindowGradient, windowMaskSettings.lineDiameter, windowMaskSettings.lineBlur);
    }
    function updateDiscoveryViewport() {
      discoveryVeil?.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    }
    applyWindowMaskSettings();
    updateDiscoveryViewport();
    const veilHole = document.createElementNS(SVG_NAMESPACE, "circle");
    const lineHole = document.createElementNS(SVG_NAMESPACE, "circle");
    veilHole.setAttribute("fill", "url(#veil-window-gradient)");
    lineHole.setAttribute("fill", "url(#line-window-gradient)");
    discoveryWindows.replaceChildren(veilHole);
    lineWindows.replaceChildren(lineHole);

    function renderDiscoveryWindows() {
      if (!discoveryVeil || !discoveryWindows || !lineWindows) return;
      const controlRadius = circleWidth / 2;
      const { left, top } = pixelsFor(position);
      const centerX = left + controlRadius;
      const centerY = top + controlRadius;
      veilHole.setAttribute("cx", String(centerX));
      veilHole.setAttribute("cy", String(centerY));
      veilHole.setAttribute("r", String((windowMaskSettings.veilDiameter / 2) * revealScale));
      lineHole.setAttribute("cx", String(centerX));
      lineHole.setAttribute("cy", String(centerY));
      lineHole.setAttribute("r", String((windowMaskSettings.lineDiameter / 2) * revealScale));
    }

    function scheduleDiscoveryRender() {
      if (discoveryRenderQueued) return;
      discoveryRenderQueued = true;
      requestAnimationFrame(() => {
        discoveryRenderQueued = false;
        renderDiscoveryWindows();
      });
    }

    const visitorMetadata = {
      activeSession: true,
      joinedAt,
      device: friendlyDeviceName(),
      timezone: utcOffset()
    };
    const sharedViewportPosition = () => {
      const { left, top } = pixelsFor(position);
      return {
        // These are independent of the draggable window's diameter, so another
        // browser can place its smaller visitor outline at the same screen point.
        viewportX: Math.min(1, Math.max(0, (left + circleWidth / 2) / window.innerWidth)),
        viewportY: Math.min(1, Math.max(0, (top + circleHeight / 2) / window.innerHeight))
      };
    };
    const registerSession = () => userRef.update({
      ...position,
      ...sharedViewportPosition(),
      ...visitorMetadata
    }).catch(error => console.error("Could not register visitor", error));
    const writePosition = () => userRef.update({
      x: position.x,
      y: position.y,
      ...sharedViewportPosition()
    }).catch(error => console.error("Could not update circle", error));

    const cancelWindowAnimation = () => {
      if (windowAnimationFrame !== null) cancelAnimationFrame(windowAnimationFrame);
      windowAnimationFrame = null;
    };
    const finishIntroReveal = () => {
      if (revealAnimationFrame !== null) cancelAnimationFrame(revealAnimationFrame);
      revealAnimationFrame = null;
      if (revealStarted) {
        revealScale = 1;
        scheduleDiscoveryRender();
      }
    };
    const stopDragAutoScroll = () => {
      if (dragScrollAnimationFrame !== null) cancelAnimationFrame(dragScrollAnimationFrame);
      dragScrollAnimationFrame = null;
      dragScrollLastTime = null;
    };
    const dragScrollSpeed = () => {
      const { top } = pixelsFor(position);
      const centerY = top + circleHeight / 2;
      const zone = Math.max(1, dragScrollZone);
      const topStrength = Math.max(0, Math.min(1, (zone - centerY) / zone));
      const bottomStrength = Math.max(0, Math.min(1, (centerY - (window.innerHeight - zone)) / zone));
      // Squaring the strength makes the speed ease in from zero at the zone edge.
      return (bottomStrength * bottomStrength - topStrength * topStrength) * dragScrollMaxSpeed;
    };
    const runDragAutoScroll = now => {
      if (!dragging) {
        stopDragAutoScroll();
        return;
      }
      const elapsed = Math.min(32, Math.max(0, now - (dragScrollLastTime ?? now)));
      dragScrollLastTime = now;
      const speed = dragScrollSpeed();
      if (speed) {
        const scrollTarget = window.matchMedia("(min-width: 901px)").matches
          ? rightPanel
          : document.scrollingElement;
        const previousScrollTop = scrollTarget.scrollTop;
        scrollTarget.scrollTop += speed * elapsed / 1000;
        // The scroll event can arrive a frame later in Safari. Update here as
        // well so the fixed SVG dividers share this exact scroll frame.
        if (scrollTarget.scrollTop !== previousScrollTop) renderStructureLines();
      }
      dragScrollAnimationFrame = requestAnimationFrame(runDragAutoScroll);
    };
    const startDragAutoScroll = () => {
      if (dragScrollAnimationFrame !== null) return;
      dragScrollLastTime = performance.now();
      dragScrollAnimationFrame = requestAnimationFrame(runDragAutoScroll);
    };
    const placeOwnCircle = () => {
      const { left, top } = pixelsFor(position);
      circle.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      scheduleDiscoveryRender();
    };

    startWindowReveal = () => {
      if (revealStarted) return;
      revealStarted = true;
      const startedAt = performance.now();
      const openingDuration = 460;
      const nudgeDuration = 1500;
      const restingPosition = { ...position };
      const nudgeDistance = Math.min(100, circleWidth * .3);
      const step = now => {
        const elapsed = now - startedAt;
        const openingProgress = Math.min(1, elapsed / openingDuration);
        revealScale = 1 - Math.pow(1 - openingProgress, 4);

        if (elapsed > openingDuration) {
          const nudgeProgress = Math.min(1, (elapsed - openingDuration) / nudgeDuration);
          const envelope = Math.sin(nudgeProgress * Math.PI);
          const offset = Math.sin(nudgeProgress * Math.PI * 2) * envelope * nudgeDistance;
          position = {
            ...restingPosition,
            x: restingPosition.x + offset / travelDistance(window.innerWidth, circleWidth)
          };
          placeOwnCircle();
        }
        scheduleDiscoveryRender();
        if (elapsed < openingDuration + nudgeDuration) {
          revealAnimationFrame = requestAnimationFrame(step);
        } else {
          revealAnimationFrame = null;
          position = restingPosition;
          placeOwnCircle();
        }
      };
      revealAnimationFrame = requestAnimationFrame(step);
    };

    function isVeilAtPoint(x, y) {
      const { left, top } = pixelsFor(position);
      const centerX = left + circleWidth / 2;
      const centerY = top + circleHeight / 2;
      const clearRadius = Math.max(0, windowMaskSettings.veilDiameter / 2 - windowMaskSettings.veilBlur);
      return Math.hypot(x - centerX, y - centerY) > clearRadius;
    }

    function isInsideWindowControl(x, y) {
      const { left, top } = pixelsFor(position);
      const centerX = left + circleWidth / 2;
      const centerY = top + circleHeight / 2;
      return Math.hypot(x - centerX, y - centerY) <= circleWidth / 2;
    }

    function moveWindowTo(x, y) {
      cancelWindowAnimation();
      finishIntroReveal();
      const target = {
        x: (x - circleWidth / 2) / travelDistance(window.innerWidth, circleWidth),
        y: (y - circleHeight / 2) / travelDistance(window.innerHeight, circleHeight)
      };
      const start = { ...position };
      const startedAt = performance.now();
      const duration = 260;

      const step = now => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        position = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased
        };
        placeOwnCircle();
        if (progress < 1) {
          windowAnimationFrame = requestAnimationFrame(step);
        } else {
          windowAnimationFrame = null;
          writePosition();
        }
      };
      windowAnimationFrame = requestAnimationFrame(step);
    }

    const colorForVisitor = id => {
      const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
      return VISITOR_COLORS[hash % VISITOR_COLORS.length];
    };

    function placeVisitorCircle(element, visitorPosition, visitor = {}) {
      // Firebase x/y are relative to the draggable window's travel distance,
      // not the smaller visitor-outline diameter. Convert them through that
      // original coordinate space so both circles describe the same location.
      const x = Math.min(1, Math.max(0, Number(visitorPosition.x) || 0));
      const y = Math.min(1, Math.max(0, Number(visitorPosition.y) || 0));
      const sharedX = Number(visitor.viewportX);
      const sharedY = Number(visitor.viewportY);
      const hasSharedPosition = Number.isFinite(sharedX) && Number.isFinite(sharedY);
      const windowCenterX = hasSharedPosition
        ? Math.min(1, Math.max(0, sharedX)) * window.innerWidth
        : x * Math.max(0, window.innerWidth - circleWidth) + circleWidth / 2;
      const windowCenterY = hasSharedPosition
        ? Math.min(1, Math.max(0, sharedY)) * window.innerHeight
        : y * Math.max(0, window.innerHeight - circleHeight) + circleHeight / 2;
      const left = Math.min(
        Math.max(0, windowCenterX - visitorCircleDiameter / 2),
        Math.max(0, window.innerWidth - visitorCircleDiameter)
      );
      const top = Math.min(
        Math.max(0, windowCenterY - visitorCircleDiameter / 2),
        Math.max(0, window.innerHeight - visitorCircleDiameter)
      );
      element.style.transform = `translate(${left}px, ${top}px)`;
    }

    function createVisitorCircle(id, visitor) {
      const color = visitor.color || colorForVisitor(id);
      const element = document.createElementNS(SVG_NAMESPACE, "g");
      element.classList.add("visitor-circle");
      const outline = document.createElementNS(SVG_NAMESPACE, "circle");
      outline.classList.add("visitor-outline");
      outline.setAttribute("cx", String(visitorCircleDiameter / 2));
      outline.setAttribute("cy", String(visitorCircleDiameter / 2));
      outline.setAttribute("r", String(visitorCircleDiameter / 2 - .5));
      outline.setAttribute("fill", "none");
      outline.setAttribute("stroke", color);
      outline.setAttribute("stroke-width", "1");
      const details = document.createElementNS(SVG_NAMESPACE, "g");
      details.classList.add("visitor-info");
      details.setAttribute("fill", color);
      element.append(outline, details);
      updateVisitorDetails(element, visitor);
      visitorCirclesLayer.append(element);
      return element;
    }

    function updateVisitorDetails(element, visitor) {
      const details = element.querySelector(".visitor-info");
      if (!details) return;
      const outline = element.querySelector(".visitor-outline");
      outline?.setAttribute("cx", String(visitorCircleDiameter / 2));
      outline?.setAttribute("cy", String(visitorCircleDiameter / 2));
      outline?.setAttribute("r", String(visitorCircleDiameter / 2 - .5));
      const info = {
        device: visitor.device || PLACEHOLDER_VISITOR_INFO.device,
        timezone: visitor.timezone || PLACEHOLDER_VISITOR_INFO.timezone,
        visit: formatVisitDuration(visitor.joinedAt)
      };
      const labelSpacing = "\u00a0\u00a0\u00a0";
      const fontSize = resolvedCssLength("--fs-h3");
      const lineHeight = fontSize * 1.35;
      const rows = [`enhet:${labelSpacing}${info.device}`, `tidszon:${labelSpacing}${info.timezone}`, `varit här:${labelSpacing}${info.visit}`];
      const startY = visitorCircleDiameter / 2 - (lineHeight * rows.length) / 2 + fontSize * .78;
      details.setAttribute("transform", `translate(${visitorCircleTextPadding}, ${startY})`);
      details.replaceChildren(...rows.map((row, index) => {
        const text = document.createElementNS(SVG_NAMESPACE, "text");
        text.setAttribute("x", "0");
        text.setAttribute("y", String(index * lineHeight));
        text.setAttribute("font-family", "PPPangram Sans Rounded Compact, sans-serif");
        text.setAttribute("font-size", String(fontSize));
        text.setAttribute("font-weight", "400");
        text.setAttribute("letter-spacing", "-.045em");
        text.textContent = row;
        return text;
      }));
    }

    placeOwnCircle();
    registerSession();
    userRef.onDisconnect().remove();

    document.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest("a") || !isInsideWindowControl(event.clientX, event.clientY)) return;
      cancelWindowAnimation();
      finishIntroReveal();
      dragging = true;
      document.body.classList.add("is-dragging-window");
      dragPointerId = event.pointerId;
      dragStartedAt = { x: event.clientX, y: event.clientY };
      const rect = circle.getBoundingClientRect();
      pointerOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      circle.classList.add("is-dragging");
      startDragAutoScroll();
      event.preventDefault();
    }, true);

    document.addEventListener("pointermove", event => {
      if (!dragging || event.pointerId !== dragPointerId) return;
      position = {
        x: (event.clientX - pointerOffset.x) / travelDistance(window.innerWidth, circleWidth),
        y: (event.clientY - pointerOffset.y) / travelDistance(window.innerHeight, circleHeight)
      };
      placeOwnCircle();
      if (Date.now() - lastWrite > 75) {
        lastWrite = Date.now();
        writePosition();
      }
      // Safari can otherwise treat this gesture as a normal page scroll.
      event.preventDefault();
    }, { passive: false });

    const endDrag = event => {
      if (!dragging || event.pointerId !== dragPointerId) return;
      dragging = false;
      stopDragAutoScroll();
      dragPointerId = null;
      document.body.classList.remove("is-dragging-window");
      circle.classList.remove("is-dragging");
      suppressVeilClick = Math.hypot(event.clientX - dragStartedAt.x, event.clientY - dragStartedAt.y) > 3;
      dragStartedAt = null;
      writePosition();
    };
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    // Legacy iOS Safari may dispatch a touch scroll before its pointer-event
    // counterpart. Prevent it only while the window is actively held.
    document.addEventListener("touchmove", event => {
      if (dragging) event.preventDefault();
    }, { passive: false });
    window.addEventListener("blur", stopDragAutoScroll);
    document.addEventListener("pointermove", event => {
      const overLink = Boolean(event.target.closest("a"));
      document.body.classList.toggle("is-over-window", !dragging && !overLink && isInsideWindowControl(event.clientX, event.clientY));
    });
    document.addEventListener("click", event => {
      if (suppressVeilClick) {
        suppressVeilClick = false;
        return;
      }
      if (event.target.closest("a") || !isVeilAtPoint(event.clientX, event.clientY)) return;
      event.preventDefault();
      moveWindowTo(event.clientX, event.clientY);
    }, true);
    window.addEventListener("resize", () => {
      refreshCircleDimensions();
      visitorCircleDiameter = resolvedCssLength("--visitor-circle-diameter");
      visitorCircleTextPadding = resolvedCssLength("--visitor-circle-text-padding");
      dragScrollZone = resolvedCssLength("--window-scroll-zone");
      dragScrollMaxSpeed = resolvedCssLength("--window-scroll-max-speed");
      if (!revealStarted) position = centeredPosition();
      windowMaskSettings = readWindowMaskSettings();
      applyWindowMaskSettings();
      updateDiscoveryViewport();
      placeOwnCircle();
      otherCircles.forEach(({ element, position: otherPosition, visitor }) => {
        placeVisitorCircle(element, otherPosition, visitor);
        updateVisitorDetails(element, visitor);
      });
      // A resize changes the viewport-relative shared centre. Send only once
      // after resizing has settled, rather than writing for every resize event.
      clearTimeout(resizePositionWriteTimer);
      resizePositionWriteTimer = setTimeout(writePosition, 150);
    });

    const addOrUpdateOther = snapshot => {
      if (snapshot.key === userId || !snapshot.val()) return;
      const raw = snapshot.val();
      // Records from the earlier pixel-circle prototype have no session marker.
      // Ignoring them prevents abandoned old tabs/reloads from appearing as visitors.
      if (raw.activeSession !== true) return;
      if (!Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) return;
      const otherPosition = {
        x: Math.min(1, Math.max(0, Number(raw.x))),
        y: Math.min(1, Math.max(0, Number(raw.y)))
      };
      const visitor = {
        position: otherPosition,
        viewportX: raw.viewportX,
        viewportY: raw.viewportY,
        joinedAt: raw.joinedAt,
        device: raw.device,
        timezone: raw.timezone
      };
      let other = otherCircles.get(snapshot.key);
      if (!other) {
        const element = createVisitorCircle(snapshot.key, visitor);
        other = { element, position: otherPosition, visitor };
        otherCircles.set(snapshot.key, other);
      }
      other.position = otherPosition;
      other.visitor = visitor;
      placeVisitorCircle(other.element, otherPosition, visitor);
      updateVisitorDetails(other.element, visitor);
    };
    circlesRef.on("child_added", addOrUpdateOther);
    circlesRef.on("child_changed", addOrUpdateOther);
    circlesRef.on("child_removed", snapshot => {
      const other = otherCircles.get(snapshot.key);
      if (other) other.element.remove();
      otherCircles.delete(snapshot.key);
    });

    window.setInterval(() => {
      otherCircles.forEach(other => updateVisitorDetails(other.element, other.visitor));
    }, 1000);

  }

  initializeCircles();
  Promise.all([loadInfo(), loadBlog()]).finally(() => {
    resetInitialScroll();
    startWindowReveal();
  });
})();
