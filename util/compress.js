// Compresses an image using Sharp library
const sharp = require("sharp");

/**
 * Compresses an image buffer using Sharp
 * @param {Buffer} imageData - The image buffer to compress
 * @param {boolean} useWebp - Whether to use WebP format
 * @param {boolean} grayscale - Whether to apply grayscale filter
 * @param {number} quality - Compression quality (0-100)
 * @param {number} originalSize - Original size of the image
 * @returns {Promise} - Resolves with compressed data and headers or error
 */
async function compress(imageData, useWebp, grayscale, quality, originalSize) {
  const format = useWebp ? "webp" : "jpeg";

  try {
    const sharpInstance = sharp(imageData);

    // Apply grayscale if requested
    if (grayscale) {
      sharpInstance.grayscale();
    }

    // Apply format and quality settings
    const result = await sharpInstance
      .toFormat(format, {
        quality,
        progressive: true,
        optimizeScans: true
      })
      .toBuffer({ resolveWithObject: true });

    const { data, info } = result;

    return {
      err: null,
      headers: {
        "content-type": `image/${format}`,
        "content-length": info.size,
        "x-original-size": originalSize,
        "x-bytes-saved": originalSize - info.size,
      },
      output: data,
    };
  } catch (err) {
    console.error("Sharp compression error:", err);
    return { err };
  }
}

module.exports = compress;