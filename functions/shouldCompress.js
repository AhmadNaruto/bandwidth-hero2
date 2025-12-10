// shouldCompress.js yang Dioptimalisasi

const MIN_COMPRESS_LENGTH = 1024; // 1KB
// Turunkan batas untuk format transparan agar lebih banyak kompresi yang terjadi
const MIN_TRANSPARENT_COMPRESS_LENGTH = 10240; // 10KB (Diubah dari 100KB)

function shouldCompress(imageType, size, usingWebp) {
  // ... (tetap sama)

  // If using WebP format: skip compression if size < 1KB
  if (usingWebp) {
    return size >= MIN_COMPRESS_LENGTH;
  }

  // If using JPEG format: skip compression for PNG/GIF if size < 10KB
  // Kita menargetkan file PNG/GIF yang sedikit lebih kecil agar tetap dikompres menjadi JPEG
  const isTransparentFormat = imageType.endsWith("png") || imageType.endsWith("gif");
  const minSize = isTransparentFormat ? MIN_TRANSPARENT_COMPRESS_LENGTH : MIN_COMPRESS_LENGTH;

  return size >= minSize;
}

module.exports = shouldCompress;
