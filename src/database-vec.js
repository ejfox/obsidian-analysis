import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'embeddings.db');
const vecExtensionPath = path.join(__dirname, '..', 'vec0.dylib');

const db = new sqlite3.Database(dbPath);

// Load sqlite-vec extension
db.loadExtension(vecExtensionPath);

const runAsync = promisify(db.run.bind(db));
const allAsync = promisify(db.all.bind(db));
const getAsync = promisify(db.get.bind(db));

export async function initDatabase() {
  // Create notes table with enhanced metadata
  await runAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      title TEXT,
      content TEXT,
      file_name TEXT,
      folder_path TEXT,
      folder_depth INTEGER,
      note_token_count INTEGER,
      total_chunks INTEGER,
      has_frontmatter BOOLEAN DEFAULT 0,
      frontmatter_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create enhanced chunk metadata table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      enriched_text TEXT NOT NULL,
      token_count INTEGER,
      relative_position REAL,
      has_code BOOLEAN DEFAULT 0,
      has_links BOOLEAN DEFAULT 0,
      has_tags BOOLEAN DEFAULT 0,
      has_headings BOOLEAN DEFAULT 0,
      question_count INTEGER DEFAULT 0,
      exclamation_count INTEGER DEFAULT 0,
      word_count INTEGER,
      sentence_count INTEGER,
      avg_word_length REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id),
      UNIQUE(note_id, chunk_index)
    )
  `);

  // Create vector table using sqlite-vec
  await runAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
      embedding float[768],
      +chunk_id INTEGER
    )
  `);

  // Create indexes
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_chunks_note_id ON chunks(note_id)`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_path)`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_chunks_features ON chunks(has_code, has_links, has_tags)`);
}

export async function insertNote(noteData) {
  const {
    filePath,
    title,
    content,
    fileName,
    folderPath,
    folderDepth,
    tokenCount,
    totalChunks,
    hasFrontmatter,
    frontmatter
  } = noteData;

  try {
    const result = await runAsync(
      `INSERT OR REPLACE INTO notes 
       (file_path, title, content, file_name, folder_path, folder_depth, 
        note_token_count, total_chunks, has_frontmatter, frontmatter_json, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        filePath,
        title,
        content,
        fileName,
        folderPath,
        folderDepth,
        tokenCount,
        totalChunks,
        hasFrontmatter ? 1 : 0,
        frontmatter ? JSON.stringify(frontmatter) : null
      ]
    );

    // Handle both INSERT and REPLACE cases
    if (result && result.lastID) {
      return result.lastID;
    } else {
      const existing = await getAsync(`SELECT id FROM notes WHERE file_path = ?`, [filePath]);
      if (existing) {
        return existing.id;
      } else {
        throw new Error(`Failed to get note ID for ${filePath}`);
      }
    }
  } catch (error) {
    console.error('Error inserting note:', error);
    throw error;
  }
}

export async function insertChunkWithEmbedding(chunkData, embedding) {
  const {
    noteId,
    chunkIndex,
    chunkText,
    enrichedText,
    tokenCount,
    relativePosition,
    hasCode,
    hasLinks,
    hasTags,
    hasHeadings,
    questionCount,
    exclamationCount,
    wordCount,
    sentenceCount,
    avgWordLength
  } = chunkData;

  // Insert chunk metadata
  try {
    const chunkResult = await runAsync(
      `INSERT OR REPLACE INTO chunks 
       (note_id, chunk_index, chunk_text, enriched_text, token_count, relative_position,
        has_code, has_links, has_tags, has_headings, question_count, exclamation_count,
        word_count, sentence_count, avg_word_length) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        noteId,
        chunkIndex,
        chunkText,
        enrichedText,
        tokenCount,
        relativePosition,
        hasCode ? 1 : 0,
        hasLinks ? 1 : 0,
        hasTags ? 1 : 0,
        hasHeadings ? 1 : 0,
        questionCount,
        exclamationCount,
        wordCount,
        sentenceCount,
        avgWordLength
      ]
    );

    let chunkId;
    if (chunkResult && chunkResult.lastID) {
      chunkId = chunkResult.lastID;
    } else {
      const existing = await getAsync(
        `SELECT id FROM chunks WHERE note_id = ? AND chunk_index = ?`, 
        [noteId, chunkIndex]
      );
      if (existing) {
        chunkId = existing.id;
      } else {
        throw new Error(`Failed to get chunk ID for note ${noteId}, chunk ${chunkIndex}`);
      }
    }

    // Insert vector embedding
    await runAsync(
      `INSERT OR REPLACE INTO vec_embeddings(embedding, chunk_id) VALUES (?, ?)`,
      [JSON.stringify(embedding), chunkId]
    );

    return chunkId;
  } catch (error) {
    console.error('Error inserting chunk with embedding:', error);
    throw error;
  }
}

export async function searchSimilar(queryEmbedding, limit = 10, filters = {}) {
  let whereClause = '';
  let params = [JSON.stringify(queryEmbedding), limit];

  if (filters.hasCode !== undefined) {
    whereClause += ' AND c.has_code = ?';
    params.splice(-1, 0, filters.hasCode ? 1 : 0);
  }
  
  if (filters.folderPath) {
    whereClause += ' AND n.folder_path LIKE ?';
    params.splice(-1, 0, `%${filters.folderPath}%`);
  }
  
  if (filters.minTokens) {
    whereClause += ' AND c.token_count >= ?';
    params.splice(-1, 0, filters.minTokens);
  }

  const query = `
    SELECT 
      c.*,
      n.title,
      n.file_path,
      n.file_name,
      n.folder_path,
      v.distance
    FROM vec_embeddings v
    JOIN chunks c ON v.chunk_id = c.id
    JOIN notes n ON c.note_id = n.id
    WHERE v.embedding MATCH ? ${whereClause}
    ORDER BY v.distance
    LIMIT ?
  `;

  return await allAsync(query, params);
}

export async function getEmbeddingStats() {
  const stats = await getAsync(`
    SELECT 
      COUNT(*) as total_embeddings,
      COUNT(DISTINCT c.note_id) as unique_notes,
      AVG(c.token_count) as avg_token_count,
      MAX(c.token_count) as max_token_count,
      MIN(c.token_count) as min_token_count,
      AVG(c.relative_position) as avg_relative_position,
      SUM(c.has_code) as chunks_with_code,
      SUM(c.has_links) as chunks_with_links,
      SUM(c.has_tags) as chunks_with_tags
    FROM vec_embeddings v
    JOIN chunks c ON v.chunk_id = c.id
  `);

  return stats;
}

export async function getAllEmbeddingsWithMetadata() {
  return await allAsync(`
    SELECT 
      v.embedding,
      c.*,
      n.title,
      n.file_path,
      n.file_name,
      n.folder_path,
      n.folder_depth,
      n.note_token_count,
      n.total_chunks,
      n.has_frontmatter,
      n.frontmatter_json
    FROM vec_embeddings v
    JOIN chunks c ON v.chunk_id = c.id
    JOIN notes n ON c.note_id = n.id
    ORDER BY n.title, c.chunk_index
  `);
}

export { db, runAsync, allAsync, getAsync };