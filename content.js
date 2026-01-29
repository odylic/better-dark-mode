(function() {
  // Prevent multiple injections
  if (window.betterDarkModeLoaded) return;
  window.betterDarkModeLoaded = true;

  // Elements to skip (preserve original appearance)
  const SKIP_TAGS = new Set([
    'IMG', 'VIDEO', 'IFRAME', 'CANVAS', 'PICTURE', 'SVG',
    'EMBED', 'OBJECT', 'SOURCE', 'TRACK'
  ]);

  // Input elements that need special styling
  const INPUT_TAGS = new Set([
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'
  ]);

  // Elements that should always have very bright text (titles, headings, labels, links)
  const BRIGHT_TEXT_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'LEGEND', 'TH', 'STRONG', 'B', 'A'
  ]);

  // Dark mode range (output brightness range for backgrounds)
  // Lower values = more black, less gray
  const DARK_MIN = 10;   // Near black (#0a0a0a)
  const DARK_MAX = 25;   // Still very dark (#191919)
  const INPUT_OFFSET = 10;

  // Text brightness range
  const LIGHT_TEXT_MIN = 235;
  const LIGHT_TEXT_MAX = 255;

  // Saturation threshold - above this, text is considered "colorful"
  const COLORFUL_SATURATION_THRESHOLD = 15;

  // Thresholds
  const BG_BRIGHTNESS_THRESHOLD = 100;
  const TEXT_BRIGHTNESS_THRESHOLD = 200;
  const KEEP_BLACK_THRESHOLD = 30;

  // Track if site has dark theme
  let siteHasDarkTheme = false;

  function getBrightness(r, g, b) {
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
      };
    }
    return null;
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  function transformBackgroundColor(color, isInput = false) {
    const brightness = getBrightness(color.r, color.g, color.b);

    if (brightness <= BG_BRIGHTNESS_THRESHOLD) {
      return null;
    }

    const hsl = rgbToHsl(color.r, color.g, color.b);
    const lightRange = 255 - BG_BRIGHTNESS_THRESHOLD;
    const darkRange = DARK_MAX - DARK_MIN;
    const normalizedBrightness = (brightness - BG_BRIGHTNESS_THRESHOLD) / lightRange;

    let newLightness = DARK_MIN + (1 - normalizedBrightness) * darkRange * 0.5 + normalizedBrightness * darkRange * 0.5;

    if (isInput) {
      newLightness += INPUT_OFFSET;
    }

    const newSaturation = Math.min(hsl.s * 0.3, 20);
    const rgb = hslToRgb(hsl.h, newSaturation, newLightness / 2.55);
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }

  function transformTextColor(color, keepBlack = false) {
    const brightness = getBrightness(color.r, color.g, color.b);

    if (brightness >= TEXT_BRIGHTNESS_THRESHOLD) {
      return null;
    }

    if (keepBlack && brightness < KEEP_BLACK_THRESHOLD) {
      return null;
    }

    const hsl = rgbToHsl(color.r, color.g, color.b);

    if (hsl.s > COLORFUL_SATURATION_THRESHOLD) {
      return null;
    }

    if (brightness < KEEP_BLACK_THRESHOLD) {
      return null;
    }

    const rgb = hslToRgb(hsl.h, 0, LIGHT_TEXT_MAX / 2.55);
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }

  function transformGradient(gradientStr) {
    if (!gradientStr || !gradientStr.includes('gradient')) {
      return null;
    }

    const colorRegex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;
    let transformed = gradientStr;
    let match;
    const replacements = [];

    while ((match = colorRegex.exec(gradientStr)) !== null) {
      const color = {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
      };

      const newColor = transformBackgroundColor(color);
      if (newColor) {
        replacements.push({
          original: match[0],
          replacement: color.a < 1 ? newColor.replace('rgb', 'rgba').replace(')', `, ${color.a})`) : newColor
        });
      }
    }

    for (const rep of replacements.reverse()) {
      transformed = transformed.replace(rep.original, rep.replacement);
    }

    return transformed !== gradientStr ? transformed : null;
  }

  function detectDarkTheme() {
    const bodyBg = parseColor(window.getComputedStyle(document.body).backgroundColor);
    const htmlBg = parseColor(window.getComputedStyle(document.documentElement).backgroundColor);

    const bodyDark = bodyBg && getBrightness(bodyBg.r, bodyBg.g, bodyBg.b) < 50;
    const htmlDark = htmlBg && getBrightness(htmlBg.r, htmlBg.g, htmlBg.b) < 50;

    return bodyDark || htmlDark;
  }

  function applyDarkMode(element) {
    if (SKIP_TAGS.has(element.tagName)) {
      return;
    }

    const computed = window.getComputedStyle(element);
    const isInput = INPUT_TAGS.has(element.tagName);
    const needsBrightText = BRIGHT_TEXT_TAGS.has(element.tagName);

    // Handle gradients (only on light sites)
    if (!siteHasDarkTheme) {
      const bgImage = computed.backgroundImage;
      if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
        const transformedGradient = transformGradient(bgImage);
        if (transformedGradient) {
          element.style.setProperty('background-image', transformedGradient, 'important');
        }
      }
    }

    // Handle background color
    const bgColor = parseColor(computed.backgroundColor);

    if (!siteHasDarkTheme && bgColor) {
      const transformedBg = transformBackgroundColor(bgColor, isInput);
      if (transformedBg) {
        element.style.setProperty('background-color', transformedBg, 'important');
      }

      if (isInput) {
        element.style.setProperty('border-color', '#888', 'important');
      }
    } else if (!siteHasDarkTheme && isInput) {
      element.style.setProperty('background-color', `rgb(${DARK_MIN + INPUT_OFFSET + 10}, ${DARK_MIN + INPUT_OFFSET + 10}, ${DARK_MIN + INPUT_OFFSET + 10})`, 'important');
      element.style.setProperty('border-color', '#888', 'important');
    }

    // Handle text color
    const elementHasDarkBg = bgColor && getBrightness(bgColor.r, bgColor.g, bgColor.b) <= BG_BRIGHTNESS_THRESHOLD;
    const onDarkBackground = siteHasDarkTheme || elementHasDarkBg;

    const textColor = parseColor(computed.color);
    if (textColor) {
      const textBrightness = getBrightness(textColor.r, textColor.g, textColor.b);
      const textHsl = rgbToHsl(textColor.r, textColor.g, textColor.b);
      const isColorfulText = textHsl.s > COLORFUL_SATURATION_THRESHOLD;

      if (isColorfulText) {
        // Keep colorful text as-is
      } else if (onDarkBackground && textBrightness < KEEP_BLACK_THRESHOLD) {
        // Keep black text black on dark backgrounds
      } else if (!siteHasDarkTheme) {
        if ((isInput || needsBrightText) && textBrightness < 200) {
          element.style.setProperty('color', '#fff', 'important');
        } else if (textBrightness >= KEEP_BLACK_THRESHOLD && textBrightness < TEXT_BRIGHTNESS_THRESHOLD) {
          element.style.setProperty('color', '#fff', 'important');
        }
      }
    } else if ((isInput || needsBrightText) && !siteHasDarkTheme) {
      element.style.setProperty('color', '#fff', 'important');
    }

    // Handle borders (only on light sites)
    if (!siteHasDarkTheme) {
      const borderColor = parseColor(computed.borderColor);
      if (borderColor && !isInput) {
        const borderBrightness = getBrightness(borderColor.r, borderColor.g, borderColor.b);
        if (borderBrightness > 150) {
          const hsl = rgbToHsl(borderColor.r, borderColor.g, borderColor.b);
          const rgb = hslToRgb(hsl.h, Math.min(hsl.s * 0.3, 15), 30);
          element.style.setProperty('border-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, 'important');
        }
      }
    }

    // Handle SVG fills (only on light sites)
    if (!siteHasDarkTheme && (element.tagName === 'PATH' || element.tagName === 'RECT' ||
        element.tagName === 'CIRCLE' || element.tagName === 'POLYGON' ||
        element.tagName === 'LINE' || element.tagName === 'POLYLINE')) {

      const computedFill = computed.fill;
      if (computedFill && computedFill !== 'none') {
        const fillColor = parseColor(computedFill);
        if (fillColor) {
          const brightness = getBrightness(fillColor.r, fillColor.g, fillColor.b);
          const hsl = rgbToHsl(fillColor.r, fillColor.g, fillColor.b);

          // Transform dark fills (including black) to light for visibility
          if (brightness < 150 && hsl.s <= COLORFUL_SATURATION_THRESHOLD) {
            element.style.setProperty('fill', '#e0e0e0', 'important');
          }
        }
      }

      const computedStroke = computed.stroke;
      if (computedStroke && computedStroke !== 'none') {
        const strokeColor = parseColor(computedStroke);
        if (strokeColor) {
          const brightness = getBrightness(strokeColor.r, strokeColor.g, strokeColor.b);
          const hsl = rgbToHsl(strokeColor.r, strokeColor.g, strokeColor.b);

          // Transform dark strokes (including black) to light for visibility
          if (brightness < 150 && hsl.s <= COLORFUL_SATURATION_THRESHOLD) {
            element.style.setProperty('stroke', '#e0e0e0', 'important');
          }
        }
      }
    }
  }

  const originalStyles = new WeakMap();

  function saveOriginalStyle(element) {
    if (!originalStyles.has(element)) {
      originalStyles.set(element, {
        backgroundColor: element.style.backgroundColor,
        backgroundImage: element.style.backgroundImage,
        color: element.style.color,
        borderColor: element.style.borderColor,
        fill: element.style.fill
      });
    }
  }

  function restoreOriginalStyle(element) {
    const original = originalStyles.get(element);
    if (original) {
      element.style.backgroundColor = original.backgroundColor;
      element.style.backgroundImage = original.backgroundImage;
      element.style.color = original.color;
      element.style.borderColor = original.borderColor;
      element.style.fill = original.fill;
      originalStyles.delete(element);
    }
  }

  function enableDarkMode() {
    document.documentElement.classList.add('better-dark-mode-enabled');

    siteHasDarkTheme = detectDarkTheme();

    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      saveOriginalStyle(el);
      applyDarkMode(el);
    });

    if (!siteHasDarkTheme) {
      saveOriginalStyle(document.body);
      saveOriginalStyle(document.documentElement);

      const bodyBg = parseColor(window.getComputedStyle(document.body).backgroundColor);
      if (!bodyBg || getBrightness(bodyBg.r, bodyBg.g, bodyBg.b) > BG_BRIGHTNESS_THRESHOLD) {
        document.body.style.setProperty('background-color', '#000', 'important');
      }
      const htmlBg = parseColor(window.getComputedStyle(document.documentElement).backgroundColor);
      if (!htmlBg || getBrightness(htmlBg.r, htmlBg.g, htmlBg.b) > BG_BRIGHTNESS_THRESHOLD) {
        document.documentElement.style.setProperty('background-color', '#000', 'important');
      }
    }
  }

  function disableDarkMode() {
    document.documentElement.classList.remove('better-dark-mode-enabled');

    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      restoreOriginalStyle(el);
    });

    restoreOriginalStyle(document.body);
    restoreOriginalStyle(document.documentElement);
  }

  let observer = null;

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      if (!document.documentElement.classList.contains('better-dark-mode-enabled')) {
        return;
      }

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            saveOriginalStyle(node);
            applyDarkMode(node);
            node.querySelectorAll?.('*').forEach(child => {
              saveOriginalStyle(child);
              applyDarkMode(child);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Store functions globally
  window.betterDarkModeEnable = enableDarkMode;
  window.betterDarkModeDisable = disableDarkMode;
  window.betterDarkModeStartObserver = startObserver;
  window.betterDarkModeStopObserver = stopObserver;

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleDarkMode') {
      if (message.enabled) {
        enableDarkMode();
        startObserver();
      } else {
        disableDarkMode();
        stopObserver();
      }
    }
  });
})();
