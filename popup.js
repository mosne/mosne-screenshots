document.addEventListener('DOMContentLoaded', async () => {
  const previewImg = document.getElementById('screenshot-preview');
  const loadingDiv = document.getElementById('loading');
  const statusText = document.querySelector('.status-text');
  const filenameInput = document.getElementById('filename-input');
  const downloadBtn = document.getElementById('download-btn');

  let croppedWebpUrl = null;
  let finalFilename = 'screenshot';

  try {
    // 1. Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found.');
    }

    // 2. Generate and sanitize filename
    finalFilename = generateFilename(tab.url, tab.title);
    filenameInput.value = finalFilename;

    // Guard against internal chrome:// pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('view-source:')) {
      throw new Error('Internal browser pages cannot be captured.');
    }

    // 3. Capture the visible tab (hiding scrollbars first)
    statusText.textContent = 'Capturing page...';
    
    // Hide scrollbars temporarily
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (document.getElementById('screenshot-hide-scrollbar')) return;
          const style = document.createElement('style');
          style.id = 'screenshot-hide-scrollbar';
          style.textContent = `
            ::-webkit-scrollbar { display: none !important; }
            body, html {
              overflow: hidden !important;
            }
          `;
          document.documentElement.appendChild(style);
        }
      });
    } catch (e) {
      console.warn('Could not inject style to hide scrollbar (e.g. on chrome:// pages):', e);
    }

    // Wait a brief frame for style layout to apply
    await new Promise(r => setTimeout(r, 100));

    let rawDataUrl;
    try {
      rawDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    } finally {
      // Restore scrollbars immediately
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const style = document.getElementById('screenshot-hide-scrollbar');
            if (style) style.remove();
          }
        });
      } catch (e) {
        // Ignore errors restoring scrollbar
      }
    }

    // 4. Load into Image and Crop to 16:9 on Canvas
    statusText.textContent = 'Cropping to 16:9...';
    croppedWebpUrl = await cropTo16NineWebp(rawDataUrl);

    // 5. Update UI
    previewImg.src = croppedWebpUrl;
    previewImg.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    downloadBtn.removeAttribute('disabled');

  } catch (error) {
    console.error('Error capturing screenshot:', error);
    loadingDiv.innerHTML = `
      <div class="error-icon" style="color: #ef4444; font-size: 2rem; margin-bottom: 8px;">⚠️</div>
      <p class="status-text" style="color: #f8fafc; font-weight: 500; text-align: center; padding: 0 10px;">
        ${error.message || 'Failed to capture screenshot'}
      </p>
    `;
  }

  // 6. Handle Download
  downloadBtn.addEventListener('click', async () => {
    if (!croppedWebpUrl) return;

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Saving...';

    try {
      await chrome.downloads.download({
        url: croppedWebpUrl,
        filename: `${finalFilename}.webp`,
        saveAs: true
      });
      
      // Success feedback micro-animation/state
      downloadBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Saved!
      `;
      setTimeout(() => {
        downloadBtn.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Save WebP Image
        `;
        downloadBtn.removeAttribute('disabled');
      }, 2000);
    } catch (err) {
      console.error('Download failed:', err);
      downloadBtn.textContent = 'Failed to Save';
      setTimeout(() => {
        downloadBtn.textContent = 'Save WebP Image';
        downloadBtn.removeAttribute('disabled');
      }, 2000);
    }
  });
});

/**
 * Sanitizes URL host and Page Title into a format: {domain}_{title}
 * Max 30 characters total.
 */
function generateFilename(urlString, pageTitle) {
  let domain = 'unknown';
  try {
    const url = new URL(urlString);
    domain = url.hostname;
  } catch (e) {
    // If invalid URL, fallback to parsing manually or use raw string
  }

  // Sanitize Domain: remove www., keep alphanumeric/hyphens, convert others to hyphens
  let sanitizedDomain = domain
    .replace(/^www\./i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!sanitizedDomain) {
    sanitizedDomain = 'domain';
  }

  // Sanitize Title: keep alphanumeric and spaces/hyphens, convert spaces/underscores to hyphens
  let sanitizedTitle = (pageTitle || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '') // strip punctuation
    .replace(/[\s_-]+/g, '-')      // unify whitespace/underscores to single hyphens
    .replace(/-+/g, '-')           // collapse hyphens
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens

  if (!sanitizedTitle) {
    sanitizedTitle = 'home';
  }

  // Construct combined name: {domain}_{title}
  let combined = `${sanitizedDomain}_${sanitizedTitle}`;

  // Limit to exactly 30 characters
  if (combined.length > 30) {
    combined = combined.substring(0, 30);
    // Trim trailing underscore or hyphen that might result from cutting mid-word/symbol
    combined = combined.replace(/[_-]+$/, '');
  }

  return combined;
}

/**
 * Crops a data URL image to 16:9 aspect ratio and returns as webp data URL
 */
function cropTo16NineWebp(srcDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const targetRatio = 16 / 9;
        const originalRatio = img.naturalWidth / img.naturalHeight;

        let canvasWidth, canvasHeight;

        if (originalRatio > targetRatio) {
          // Original is wider than 16:9 - crop horizontally from the right (top-left aligned)
          canvasHeight = img.naturalHeight;
          canvasWidth = img.naturalHeight * targetRatio;
        } else {
          // Original is taller than 16:9 - crop vertically from the bottom (top-left aligned)
          canvasWidth = img.naturalWidth;
          canvasHeight = img.naturalWidth / targetRatio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get 2D context for canvas');
        }

        // Draw image cropped starting from top-left (0, 0) without any padding
        ctx.drawImage(
          img,
          0, 0, canvasWidth, canvasHeight, // source rectangle
          0, 0, canvasWidth, canvasHeight  // destination rectangle
        );

        // Convert to WebP format
        const webpUrl = canvas.toDataURL('image/webp', 0.92);
        resolve(webpUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load captured screenshot image source.'));
    };
    img.src = srcDataUrl;
  });
}
