/**
 * @fileoverview SVG sprite management system
 */

// Core constants
const SVG_NS = "http://www.w3.org/2000/svg";
const T = { L: "light", D: "dark" };
const SHAPES = ["path", "circle", "rect", "polygon", "line", "polyline"];
const STYLE =
  "position:absolute;width:0;height:0;overflow:hidden;display:none;";

// Create SVG element helper
const create = (tag, attrs = {}, style = "") => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (style) el.style.cssText = style;
  return el;
};

class SvgSpriteManager {
  constructor(opts = {}) {
    // Init state
    this.dark =
      opts.isDarkMode ??
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.data = opts.svgData || {};
    this.sym = { [T.L]: new Map(), [T.D]: new Map() };
    this.els = { [T.L]: null, [T.D]: null };

    // Setup container
    this.container =
      document.getElementById("svg-sprite-container") ||
      document.body.appendChild(create("div", { id: "svg-sprite-container" }));

    // Init sprites
    this.parse(this.data);
    this.createSprites();
    this.setThemeDisplay(this.dark ? T.D : T.L);

    // Setup listeners
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => this.handleTheme(e.matches));

    document.addEventListener("themeChange", (e) => {
      if (typeof e.detail?.isDark === "boolean" && !this._internal) {
        this.handleTheme(e.detail.isDark);
      }
    });
  }

  handleTheme(isDark) {
    this.dark = isDark;
    this.setThemeDisplay(isDark ? T.D : T.L);

    if (!this._internal) {
      document.dispatchEvent(
        new CustomEvent("themeChange", {
          detail: { isDark, source: "svgSpriteManager" },
        })
      );
    }
  }

  setThemeDisplay(theme) {
    Object.entries(this.els).forEach(([t, el]) => {
      if (el) el.style.display = t === theme ? "block" : "none";
    });
  }

  addSvgs(newSvgs) {
    if (!Object.keys(newSvgs).length) return;
    this.data = { ...this.data, ...newSvgs };
    this.parse(newSvgs);
    this.createSprites();
    this.setThemeDisplay(this.dark ? T.D : T.L);
  }

  parse(svgData) {
    const keys = Object.keys(this.data);

    Object.entries(svgData).forEach(([path, content]) => {
      try {
        const fileName = path.split("/").pop().replace(".svg", "");
        const base = fileName.replace(/-light$|-dark$/, "");
        const isLight = fileName.endsWith("-light");
        const isDark = fileName.endsWith("-dark");

        const hasLight = keys.some((p) => p.includes(`${base}-light.svg`));
        const hasDark = keys.some((p) => p.includes(`${base}-dark.svg`));

        if (isLight || (!isLight && !isDark && !hasDark)) {
          this.cacheSymbol(content, base, T.L);
        }
        if (isDark || (!isLight && !isDark && !hasLight)) {
          this.cacheSymbol(content, base, T.D);
        }
      } catch (err) {
        console.error(`Error parsing SVG ${path}:`, err);
      }
    });
  }

  cacheSymbol(content, name, theme) {
    try {
      const svg = new DOMParser()
        .parseFromString(content, "image/svg+xml")
        .querySelector("svg");
      if (!svg) return;

      const symbol = create("symbol", {
        id: `icon-${name}`,
        viewBox:
          svg.getAttribute("viewBox") ||
          `0 0 ${svg.getAttribute("width") || 24} ${
            svg.getAttribute("height") || 24
          }`,
        "data-icon-name": name,
        "data-theme": theme,
        class: `themed-icon${
          name === "sun" || name === "moon" ? ` theme-icon-${name}` : ""
        }`,
      });

      Array.from(svg.childNodes).forEach((node) =>
        symbol.appendChild(this.processNode(node))
      );
      this.sym[theme].set(symbol.id, symbol.cloneNode(true));
    } catch (err) {
      console.error(`Failed to cache SVG: ${name}`, err);
    }
  }

  processNode(node) {
    if (node.nodeType !== 1) return node.cloneNode(true);

    const clone = node.cloneNode(false);

    // Handle shapes
    if (SHAPES.includes(node.tagName) && !node.hasAttribute("stroke")) {
      clone.setAttribute("stroke", "none");
    }

    // Convert colors to theme variables
    ["stroke", "fill"].forEach((attr) => {
      if (node.hasAttribute(attr)) {
        clone.setAttribute(
          attr,
          node.getAttribute(attr) === "none" ? "none" : "currentColor"
        );
      } else if (attr === "fill") {
        clone.setAttribute("fill", "none");
      }
    });

    // Process children
    Array.from(node.childNodes).forEach((child) =>
      clone.appendChild(this.processNode(child))
    );
    return clone;
  }

  createSprites() {
    [T.L, T.D].forEach((theme) => {
      // Remove existing sprite
      if (this.els[theme]) this.els[theme].remove();

      // Create sprite
      const svg = create(
        "svg",
        {
          id: `svg-sprite-${theme}`,
          "aria-hidden": "true",
          "data-theme": theme,
        },
        STYLE
      );

      // Add all symbols
      this.sym[theme].forEach((symbol) =>
        svg.appendChild(symbol.cloneNode(true))
      );

      // Add to DOM and cache
      this.container.appendChild(svg);
      this.els[theme] = svg;
    });
  }

  // Public API
  toggleTheme() {
    this._internal = true;
    const newDark = !this.dark;
    this.handleTheme(newDark);
    setTimeout(() => {
      this._internal = false;
    }, 0);
    return newDark;
  }

  isDark() {
    return this.dark;
  }

  setTheme(isDark) {
    if (typeof isDark === "boolean" && isDark !== this.dark) {
      this.handleTheme(isDark);
    }
    return this.dark;
  }
}

window.SvgSpriteManager = SvgSpriteManager;
