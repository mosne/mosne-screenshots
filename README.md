# 16:9 WebP Screenshotter - Chrome Extension

A Manifest V3 Google Chrome extension that allows you to instantly capture the visible area of the current tab, crop it to a perfect 16:9 aspect ratio from the top-left corner, and save it in the modern WebP format with a sanitized filename.

## Key Features

- **Top-Left 16:9 Aspect Crop**: Dynamically crops the screenshot to a 16:9 aspect ratio starting from the top-left `(0,0)` of the visible area. 
  - If the page is taller than 16:9, it crops off the excess bottom.
  - If the page is wider than 16:9, it crops off the excess right side.
  - No white space or padding is ever added.
- **Automatic Scrollbar Hiding**: Injects a temporary stylesheet to completely hide scrollbars during the screenshot capture, ensuring clean edges without scrollbar tracks or thumbs. The scrollbars are restored immediately after capture.
- **Sanitized Filename Generation**: Automatically builds a file name matching the format `{domain}_{title}`.
  - Cleans up and removes prefixing `www.` from the host name.
  - Standardizes the page title by stripping punctuation and replacing spaces/underscores with hyphens.
  - Truncates to a maximum of 30 characters and trims any trailing separators.
- **Modern Glassmorphic UI**: Includes a beautiful popup preview of the cropped screenshot, visual loading states, and a downloadable WebP link with success animations.

---

## File Structure

```
mosne-screeshots/
├── manifest.json   # Chrome extension configuration (Manifest V3)
├── popup.html      # Structure of the extension popup
├── popup.css       # Deep glassmorphism styles (dark mode, HSL gradients, Outfit font)
├── popup.js        # Core logic: injection, tab capture, crop, sanitize, & download
└── README.md       # Project documentation (this file)
```

---

## Installation & Setup

1. **Download/Clone** this repository to your local machine.
2. Open **Google Chrome** and navigate to `chrome://extensions/`.
3. In the top-right corner, toggle the **Developer mode** switch to **ON**.
4. Click the **Load unpacked** button in the top-left.
5. Select the `mosne-screeshots` folder containing the extension files.
6. The extension is now loaded! Pin it to your toolbar for easy access.

---

## How It Works Under the Hood

1. **Tab Query**: When you click the extension popup, `popup.js` queries the active browser tab.
2. **Scrollbar Hiding**: It injects CSS rules to set `overflow: hidden !important` on `body` and `html`, as well as `display: none` on `::-webkit-scrollbar`.
3. **Capture**: Uses the `chrome.tabs.captureVisibleTab` API to capture the viewport as a high-quality PNG.
4. **Scrollbar Restoration**: Immediately removes the injected styles, returning scrollbars to the page.
5. **Crop & Export**: Loads the captured image into an offscreen HTML canvas, clips it from `(0, 0)` to the calculated 16:9 boundaries, and converts it to a WebP data URL with 92% quality.
6. **Download**: Triggers Chrome's download API to prompt or save the resulting image under the sanitized filename.
