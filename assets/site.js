(() => {
  "use strict";

  const SHEET_BASE = "https://docs.google.com/spreadsheets/d/1St2Nqx9SoFAaOX2Q62aBV69W9RbWx4fRGifG-P_Fh_U/gviz/tq?tqx=out:json&sheet=";
  const INFO_URL = `${SHEET_BASE}info`;
  const BLOG_URL = `${SHEET_BASE}blog`;

  const infoContainer = document.getElementById("info-content");
  const blogContainer = document.getElementById("blog-content");
  const leftPanel = document.getElementById("left");
  const rightPanel = document.getElementById("right");
  const discoveryVeil = document.getElementById("discovery-veil");
  const discoveryWindows = document.getElementById("discovery-windows");
  const lineWindows = document.getElementById("line-windows");
  const veilWindowFilter = document.querySelector("#veil-window-feather feGaussianBlur");
  const lineWindowFilter = document.querySelector("#line-window-feather feGaussianBlur");
  const structureLines = document.getElementById("structure-lines");
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  // Add or remove colors here to control the available visitor-circle palette.
  const VISITOR_COLORS = ["#ed1c24", "#1557ff", "#d62f8d", "#007f62"];
  // Fallbacks used only if a real visitor has not supplied a field.
  const PLACEHOLDER_VISITOR_INFO = {
    device: "Okänd enhet",
    timezone: "Okänd tidszon"
  };
  // PPPangram's glyphs overhang their line box slightly at this tight tracking.
  // Keep a small optical inset so its visible left/right margins match the panel padding.
  const TITLE_OPTICAL_FIT = 0.975;
  let activeTitle = null;
  let titleFitQueued = false;
  let structureLinesQueued = false;

  function addStructureLine(x1, y1, x2, y2) {
    const line = document.createElementNS(SVG_NAMESPACE, "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    structureLines.append(line);
  }

  function renderStructureLines() {
    if (!discoveryVeil || !structureLines) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightBounds = rightPanel.getBoundingClientRect();
    discoveryVeil.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
    structureLines.replaceChildren();

    // The fixed left-column frame.
    addStructureLine(rightBounds.left, 0, rightBounds.left, viewportHeight);
    const title = activeTitle || document.getElementById("site-title");
    const footer = infoContainer.querySelector(".left-footer");
    if (title) {
      const titleBounds = title.getBoundingClientRect();
      addStructureLine(0, titleBounds.bottom, rightBounds.left, titleBounds.bottom);
    }
    if (footer) {
      const footerBounds = footer.getBoundingClientRect();
      addStructureLine(0, footerBounds.top, rightBounds.left, footerBounds.top);
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
        addStructureLine(rightBounds.left, dividerY, viewportWidth, dividerY);
      }

      posts.slice(0, -1).forEach((post, index) => {
        const currentBounds = post.getBoundingClientRect();
        const nextBounds = posts[index + 1].getBoundingClientRect();
        const dividerY = (currentBounds.bottom + nextBounds.top) / 2;
        addStructureLine(rightBounds.left, dividerY, viewportWidth, dividerY);
      });
    });
  }

  function scheduleStructureLines() {
    if (structureLinesQueued) return;
    structureLinesQueued = true;
    requestAnimationFrame(() => {
      structureLinesQueued = false;
      renderStructureLines();
    });
  }

  function fitTitleToPanel() {
    if (!activeTitle || !activeTitle.isConnected) return;

    // Start from the CSS fallback size on every pass, rather than compounding scale changes.
    activeTitle.style.removeProperty("font-size");
    const availableWidth = activeTitle.getBoundingClientRect().width;
    if (!availableWidth) return;
    const baseSize = Number.parseFloat(getComputedStyle(activeTitle).fontSize);
    if (!baseSize) return;

    // A clone lets the browser measure the longest <br>-separated line with the
    // actual font, kerning, and letter-spacing applied.
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
      fontSize: `${baseSize}px`
    });
    document.body.append(measure);
    const textWidth = measure.getBoundingClientRect().width;
    measure.remove();
    if (!textWidth) return;

    activeTitle.style.fontSize = `${baseSize * ((availableWidth * TITLE_OPTICAL_FIT) / textWidth)}px`;
    scheduleStructureLines();
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
    activeTitle = title;
    scheduleTitleFit();
    scheduleStructureLines();
    // The first pass may use the fallback font; fit once more after EB Garamond
    // and the display font have both finished loading.
    document.fonts?.ready.then(scheduleTitleFit);
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
    let position = { x: .5, y: .25 };
    let dragging = false;
    let pointerOffset = { x: 0, y: 0 };
    let lastWrite = 0;

    const clamp = value => Math.min(1, Math.max(0, value));
    const pixelsFor = ({ x, y }, element = circle) => ({
      left: x * Math.max(0, window.innerWidth - element.offsetWidth),
      top: y * Math.max(0, window.innerHeight - element.offsetHeight)
    });
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
      const styles = getComputedStyle(document.documentElement);
      return {
        veilDiameter: resolvedCssLength("--veil-window-diameter"),
        veilBlur: Number.parseFloat(styles.getPropertyValue("--veil-window-blur")),
        lineDiameter: resolvedCssLength("--line-window-diameter"),
        lineBlur: Number.parseFloat(styles.getPropertyValue("--line-window-blur"))
      };
    }

    let windowMaskSettings = readWindowMaskSettings();

    function renderDiscoveryWindows() {
      if (!discoveryVeil || !discoveryWindows || !lineWindows) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const controlRadius = circle.offsetWidth / 2;
      // Only the local circle reveals the site. Visitors are rendered above the
      // veil as outlined information circles instead of additional windows.
      const windowPositions = [position];
      discoveryVeil.setAttribute("viewBox", `0 0 ${width} ${height}`);
      discoveryWindows.replaceChildren();
      lineWindows.replaceChildren();
      veilWindowFilter?.setAttribute("stdDeviation", String(windowMaskSettings.veilBlur));
      lineWindowFilter?.setAttribute("stdDeviation", String(windowMaskSettings.lineBlur));

      windowPositions.forEach(windowPosition => {
        const { left, top } = pixelsFor(windowPosition);
        const centerX = left + controlRadius;
        const centerY = top + controlRadius;
        [[discoveryWindows, windowMaskSettings.veilDiameter / 2], [lineWindows, windowMaskSettings.lineDiameter / 2]]
          .forEach(([target, radius]) => {
            const hole = document.createElementNS(SVG_NAMESPACE, "circle");
            hole.setAttribute("cx", String(centerX));
            hole.setAttribute("cy", String(centerY));
            hole.setAttribute("r", String(radius));
            hole.setAttribute("fill", "black");
            target.append(hole);
          });
      });
    }

    const visitorMetadata = {
      activeSession: true,
      joinedAt,
      device: friendlyDeviceName(),
      timezone: utcOffset()
    };
    const registerSession = () => userRef.update({
      ...position,
      ...visitorMetadata
    }).catch(error => console.error("Could not register visitor", error));
    const writePosition = () => userRef.update({
      x: position.x,
      y: position.y
    }).catch(error => console.error("Could not update circle", error));
    const placeOwnCircle = () => {
      place(circle, position);
      renderDiscoveryWindows();
    };

    const colorForVisitor = id => {
      const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
      return VISITOR_COLORS[hash % VISITOR_COLORS.length];
    };

    function createVisitorCircle(id, visitor) {
      const element = makeElement("div", "shared-circle shared-circle--other");
      element.style.setProperty("--visitor-color", visitor.color || colorForVisitor(id));
      const details = makeElement("div", "visitor-info");
      element.append(details);
      updateVisitorDetails(element, visitor);
      document.body.append(element);
      return element;
    }

    function updateVisitorDetails(element, visitor) {
      const details = element.querySelector(".visitor-info");
      if (!details) return;
      const info = {
        device: visitor.device || PLACEHOLDER_VISITOR_INFO.device,
        timezone: visitor.timezone || PLACEHOLDER_VISITOR_INFO.timezone,
        visit: formatVisitDuration(visitor.joinedAt)
      };
      const labelSpacing = "\u00a0\u00a0\u00a0";
      details.replaceChildren(
        makeElement("div", "visitor-info-row", `enhet:${labelSpacing}${info.device}`),
        makeElement("div", "visitor-info-row", `tidszon:${labelSpacing}${info.timezone}`),
        makeElement("div", "visitor-info-row", `varit här:${labelSpacing}${info.visit}`)
      );
    }

    placeOwnCircle();
    registerSession();
    userRef.onDisconnect().remove();

    circle.addEventListener("pointerdown", event => {
      dragging = true;
      const rect = circle.getBoundingClientRect();
      pointerOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      circle.setPointerCapture(event.pointerId);
      circle.classList.add("is-dragging");
    });

    circle.addEventListener("pointermove", event => {
      if (!dragging) return;
      position = {
        x: clamp((event.clientX - pointerOffset.x) / Math.max(1, window.innerWidth - circle.offsetWidth)),
        y: clamp((event.clientY - pointerOffset.y) / Math.max(1, window.innerHeight - circle.offsetHeight))
      };
      placeOwnCircle();
      if (Date.now() - lastWrite > 75) {
        lastWrite = Date.now();
        writePosition();
      }
    });

    const endDrag = event => {
      if (!dragging) return;
      dragging = false;
      circle.classList.remove("is-dragging");
      if (circle.hasPointerCapture(event.pointerId)) circle.releasePointerCapture(event.pointerId);
      writePosition();
    };
    circle.addEventListener("pointerup", endDrag);
    circle.addEventListener("pointercancel", endDrag);
    window.addEventListener("resize", () => {
      windowMaskSettings = readWindowMaskSettings();
      placeOwnCircle();
      otherCircles.forEach(({ element, position: otherPosition }) => place(element, otherPosition));
      renderDiscoveryWindows();
    });

    const addOrUpdateOther = snapshot => {
      if (snapshot.key === userId || !snapshot.val()) return;
      const raw = snapshot.val();
      // Records from the earlier pixel-circle prototype have no session marker.
      // Ignoring them prevents abandoned old tabs/reloads from appearing as visitors.
      if (raw.activeSession !== true) return;
      if (!Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) return;
      const otherPosition = { x: clamp(Number(raw.x)), y: clamp(Number(raw.y)) };
      const visitor = {
        position: otherPosition,
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
      place(other.element, otherPosition);
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

  loadInfo();
  loadBlog();
  initializeCircles();
})();
