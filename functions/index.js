// index.js yang Dioptimalisasi

// ... (require, pick, fetch, shouldCompress, compress)

const DEFAULT_QUALITY = 70; // Diubah dari 40 menjadi 70 (agar sesuai dengan compress.js)

// Maximum image size allowed (25MB) untuk keamanan memori
const MAX_IMAGE_SIZE = 25 * 1024 * 1024; 

exports.handler = async (event) => {
  // ... (kode awal, handling URL, parsing parameter)

  try {
    // ... (Validasi validQuality)

    // Fetch the original image (tetap sama)
    const response = await fetch(imageUrl, {
      // ... (headers, timeout)
    });

    // ... (Handling !response.ok)

    // Check content length before downloading
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      // ... (Error image too large)
    }

    // Get response headers
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      // Hapus header yang tidak relevan atau yang akan digantikan
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-original-size', 'x-bytes-saved'].includes(lowerKey)) {
          responseHeaders[lowerKey] = value;
      }
    }

    const imageData = await response.buffer();
    const originalSize = imageData.length;
    const contentType = responseHeaders["content-type"] || "";

    if (!shouldCompress(contentType, originalSize, useWebp)) {
      console.log("Bypassing compression... Size: ", originalSize);
      
      return {
        statusCode: 200,
        body: imageData.toString("base64"),
        isBase64Encoded: true,
        headers: {
          "content-encoding": "identity", // Penting untuk bypass agar browser tidak mengharapkan GZIP
          "content-length": originalSize, // Set ulang panjang konten
          ...responseHeaders // Sisa header asli
        },
      };
    }

    // Apply image compression (tetap sama)
    const { err, output, headers: compressionHeaders } = await compress(
      imageData,
      useWebp,
      grayscale,
      validQuality,
      originalSize
    );

    // ... (Handling error, logging savings percent)

    return {
      statusCode: 200,
      body: output.toString("base64"),
      isBase64Encoded: true,
      headers: {
        "content-encoding": "identity", // Tetap Identity karena Anda mengirim Base64 mentah
        ...responseHeaders, // Header asli yang sudah difilter
        ...compressionHeaders // Header kompresi baru (content-type, content-length, dll.)
      },
    };
  } catch (error) {
    // ... (Error processing request)
  }
};
