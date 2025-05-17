/**
 * @fileoverview SVG sprite management system
 */

// Core constants
const SVG = {
  NS: "http://www.w3.org/2000/svg",
  THEMES: { LIGHT: "light", DARK: "dark" },
  SHAPES: new Set(["path", "circle", "rect", "polygon", "line", "polyline"]),
  STYLE: "position:absolute;width:0;height:0;overflow:hidden;display:none;",
};

// Create SVG element
const createSvgElement = (() => {
  return (tag, attrs = {}) => {
    const el = document.createElementNS(SVG.NS, tag);
    // Faster than forEach for small objects
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
    return el;
  };
})();

class SvgSpriteManager {
  constructor(opts = {}) {
    // Init state with destructuring for defaults
    const {
      svgData = {},
      isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches,
    } = opts;

    this.dark = isDarkMode;
    this.data = svgData;

    // Use WeakMaps to allow garbage collection when symbols are no longer referenced
    this.symbols = {
      [SVG.THEMES.LIGHT]: new Map(),
      [SVG.THEMES.DARK]: new Map(),
    };

    this.sprites = {
      [SVG.THEMES.LIGHT]: null,
      [SVG.THEMES.DARK]: null,
    };

    // Set up container - only once, moved outside event flow
    this.initContainer();

    // Process SVGs once during initialization
    this.processSvgData(this.data);

    // Build sprite system once
    this.buildSpriteSystem();

    // Apply initial theme
    this.applyTheme(this.dark ? SVG.THEMES.DARK : SVG.THEMES.LIGHT);

    // Set up event listeners (delegated where possible)
    this.initEventListeners();
  }

  initContainer() {
    this.container = document.getElementById("svg-sprite-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "svg-sprite-container";
      document.body.appendChild(this.container);
    }
  }

  initEventListeners() {
    // Use passive event listeners where applicable
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );
    darkModeMediaQuery.addEventListener(
      "change",
      (e) => this.handleThemeChange(e.matches),
      { passive: true }
    );

