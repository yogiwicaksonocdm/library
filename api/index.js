const express = require('express');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// Inisialisasi Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT || '{}'
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const booksCollection = db.collection('books');

// API: Ambil semua data buku
app.get('/api/books', async (req, res) => {
  try {
    const snapshot = await booksCollection.orderBy('createdAt', 'desc').get();
    const books = [];
    snapshot.forEach(doc => {
      books.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Tambah buku baru
app.post('/api/books', async (req, res) => {
  try {
    const { title, author, isbn, year } = req.body;
    if (!title || !author) {
      return res.status(400).json({ success: false, message: 'Judul dan Penulis wajib diisi' });
    }

    const newBook = {
      title,
      author,
      isbn: isbn || '-',
      year: parseInt(year) || new Date().getFullYear(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await booksCollection.add(newBook);
    res.status(201).json({ success: true, id: docRef.id, message: 'Buku berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Hapus buku berdasarkan ID
app.delete('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await booksCollection.doc(id).delete();
    res.status(200).json({ success: true, message: 'Buku berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export handler untuk Vercel Serverless Function
module.exports = app;

// Jalankan server lokal jika di-run secara mandiri
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}