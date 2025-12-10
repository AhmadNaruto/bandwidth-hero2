/**
 * Bandwidth Hero - Logika Pemilihan Kompresi
 *
 * Modul ini menentukan apakah sebuah gambar seharusnya dikompres
 * berdasarkan tipe, ukuran, dan format yang diminta.
 *
 * @module shouldCompress
 * @author Bandwidth Hero Team
 * @version 2.0.0
 */

/**
 * KONSTANTA PEMILIHAN KOMPRESI
 * Nilai-nilai ambang batas untuk menentukan perlunya kompresi
 */
// Ukuran minimum untuk gambar yang akan dikompres (format yang tidak transparan)
const MIN_COMPRESS_LENGTH = 1024; // 1KB
// Ukuran minimum untuk format transparan (PNG/GIF) - agar lebih banyak dikompres
const MIN_TRANSPARENT_COMPRESS_LENGTH = 10240; // 10KB (Diubah dari 100KB untuk kompresi yang lebih agresif)

/**
 * Menentukan apakah gambar seharusnya dikompres
 *
 * Fungsi ini mengevaluasi tipe gambar, ukuran, dan format output yang diminta
 * untuk menentukan apakah proses kompresi seharusnya dilakukan.
 *
 * @param {string} imageType - Tipe konten gambar (misal: 'image/jpeg', 'image/png')
 * @param {number} size - Ukuran gambar dalam byte
 * @param {boolean} usingWebp - Apakah format WebP yang diminta
 * @returns {boolean} - True jika gambar seharusnya dikompres, false jika tidak
 */
function shouldCompress(imageType, size, usingWebp) {
  // Jika menggunakan format WebP: lewati kompresi jika ukuran < 1KB
  if (usingWebp) {
    return size >= MIN_COMPRESS_LENGTH;
  }

  // Jika menggunakan format JPEG: lewati kompresi untuk PNG/GIF jika ukuran < 10KB
  // Kita menargetkan file PNG/GIF yang sedikit lebih kecil agar tetap dikompres menjadi JPEG
  const isTransparentFormat = imageType.endsWith("png") || imageType.endsWith("gif");
  const minSize = isTransparentFormat ? MIN_TRANSPARENT_COMPRESS_LENGTH : MIN_COMPRESS_LENGTH;

  return size >= minSize;
}

module.exports = shouldCompress;
