/**
 * Bandwidth Hero - Utilitas Kompresi Gambar
 *
 * Modul ini menangani kompresi gambar menggunakan pustaka Sharp.
 * Menyediakan kompresi yang agresif untuk menghemat bandwidth,
 * dengan dukungan untuk format WebP dan JPEG.
 *
 * @module compress
 * @author Bandwidth Hero Team
 * @version 2.0.0
 */

// Impor pustaka Sharp untuk pemrosesan gambar
const sharp = require("sharp");

/**
 * KONSTANTA KOMPRESI
 * Nilai-nilai yang digunakan untuk mengontrol proses kompresi
 */
// Batas dimensi maksimum untuk format WebP (Sharp memiliki batas internal)
const MAX_WEBP_DIMENSION = 16383;
// Lebar target untuk kompresi (mengoptimalkan untuk tampilan mobile)
const TARGET_WIDTH = 854;

/**
 * Fungsi utama untuk mengompres gambar
 *
 * Fungsi ini mengambil buffer gambar dan mengompresnya menggunakan Sharp
 * dengan berbagai pengaturan optimasi untuk menghemat bandwidth.
 *
 * @param {Buffer} imageData - Buffer gambar yang akan dikompres
 * @param {boolean} useWebp - Apakah format WebP diminta (jika tidak, gunakan JPEG)
 * @param {boolean} grayscale - Apakah aplikasikan filter grayscale
 * @param {number} quality - Kualitas kompresi (0-100)
 * @param {number} originalSize - Ukuran asli gambar (untuk statistik)
 * @returns {Promise<Object>} - Promise yang berisi hasil kompresi, header, dan durasi
 */
