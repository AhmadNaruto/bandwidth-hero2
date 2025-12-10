/**
 * HANDLER UTAMA
 * Fungsi utama yang menangani permintaan kompresi gambar
 */
exports.handler = async (event) => {
  const handlerStartTime = process.hrtime();
  const { url } = event.queryStringParameters || {};
  const { jpeg, bw, l } = event.queryStringParameters || {};

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

  console.log("-> PARAMS", {
    targetURL: imageUrl,
    outputFormat: useWebp ? 'webp' : 'jpeg',
    grayscale,
    quality: validQuality
  });

  // ========== PERUBAHAN: Deklarasikan timeout di scope fungsi ==========
  let timeoutId = null;
  let compressionTimeoutId = null;

  try {
    // Pra-validasi dengan permintaan HEAD
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 45000); // Set timeoutId

    const headResponse = await fetch(imageUrl, {
      method: 'HEAD',
      headers: {
        ...pick(event.headers, [
          "cookie", "dnt", "referer", "user-agent", "accept",
          "accept-language", "accept-encoding"
        ]),
        "x-forwarded-for": event.headers["x-forwarded-for"] || event.ip,
      },
      signal: controller.signal,
      timeout: 10000,
    });

    if (!headResponse.ok) {
      console.error(`-> HEAD REQUEST FAILED: ${imageUrl}`, {
        status: headResponse.status,
        statusText: headResponse.statusText
      });
    }

    const contentLength = headResponse.headers.get('content-length');
    const contentType = headResponse.headers.get('content-type') || '';

    if (!contentType.startsWith('image/')) {
      clearTimeout(timeoutId);
      return {
        statusCode: 400,
        body: `Invalid content type: ${contentType}. Only image types are supported.`,
      };
    }

    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      clearTimeout(timeoutId);
      return {
        statusCode: 400,
        body: `Image too large: ${(contentLength / 1024 / 1024).toFixed(2)} MB. Maximum allowed: 25 MB.`,
      };
    }

    // Unduh gambar lengkap
    const response = await fetch(imageUrl, {
      headers: {
        ...pick(event.headers, [
          "cookie", "dnt", "referer", "user-agent", "accept",
          "accept-language", "accept-encoding"
        ]),
        "x-forwarded-for": event.headers["x-forwarded-for"] || event.ip,
      },
      signal: controller.signal,
      timeout: 30000,
    });

    if (!response.ok) {
      console.error(`-> FETCH FAILED: ${imageUrl}`, {
        status: response.status,
        statusText: response.statusText
      });
      clearTimeout(timeoutId);
      return {
        statusCode: response.status || 500,
        body: `Failed to fetch image: ${response.statusText}`,
      };
    }

    // Filter header yang tidak perlu
    const excludedHeaders = new Set([
      'content-encoding',
      'content-length',
      'transfer-encoding',
      'connection',
      'x-original-size',
      'x-bytes-saved'
    ]);

    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (!excludedHeaders.has(lowerKey)) {
        responseHeaders[lowerKey] = value;
      }
    }

    const imageData = await response.buffer();
    const originalSize = imageData.length;

    if (controller.signal.aborted) {
      console.log("Request cancelled during image download");
      clearTimeout(timeoutId);
      return {
        statusCode: 499,
        body: "Request cancelled by client"
      };
    }

    if (originalSize > MAX_IMAGE_SIZE) {
      clearTimeout(timeoutId);
      return {
        statusCode: 400,
        body: `Image too large after download: ${(originalSize / 1024 / 1024).toFixed(2)} MB. Maximum allowed: 25 MB.`,
      };
    }

    console.log("-> IMAGE INFO", {
      contentType,
      originalSize: `${originalSize} bytes`
    });

    // Periksa apakah gambar perlu dikompres
    if (!shouldCompress(contentType, originalSize, useWebp)) {
      const totalDuration = process.hrtime(handlerStartTime);
      const totalDurationMs = (totalDuration[0] * 1000) + (totalDuration[1] / 1000000);
      console.log(`--- BYPASS SUCCESS --- Total Duration: ${totalDurationMs.toFixed(2)}ms`);

      clearTimeout(timeoutId);
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

    clearTimeout(timeoutId);

    // Lakukan kompresi gambar
    const compressionController = new AbortController();
    compressionTimeoutId = setTimeout(() => compressionController.abort(), 30000);

    const { err, output, headers: compressionHeaders, durationMs, fallbackApplied } = await compress(
      imageData,
      useWebp,
      grayscale,
      validQuality,
      originalSize
    );

    clearTimeout(compressionTimeoutId);

    // Jika kompresi error, redirect ke gambar asli
    if (err) {
      console.error("-> COMPRESSION FAILED - REDIRECTING TO ORIGINAL", {
        url: imageUrl,
        error: err.message || err.toString()
      });
      
      const totalDuration = process.hrtime(handlerStartTime);
      const totalDurationMs = (totalDuration[0] * 1000) + (totalDuration[1] / 1000000);
      
      console.log("--- REDIRECT TO ORIGINAL ---", {
        reason: err.message,
        totalDuration: `${totalDurationMs.toFixed(2)}ms`
      });
      
      return {
        statusCode: 302,
        headers: {
          "Location": imageUrl,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Redirect-Reason": err.message.replace(/[^a-zA-Z0-9 ]/g, '_')
        },
        body: ""
      };
    }

    // Hitung statistik jika kompresi berhasil
    const savingsPercent = ((originalSize - output.length) / originalSize) * 100;
    const totalDuration = process.hrtime(handlerStartTime);
    const totalDurationMs = (totalDuration[0] * 1000) + (totalDuration[1] / 1000000);

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
    // ========== PERUBAHAN: Gunakan variabel yang sudah dideklarasikan ==========
    // Bersihkan timeout jika sudah diatur
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (compressionTimeoutId) {
      clearTimeout(compressionTimeoutId);
    }

    if (error.name === 'AbortError' || error.message.includes('abort') || error.type === 'aborted') {
      console.log("Request cancelled or timed out");
      return {
        statusCode: 499,
        body: "Request cancelled by client or timed out"
      };
    }

    console.error("--- HANDLER ERROR ---", {
      message: error.message || "Unknown error",
      stack: error.stack
    });
    
    // Redirect ke gambar asli jika error umum
    if (imageUrl) {
      console.log("-> UNHANDLED ERROR - REDIRECTING TO ORIGINAL:", error.message);
      return {
        statusCode: 302,
        headers: {
          "Location": imageUrl,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Redirect-Reason": "unhandled_error"
        },
        body: ""
      };
    }
    
    return {
      statusCode: 500,
      body: error.message || "Internal server error"
    };
  }
};