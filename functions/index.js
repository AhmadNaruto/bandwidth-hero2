// index.js (Hanya bagian kompresi yang diubah)

// ...

    // Apply image compression
    // Tambahkan 'fallbackApplied' untuk menerima informasi fallback dari compress.js
    const { err, output, headers: compressionHeaders, durationMs, fallbackApplied } = await compress( 
      imageData,
      useWebp,
      grayscale,
      validQuality,
      originalSize
    );

    if (err) {
      // Log 6a: COMPRESSION FAILED
      console.error("-> COMPRESSION FAILED", {
        url: imageUrl, 
        error: err.message || err.toString()
      });
      // ...
    }

    const savingsPercent = ((originalSize - output.length) / originalSize) * 100;
    const totalDuration = process.hrtime(handlerStartTime);
    const totalDurationMs = (totalDuration[0] * 1000) + (totalDuration[1] / 1000000);

    // Log 7: COMPRESSION SUCCESS (Tambahkan fallback info)
    console.log("--- COMPRESSION SUCCESS ---", {
      original: `${originalSize} bytes`,
      compressed: `${output.length} bytes`,
      saved: `${savingsPercent.toFixed(2)}%`,
      sharpDuration: `${durationMs.toFixed(2)}ms`,
      totalDuration: `${totalDurationMs.toFixed(2)}ms`,
      fallback: fallbackApplied ? 'WebP -> JPEG' : 'None' // <--- LOG BARU
    });

    return {
      statusCode: 200,
      // ... (headers)
    };
  } catch (error) {
    // ...
  }
};
