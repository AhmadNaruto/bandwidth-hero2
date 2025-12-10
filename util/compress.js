// compress.js - Di-recode untuk logging durasi
const sharp = require("sharp");

/**
 * Compresses an image buffer using Sharp, optimized for bandwidth saving (480p max resolution).
 * Compression is performed in real-time on every request (no caching headers added).
 * * @param {Buffer} imageData - The image buffer to compress
 * @param {boolean} useWebp - Whether to use WebP format
 * @param {boolean} grayscale - Whether to apply grayscale filter
 * @param {number} quality - Compression quality (0-100)
 * @param {number} originalSize - Original size of the image
 * @returns {Promise} - Resolves with compressed data, headers, and duration
 */
async function compress(imageData, useWebp, grayscale, quality, originalSize) {
  const format = useWebp ? "webp" : "jpeg";
  const finalQuality = Math.min(100, Math.max(1, quality || 70)); 
  
  // Start timer untuk mengukur durasi kompresi Sharp
  const startTime = process.hrtime(); 

  try {
    const sharpInstance = sharp(imageData);
    const MAX_DIMENSION = 854;

    // Resize ke 480p
    sharpInstance.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside', 
        withoutEnlargement: true 
    });

    if (grayscale) {
      sharpInstance.grayscale();
    }

    const result = await sharpInstance
      .toFormat(format, {
        quality: finalQuality,
        progressive: format === 'jpeg', 
        optimizeScans: format === 'jpeg' 
      })
      .toBuffer({ resolveWithObject: true });

    const { data, info } = result;

    // Hitung durasi
    const duration = process.hrtime(startTime);
    const durationMs = (duration[0] * 1000) + (duration[1] / 1000000);

    return {
      err: null,
      output: data,
      durationMs, // Tambahkan durasi ke output
      headers: {
        "content-type": `image/${format}`,
        "content-length": info.size,
        "x-original-size": originalSize,
        "x-bytes-saved": originalSize - info.size,
      },
    };
  } catch (err) {
    console.error("Sharp compression error:", err);
    return { err };
  }
}

module.exports = compress;