async function compress(imageData, useWebp, grayscale, quality, originalSize) {
  // Pastikan kualitas dalam rentang 1-100, default ke 30 untuk kompresi agresif
  const finalQuality = quality;
  // Tentukan format output (WebP atau JPEG)
  let format = useWebp ? "webp" : "jpeg";
  // Indikator apakah fallback dari WebP ke JPEG terjadi
  let fallbackApplied = false;

  // Catat waktu mulai untuk menghitung durasi kompresi
  const startTime = process.hrtime();
  
  try {
    // Validasi format gambar sebelum pemrosesan
    const sharpInstance = sharp(imageData, {
      failOnError: false,
      limitInputPixels: false  // Nonaktifkan batas untuk gambar besar
    });
    const metadata = await sharpInstance.metadata();

    // Deteksi apakah ini gambar manga (banyak area flat)
    if ( metadata.channels <= 2 || metadata.bitdepth === 1) {
          grayscale = true
    }
    
    // Verifikasi bahwa ini adalah gambar valid
    if (!metadata.format) {
      throw new Error("Format gambar tidak valid");
    }

    // Periksa dimensi gambar untuk mencegah masalah memori
    if (metadata.width > 32768 || metadata.height > 32768) {
      throw new Error(`Dimensi gambar terlalu besar: ${metadata.width}x${metadata.height}. Maksimum yang diizinkan: 32768x32768.`);
    }

    // Ambil dimensi asli gambar
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // 1. Tentukan apakah resize perlu dilakukan
    // Lakukan resize hanya jika gambar lebih lebar dari TARGET_WIDTH
    if (originalWidth && originalWidth > TARGET_WIDTH) {
        // Hitung faktor resize berdasarkan lebar target
        const resizeFactor = TARGET_WIDTH / originalWidth;
        const estimatedHeight = Math.round(originalHeight * resizeFactor);

        // 2. Periksa kebutuhan fallback WebP
        // WebP tidak mendukung dimensi lebih dari MAX_WEBP_DIMENSION
        if (format === 'webp' && estimatedHeight > MAX_WEBP_DIMENSION) {
            format = 'jpeg'; // Ganti ke JPEG karena WebP tidak mendukung dimensi ini
            fallbackApplied = true;
            console.warn(`[Sharp Fallback] Batas WebP (${MAX_WEBP_DIMENSION}px) terlampaui. Mengganti output ke JPEG. Estimasi tinggi: ${estimatedHeight}px`);
        }

        // Lakukan resize berdasarkan lebar target
        sharpInstance.resize({
            kernel: "lanczos3",
            width: TARGET_WIDTH,
            height: Math.round(originalHeight * resizeFactor), // Perhitungan tinggi yang lebih presisi
            withoutEnlargement: true,  // Jangan perbesar gambar yang lebih kecil dari target
            fit: 'inside'              // Pertahankan rasio aspek dalam dimensi target
        }).sharpen(
          !grayscale ? {
            sigma: 0.5,   // Sedikit lebih tinggi untuk ketajaman lebih baik
            m1: 0.5,      // Mengurangi sharpening pada area flat
            m2: 3,        // Meningkatkan sharpening pada edge (penting untuk manga)
            x1: 2,        // Threshold untuk flat area
            y2: 10,       // Threshold untuk edge detection
            y3: 20 // Max gain untuk sharpeningi
          } : {
            sigma: 0.7,
            m1: 0.5,
            m2: 3.0,
            x1: 2.0,
            y2: 12.0,
            y3: 25.0
          }
        )
    }

    // Terapkan filter grayscale jika diminta
    if (grayscale) {
      sharpInstance.grayscale();
      sharpInstance.threshold(128)
    }

    // 3. Proses Kompresi - dengan pengaturan kompresi agresif
    const result = await sharpInstance
      .toFormat(format, {
        chromaSubsampling: format === 'jpeg' ? '4:2:0' : undefined, 
        quality: finalQuality,  // Kualitas kompresi (0-100)
        // Pengaturan WebP yang lebih agresif
        lossless: false, // Pastikan kompresi lossy untuk WebP
        effort: format === 'webp' ? 6 : undefined, // Usaha kompresi maksimum untuk WebP (skala 0-6)
        // Tambahkan sharpYuv untuk meningkatkan ketajaman warna, kecuali saat grayscale
        sharpYuv: !grayscale, // Aktifkan hanya jika bukan grayscale untuk menjaga kualitas warna
        // Pengaturan JPEG yang lebih agresif
        progressive: format === 'jpeg',        // Gunakan JPEG progresif untuk ukuran lebih kecil
        mozjpeg: format === 'jpeg',            // Gunakan mozjpeg untuk kompresi JPEG yang lebih baik
        trellisQuantisation: format === 'jpeg', // Kuantisasi lebih agresif untuk JPEG
        overshootDeringing: format === 'jpeg',  // Kurangi artefak cincin untuk JPEG
        optimizeScans: format === 'jpeg',       // Optimalkan scan progresif JPEG
        smartSubsample: format === 'jpeg'       // Subsampling kroma yang lebih baik untuk JPEG
      })
      .toBuffer({ resolveWithObject: true });  // Konversi ke buffer dan kembalikan info ukuran

    // Ekstrak data dan info dari hasil kompresi
    const { data, info } = result;

    // Hitung durasi kompresi
    const duration = process.hrtime(startTime);
    const durationMs = (duration[0] * 1000) + (duration[1] / 1000000);

    // Kembalikan hasil dengan format yang diharapkan
    return {
      err: null,           // Tidak ada error
      output: data,        // Buffer gambar terkompresi
      durationMs,         // Durasi proses kompresi dalam milidetik
      fallbackApplied,    // Indikasi apakah fallback WebP->JPEG terjadi
      headers: {
        "content-type": `image/${format}`,     // Tipe konten hasil kompresi
        "content-length": info.size,          // Ukuran hasil kompresi
        "x-original-size": originalSize,      // Ukuran asli gambar (untuk statistik)
        "x-bytes-saved": originalSize - info.size, // Jumlah byte yang dihemat (untuk statistik)
      },
    };
  } catch (err) {
    // Log error jika kompresi gagal
    console.error("Error kompresi Sharp:", err);
    return { err };  // Kembalikan error
  }
}

module.exports = compress;
