const express = require('express');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

let db = null;
let initError = null;

function ensureDb() {
  if (initError) throw initError;
  if (db) return db;

  const missing = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']
    .filter((name) => !process.env[name]);

  if (missing.length > 0) {
    const err = new Error(`Environment variable belum diset: ${missing.join(', ')}`);
    err.missingEnv = missing;
    err.hint = 'Tambahkan variabel di Vercel → Settings → Environment Variables, lalu REDEPLOY. ' +
      'Pastikan nama variabel persis sama (huruf kapital, tanpa spasi).';
    initError = err;
    throw err;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Ganti urutan escape \n yang disimpan sebagai satu baris di env
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    db = admin.firestore();
    return db;
  } catch (error) {
    initError = new Error(`Firebase gagal diinisialisasi: ${error.message}`);
    initError.hint = 'Periksa FIREBASE_PRIVATE_KEY — biasanya harus berisi karakter literal \\n ' +
      '(bukan newline asli) dan dibungkus tanda kutip di Vercel.';
    throw initError;
  }
}

function sendError(res, error, status = 500) {
  const body = { success: false, message: error.message };
  if (error.missingEnv) body.missingEnv = error.missingEnv;
  if (error.hint) body.hint = error.hint;
  console.error('[API error]', error.message);
  res.status(status).json(body);
}

// API: Ambil semua data buku
app.get('/api/books', async (req, res) => {
  try {
    const books = await ensureDb().collection('books').orderBy('createdAt', 'desc').get();
    const data = [];
    books.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

// API: Tambah buku baru
app.post('/api/books', async (req, res) => {
  try {
    const { title, author, isbn, year } = req.body;
    if (!title || !author) {
      return res.status(400).json({ success: false, message: 'Judul dan Penulis wajib diisi' });
    }

    const docRef = await ensureDb().collection('books').add({
      title,
      author,
      isbn: isbn || '-',
      year: parseInt(year) || new Date().getFullYear(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ success: true, id: docRef.id, message: 'Buku berhasil ditambahkan' });
  } catch (error) {
    sendError(res, error);
  }
});

// API: Hapus buku berdasarkan ID
app.delete('/api/books/:id', async (req, res) => {
  try {
    await ensureDb().collection('books').doc(req.params.id).delete();
    res.status(200).json({ success: true, message: 'Buku berhasil dihapus' });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = app;

// Jalankan server lokal jika di-run secara mandiri
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