    // Use event delegation and passive listener
    document.addEventListener(
      "themeChange",
      (e) => {
        if (
          typeof e.detail?.isDark === "boolean" &&
          e.detail.source !== "svgSpriteManager"
        ) {
          this.handleThemeChange(e.detail.isDark);
        }
      },
      { passive: true }
    );
  }

  handleThemeChange(isDark) {
    if (this.dark === isDark) return; // Early return if no change

    this.dark = isDark;
    const theme = isDark ? SVG.THEMES.DARK : SVG.THEMES.LIGHT;
    this.applyTheme(theme);

    // Use CustomEvent constructor instead of new CustomEvent
    const event = new CustomEvent("themeChange", {
      detail: { isDark, source: "svgSpriteManager" },
    });
    document.dispatchEvent(event);
  }

  applyTheme(theme) {
    // Use direct property access instead of iteration
    if (this.sprites[SVG.THEMES.LIGHT]) {
      this.sprites[SVG.THEMES.LIGHT].style.display =
        theme === SVG.THEMES.LIGHT ? "block" : "none";
    }

    if (this.sprites[SVG.THEMES.DARK]) {
      this.sprites[SVG.THEMES.DARK].style.display =
        theme === SVG.THEMES.DARK ? "block" : "none";
    }
  }

  addSvgs(newSvgs) {
    if (!newSvgs || Object.keys(newSvgs).length === 0) return;

    // Update data store
    this.data = { ...this.data, ...newSvgs };

    // Process only new SVGs
    this.processSvgData(newSvgs);

    // Rebuild sprites efficiently
    this.buildSpriteSystem();

    // Reapply current theme
    this.applyTheme(this.dark ? SVG.THEMES.DARK : SVG.THEMES.LIGHT);
  }

  processSvgData(svgData) {
    // Use regex for faster file name extraction once
    const fileNameRegex = /([^\\/]{1,255})\.svg$/;
    const themeRegex = /-(light|dark)$/;

    // Pre-calculate keys outside loop
    const keys = Object.keys(this.data);

    // Batch SVG processing
    for (const [path, content] of Object.entries(svgData)) {
      try {
        const fileNameMatch = RegExp(fileNameRegex).exec(path);
        if (!fileNameMatch) continue;

        const fileName = fileNameMatch[1];
        const themeMatch = RegExp(themeRegex).exec(fileName);

        const base = themeMatch ? fileName.replace(themeRegex, "") : fileName;
        const isLight = themeMatch && themeMatch[1] === "light";
        const isDark = themeMatch && themeMatch[1] === "dark";

        // Use cached lookups for better performance
        const baseLight = `${base}-light.svg`;
        const baseDark = `${base}-dark.svg`;

        const hasLight = keys.some((p) => p.includes(baseLight));
        const hasDark = keys.some((p) => p.includes(baseDark));

        // Process for light theme
        if (isLight || (!isLight && !isDark && !hasDark)) {
          this.processSymbol(content, base, SVG.THEMES.LIGHT);
        }

        // Process for dark theme
        if (isDark || (!isLight && !isDark && !hasLight)) {
          this.processSymbol(content, base, SVG.THEMES.DARK);
        }
      } catch (error) {
        console.error(`Error processing SVG ${path}:`, error);
      }
    }
  }

  processSymbol(content, name, theme) {
    try {
      // Parse SVG efficiently
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "image/svg+xml");
      const svg = doc.querySelector("svg");

      if (!svg) return;

      // Extract dimensions once
      const viewBox = svg.getAttribute("viewBox");
      const width = svg.getAttribute("width") || "24";
      const height = svg.getAttribute("height") || "24";

      const symbol = createSvgElement("symbol", {
        id: `icon-${name}`,
        viewBox: viewBox || `0 0 ${width} ${height}`,
        "data-icon-name": name,
        "data-theme": theme,
        class: `themed-icon${
          name === "sun" || name === "moon" ? ` theme-icon-${name}` : ""
        }`,
      });

      // Use DocumentFragment for batch DOM operations
      const fragment = document.createDocumentFragment();

      // Process child nodes more efficiently
      this.processChildNodes(svg, fragment);

      symbol.appendChild(fragment);
      this.symbols[theme].set(symbol.id, symbol);
    } catch (error) {
      console.error(`Failed to process SVG symbol: ${name}`, error);
    }
  }

  processChildNodes(parentNode, targetParent) {
    // Process all children in one pass
    const childNodes = parentNode.childNodes;
    const length = childNodes.length;

    for (let i = 0; i < length; i++) {
      const node = childNodes[i];

      if (node.nodeType !== 1) {
        // Text nodes and others - direct clone
        targetParent.appendChild(node.cloneNode(true));
        continue;
      }

      // Element node processing
      const isShape = SVG.SHAPES.has(node.tagName);
      const attrs = {};

      // Set attributes optimally
      if (isShape && !node.hasAttribute("stroke")) {
        attrs.stroke = "none";
      }

      // Handle color attributes efficiently
      if (node.hasAttribute("stroke")) {
        attrs.stroke =
          node.getAttribute("stroke") === "none" ? "none" : "currentColor";
      }

      if (node.hasAttribute("fill")) {
        attrs.fill =
          node.getAttribute("fill") === "none" ? "none" : "currentColor";
      } else {
        attrs.fill = "none";
      }

      // Copy remaining attributes
      for (const attr of node.attributes) {
        if (attr.name !== "stroke" && attr.name !== "fill") {
          attrs[attr.name] = attr.value;
        }
      }

      // Create element with all attributes at once
      const clone = createSvgElement(node.tagName, attrs);

      // Process children recursively
      if (node.hasChildNodes()) {
        this.processChildNodes(node, clone);
      }

      targetParent.appendChild(clone);
    }
  }

  buildSpriteSystem() {
    const themes = [SVG.THEMES.LIGHT, SVG.THEMES.DARK];

    // Create document fragments for batch DOM operations
    const fragments = {
      [SVG.THEMES.LIGHT]: document.createDocumentFragment(),
      [SVG.THEMES.DARK]: document.createDocumentFragment(),
    };

    // Process each theme
    for (const theme of themes) {
      // Remove existing sprite first to avoid memory leaks
      if (this.sprites[theme]) {
        this.sprites[theme].remove();
      }

      // Create sprite container
      const svg = createSvgElement("svg", {
        id: `svg-sprite-${theme}`,
        "aria-hidden": "true",
        "data-theme": theme,
      });
      svg.style.cssText = SVG.STYLE;

      // Build fragment first to minimize DOM operations
      const fragment = fragments[theme];
      for (const symbol of this.symbols[theme].values()) {
        fragment.appendChild(symbol.cloneNode(true));
      }

      // Append all symbols at once
      svg.appendChild(fragment);

      // Add to DOM and cache reference
      this.container.appendChild(svg);
      this.sprites[theme] = svg;
    }
  }

  toggleTheme() {
    const newDark = !this.dark;
    this.handleThemeChange(newDark);
    return newDark;
  }

  isDark() {
    return this.dark;
  }

  setTheme(isDark) {
    if (typeof isDark === "boolean" && isDark !== this.dark) {
      this.handleThemeChange(isDark);
    }
    return this.dark;
  }
}

// Export globally
window.SvgSpriteManager = SvgSpriteManager;
