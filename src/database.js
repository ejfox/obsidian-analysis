import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'embeddings.db');
const db = new sqlite3.Database(dbPath);

const runAsync = promisify(db.run.bind(db));
const allAsync = promisify(db.all.bind(db));
const getAsync = promisify(db.get.bind(db));

export async function initDatabase() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      title TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      model TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id),
      UNIQUE(note_id, chunk_index)
    )
  `);

  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_embeddings_note_id ON embeddings(note_id)
  `);
}

export async function insertNote(filePath, title, content) {
  const result = await runAsync(
    `INSERT OR REPLACE INTO notes (file_path, title, content, updated_at) 
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [filePath, title, content]
  );
  return result.lastID;
}

export async function insertEmbedding(noteId, chunkIndex, chunkText, embedding, model) {
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
  await runAsync(
    `INSERT OR REPLACE INTO embeddings (note_id, chunk_index, chunk_text, embedding, model) 
     VALUES (?, ?, ?, ?, ?)`,
    [noteId, chunkIndex, chunkText, embeddingBuffer, model]
  );
}

export async function searchSimilar(queryEmbedding, limit = 10) {
  const notes = await allAsync(`
    SELECT e.*, n.title, n.file_path
    FROM embeddings e
    JOIN notes n ON e.note_id = n.id
  `);

  const results = notes.map(note => {
    const embedding = new Float32Array(note.embedding.buffer);
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    return { ...note, similarity };
  });

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export { db, runAsync, allAsync, getAsync };