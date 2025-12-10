// compress.js - Diperbarui dengan WebP Fallback ke JPEG
const sharp = require("sharp");

// Batas tinggi maksimum untuk format WebP
const MAX_WEBP_DIMENSION = 16383;
// Lebar target untuk kompresi webtoon
const TARGET_WIDTH = 854;

/**
 * Compresses an image buffer using Sharp, optimized for bandwidth saving (480p max width).
 * @param {Buffer} imageData - The image buffer to compress
 * @param {boolean} useWebp - Whether WebP format was originally requested
 * @param {boolean} grayscale - Whether to apply grayscale filter
 * @param {number} quality - Compression quality (0-100)
 * @param {number} originalSize - Original size of the image
 * @returns {Promise} - Resolves with compressed data, headers, and duration
 */
async function compress(imageData, useWebp, grayscale, quality, originalSize) {
  const finalQuality = Math.min(100, Math.max(1, quality || 70)); 
  let format = useWebp ? "webp" : "jpeg"; // Format awal
  let fallbackApplied = false;

  const startTime = process.hrtime(); 

  try {
    const sharpInstance = sharp(imageData);
    
    const metadata = await sharpInstance.metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // 1. Tentukan dimensi resize
    // Hanya lakukan resize jika gambar saat ini lebih lebar dari TARGET_WIDTH
    if (originalWidth && originalWidth > TARGET_WIDTH) {
        
        // Hitung perkiraan tinggi setelah resize
        const resizeFactor = TARGET_WIDTH / originalWidth;
        const estimatedHeight = Math.round(originalHeight * resizeFactor);

        // 2. Cek Fallback WebP
        if (format === 'webp' && estimatedHeight > MAX_WEBP_DIMENSION) {
            format = 'jpeg'; // Ganti format menjadi JPEG
            fallbackApplied = true;
            console.warn(`[Sharp Fallback] WebP limit (${MAX_WEBP_DIMENSION}px) exceeded. Switching output to JPEG. Estimated height: ${estimatedHeight}px`);
        }
        
        // Lakukan resize berdasarkan Lebar
        sharpInstance.resize({
            width: TARGET_WIDTH,
            height: null, // Tinggi dihitung otomatis
            withoutEnlargement: true 
        });
    }

    if (grayscale) {
      sharpInstance.grayscale();
    }

    // 3. Proses Kompresi
    const result = await sharpInstance
      .toFormat(format, {
        quality: finalQuality,
        progressive: format === 'jpeg', 
        optimizeScans: format === 'jpeg' 
      })
      .toBuffer({ resolveWithObject: true });

    const { data, info } = result;

    const duration = process.hrtime(startTime);
    const durationMs = (duration[0] * 1000) + (duration[1] / 1000000);

    return {
      err: null,
      output: data,
      durationMs,
      fallbackApplied, // Tambahkan informasi fallback untuk logging di index.js
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
