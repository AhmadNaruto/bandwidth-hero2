const pick = require("../util/pick");
const fetch = require("node-fetch");
const shouldCompress = require("../util/shouldCompress");
const compress = require("../util/compress");
const DEFAULT_QUALITY = 40;

// Maximum image size allowed (50MB) to prevent memory issues
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

exports.handler = async (event) => {
  const { url } = event.queryStringParameters || {};
  const { jpeg, bw, l } = event.queryStringParameters || {};

  // Return simple response if no URL is provided
  if (!url) {
    return {
      statusCode: 200,
      body: "bandwidth-hero-proxy"
    };
  }

  let imageUrl = url;

  // Attempt to parse if URL is JSON-encoded
  try {
    imageUrl = JSON.parse(imageUrl);
  } catch (parseError) {
    // If JSON parsing fails, continue with original URL
  }

  // Handle array format by joining with URL parameter
  if (Array.isArray(imageUrl)) {
    imageUrl = imageUrl.join("&url=");
  }

  // Fix malformed URLs that contain the pattern
  imageUrl = imageUrl.replace(/http:\/\/1\.1\.\d\.\d\/bmi\/(https?:\/\/)?/i, "http://");

  // Parse input parameters
  const useWebp = !jpeg; // Use WebP if jpeg parameter is not set
  const grayscale = !!bw && bw !== '0'; // Enable grayscale if bw is set to any non-'0' value
  const quality = parseInt(l, 10) || DEFAULT_QUALITY;

  try {
    // Validate quality parameter
    const validQuality = Math.min(100, Math.max(0, quality));

    // Fetch the original image
    const response = await fetch(imageUrl, {
      headers: {
        ...pick(event.headers, [
          "cookie",
          "dnt",
          "referer",
          "user-agent",
          "accept",
          "accept-language",
          "accept-encoding"
        ]),
        "x-forwarded-for": event.headers["x-forwarded-for"] || event.ip,
      },
      // Set timeout to avoid hanging requests
      timeout: 30000, // 30 seconds
    });

    if (!response.ok) {
      return {
        statusCode: response.status || 500,
        body: `Failed to fetch image: ${response.statusText}`,
      };
    }

    // Check content length before downloading to prevent memory issues
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return {
        statusCode: 413, // Payload Too Large
        body: "Image size exceeds maximum allowed size"
      };
    }

    // Get response headers and buffer the image data
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }

    const imageData = await response.buffer();
    const originalSize = imageData.length;
    const contentType = responseHeaders["content-type"] || "";

    // Check if compression should be applied
    // Note: The third parameter is still named isWebp in shouldCompress for backward compatibility
    // but the logic was updated to properly handle WebP vs JPEG decisions
    if (!shouldCompress(contentType, originalSize, useWebp)) {
      console.log("Bypassing compression... Size: ", originalSize);
      return {
        statusCode: 200,
        body: imageData.toString("base64"),
        isBase64Encoded: true,
        headers: {
          "content-encoding": "identity",
          ...responseHeaders
        },
      };
    }

    // Apply image compression
    const { err, output, headers: compressionHeaders } = await compress(
      imageData,
      useWebp,
      grayscale,
      validQuality,
      originalSize
    );

    if (err) {
      console.error("Compression failed: ", imageUrl, err);
      return {
        statusCode: 500,
        body: "Compression failed"
      };
    }

    const savingsPercent = ((originalSize - output.length) / originalSize) * 100;
    console.log(`Original: ${originalSize} bytes, Compressed: ${output.length} bytes, Saved: ${savingsPercent.toFixed(2)}%`);

    return {
      statusCode: 200,
      body: output.toString("base64"),
      isBase64Encoded: true,
      headers: {
        "content-encoding": "identity",
        ...responseHeaders,
        ...compressionHeaders
      },
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      body: error.message || "Internal server error"
    };
  }
};
