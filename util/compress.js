// compress.js yang Dioptimalisasi
const sharp = require("sharp");

async function compress(imageData, useWebp, grayscale, quality, originalSize) {
  const format = useWebp ? "webp" : "jpeg";
  // Default kualitas 70 untuk penghematan bandwidth yang lebih baik
  const finalQuality = Math.min(100, Math.max(1, quality || 70)); 

  try {
    const sharpInstance = sharp(imageData);

    // --- Optimalisasi Utama: Resize ke 480p (Max 854x854) ---
    const MAX_DIMENSION = 854;

    sharpInstance.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside', 
        withoutEnlargement: true // Penting untuk menjaga gambar kecil
    });
    // -----------------------------------------------------------

    if (grayscale) {
      sharpInstance.grayscale();
    }

    const result = await sharpInstance
      .toFormat(format, {
        quality: finalQuality,
        progressive: format === 'jpeg', // Hanya untuk JPEG
        optimizeScans: format === 'jpeg' 
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
        // Hapus header Cache-Control seperti permintaan Anda (Real-time)
      },
      output: data,
    };
  } catch (err) {
    console.error("Sharp compression error:", err);
    return { err };
  }
}

module.exports = compress;
