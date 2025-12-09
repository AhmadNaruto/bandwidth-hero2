const MIN_COMPRESS_LENGTH = 1024;
const MIN_TRANSPARENT_COMPRESS_LENGTH = 102400;

/**
 * Determines if an image should be compressed based on type, size, and format
 * @param {string} imageType - The content type of the image
 * @param {number} size - The size of the image in bytes
 * @param {boolean} usingWebp - Whether WebP format is being used (affects compression decision)
 * @returns {boolean} - Whether the image should be compressed
 */
function shouldCompress(imageType, size, usingWebp) {
  // Only compress image files
  if (!imageType || !imageType.startsWith("image/")) {
    return false;
  }

  // Don't compress if size is 0
  if (size === 0) {
    return false;
  }

  // If using WebP format: skip compression if size < MIN_COMPRESS_LENGTH (1KB)
  if (usingWebp) {
    return size >= MIN_COMPRESS_LENGTH;
  }

  // If using JPEG format: skip compression for PNG/GIF if size < MIN_TRANSPARENT_COMPRESS_LENGTH (100KB)
  // For other formats (JPEG, etc.), use the standard minimum
  const isTransparentFormat = imageType.endsWith("png") || imageType.endsWith("gif");
  const minSize = isTransparentFormat ? MIN_TRANSPARENT_COMPRESS_LENGTH : MIN_COMPRESS_LENGTH;

  return size >= minSize;
}

module.exports = shouldCompress;