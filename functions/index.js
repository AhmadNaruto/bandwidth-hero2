// index.js - VERSI LENGKAP & BENAR
const pick = require("./pick");
const fetch = require("node-fetch");
const shouldCompress = require("./shouldCompress");
const compress = require("./compress");

// Konstanta Global
const DEFAULT_QUALITY = 70;
const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB

// Header No-Cache untuk memastikan real-time
const NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
};

// --- DEFINISI HANDLER UTAMA (HARUS MENGGUNAKAN ASYNC) ---
exports.handler = async (event) => {
  const handlerStartTime = process.hrtime(); 

  const { url } = event.queryStringParameters || {};
  const { jpeg, bw, l } = event.queryStringParameters || {};

  // Log 1: REQUEST START
  console.log("--- START REQUEST ---", {
    url, 
    ip: event.headers["x-forwarded-for"] || event.ip,
    userAgent: event.headers["user-agent"]
  });

  if (!url) {
    return { statusCode: 200, body: "bandwidth-hero-proxy" };
  }

  let imageUrl = url;
  try {
    imageUrl = JSON.parse(imageUrl);
  } catch (parseError) {
    console.info("URL parsing failed, using original string.");
  }

  if (Array.isArray(imageUrl)) {
    imageUrl = imageUrl.join("&url=");
  }
  imageUrl = imageUrl.replace(/http:\/\/1\.1\.\d\.\d\/bmi\/(https?:\/\/)?/i, "http://");

  const useWebp = !jpeg;
  const grayscale = !!bw && bw !== '0';
  const quality = parseInt(l, 10) || DEFAULT_QUALITY;
  const validQuality = Math.min(100, Math.max(0, quality));

  // Log 2: PARAMETER INPUT
  console.log("-> PARAMS", {
    targetURL: imageUrl,
    outputFormat: useWebp ? 'webp' : 'jpeg',
    grayscale,
    quality: validQuality
  });

  try {
    // --- PENGGUNAAN AWAIT PERTAMA (FETCH) AMAN KARENA DI DALAM ASYNC HANDLER ---
    const response = await fetch(imageUrl, {
      headers: {
        ...pick(event.headers, [
          "cookie", "dnt", "referer", "user-agent", "accept", 
          "accept-language", "accept-encoding"
        ]),
        "x-forwarded-for": event.headers["x-forwarded-for"] || event.ip,
      },
      timeout: 30000,
    });

    if (!response.ok) {
      console.error(`-> FETCH FAILED: ${imageUrl}`, {
        status: response.status, 
        statusText: response.statusText
      });
      return {
        statusCode: response.status || 500,
        body: `Failed to fetch image: ${response.statusText}`,
      };
    }

    // ... (Logika penanganan dan filtering headers)
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
        const lowerKey = key.toLowerCase();
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-original-size', 'x-bytes-saved'].includes(lowerKey)) {
            responseHeaders[lowerKey] = value;
        }
    }

    const imageData = await response.buffer();
    const originalSize = imageData.length;
    const contentType = responseHeaders["content-type"] || "";

    // Log 4: IMAGE INFO
    console.log("-> IMAGE INFO", {
      contentType,
      originalSize: `${originalSize} bytes`
    });

    if (!shouldCompress(contentType, originalSize, useWebp)) {
      // Log 5: BYPASS
      const totalDuration = process.hrtime(handlerStartTime);
      const totalDurationMs = (totalDuration[0] * 1000) + (totalDuration[1] / 1000000);
      console.log(`--- BYPASS SUCCESS --- Total Duration: ${totalDurationMs.toFixed(2)}ms`);

      return {
        statusCode: 200,
        body: imageData.toString("base64"),
        isBase64Encoded: true,
        headers: {
          "content-encoding": "identity",
          "content-length": originalSize,
          ...responseHeaders,
          ...NO_CACHE_HEADERS
        },
      };
    }

    // Apply image compression
    const { err, output, headers: compressionHeaders, durationMs, fallbackApplied } = await compress(
      imageData,
      useWebp,
      grayscale,
      validQuality,
      originalSize
    );

    if (err) {
      console.error("-> COMPRESSION FAILED", {
        url: imageUrl, 
        error: err.message || err.toString()
      });
      return {
        statusCode: 500,
        body: "Compression failed"
      };
    }

    const savingsPercent = ((originalSize - output.length) / originalSize) * 100;
    const totalDuration = process.hrtime(handlerStartTime);
    const totalDurationMs = (totalDuration[0] * 1000) + (totalDuration[1] / 1000000);

    // Log 7: COMPRESSION SUCCESS
    console.log("--- COMPRESSION SUCCESS ---", {
      original: `${originalSize} bytes`,
      compressed: `${output.length} bytes`,
      saved: `${savingsPercent.toFixed(2)}%`,
      sharpDuration: `${durationMs.toFixed(2)}ms`,
      totalDuration: `${totalDurationMs.toFixed(2)}ms`,
      fallback: fallbackApplied ? 'WebP -> JPEG' : 'None'
    });

    return {
      statusCode: 200,
      body: output.toString("base64"),
      isBase64Encoded: true,
      headers: {
        "content-encoding": "identity",
        ...responseHeaders,
        ...compressionHeaders,
        ...NO_CACHE_HEADERS
      },
    };
  } catch (error) {
    console.error("--- HANDLER ERROR ---", {
      message: error.message || "Unknown error",
      stack: error.stack
    });
    return {
      statusCode: 500,
      body: error.message || "Internal server error"
    };
  }
};
