/**
 * Bandwidth Hero - Utilitas Pemilihan Properti Objek
 *
 * Modul ini menyediakan fungsionalitas untuk memilih properti tertentu
 * dari sebuah objek, mirip dengan fungsi pick dari pustaka lodash.
 *
 * @module pick
 * @author Bandwidth Hero Team
 * @version 2.0.0
 */

/**
 * Memilih properti tertentu dari sebuah objek
 *
 * Fungsi ini mengambil objek dan daftar properti yang diinginkan,
 * lalu mengembalikan objek baru hanya dengan properti yang ditentukan.
 *
 * @param {Object} object - Objek sumber yang akan dipilih propertinya
 * @param {string[]} properties - Array nama properti yang ingin dipilih
 * @returns {Object} - Objek baru hanya dengan properti yang ditentukan
 */
module.exports = (object, properties) => {
  // Inisialisasi objek hasil
  let picked = {};

  // Pastikan object tidak null atau undefined, jika ya, gunakan objek kosong
  object = object || {};

  // Iterasi semua properti dalam objek sumber
  for (let key in object) {
    // Pastikan properti adalah milik objek langsung (bukan dari prototype)
    // dan termasuk dalam daftar properti yang ingin dipilih
    if (Object.hasOwnProperty.call(object, key) && properties.includes(key)) {
      // Tambahkan properti ke objek hasil
      picked[key] = object[key];
    }
  }

  // Kembalikan objek dengan properti yang dipilih
  return picked;
};