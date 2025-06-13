import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import dotenv from 'dotenv';
import { chunkTextByTokens, countTokens, truncateToTokens } from './tokenizer.js';
import { markdownSemanticChunk, getMarkdownChunkingStats } from './markdown-chunker.js';
import { extractNoteMetadata, createEmbeddingContext } from './context-enricher.js';

dotenv.config();

const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;
const MAX_TOKENS_PER_CHUNK = parseInt(process.env.MAX_TOKENS_PER_CHUNK) || 1024; // Nomic optimal range
const CHUNK_OVERLAP_TOKENS = parseInt(process.env.CHUNK_OVERLAP_TOKENS) || 100;

export async function getAllNotes() {
  if (!OBSIDIAN_VAULT_PATH) {
    throw new Error('OBSIDIAN_VAULT_PATH not set in .env file');
  }

  const markdownFiles = await glob('**/*.md', {
    cwd: OBSIDIAN_VAULT_PATH,
    ignore: ['**/.*/**'] // ignore hidden folders
  });

  return markdownFiles.map(file => path.join(OBSIDIAN_VAULT_PATH, file));
}

export async function parseNote(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    
    // Handle empty files
    if (!content || content.trim().length === 0) {
      console.warn(`Warning: Empty file ${filePath}`);
      return null; // Skip empty files
    }
    
    let parsed;
    try {
      parsed = matter(content);
    } catch (frontmatterError) {
      console.warn(`Warning: Malformed frontmatter in ${filePath}, using content only`);
      parsed = { content: content, data: {} };
    }
    
    // Extract comprehensive metadata
    const noteMetadata = extractNoteMetadata(filePath, parsed.content, parsed.data);
    
    return {
      filePath,
      content: parsed.content,
      frontmatter: parsed.data || {},
      ...noteMetadata
    };
  } catch (error) {
    console.error(`Error parsing note ${filePath}:`, error.message);
    return null; // Skip problematic files
  }
}

export function chunkText(text) {
  // Use 2025 best practice: Markdown-aware semantic chunking
  // Leverages headers, code blocks, lists, tables for natural boundaries
  const chunks = markdownSemanticChunk(text, MAX_TOKENS_PER_CHUNK, CHUNK_OVERLAP_TOKENS);
  
  // Filter out very short chunks (less than 50 tokens)
  const validChunks = chunks.filter(chunk => {
    const tokenCount = countTokens(chunk.trim());
    return tokenCount >= 50; // Minimum viable chunk size
  });
  
  return validChunks;
}

function extractTitleFromContent(content) {
  // Look for # heading at start
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  
  // Fall back to first line
  const firstLine = content.split('\n')[0].trim();
  return firstLine.length > 0 && firstLine.length < 100 ? firstLine : 'Untitled';
}

export async function processAllNotes() {
  const noteFiles = await getAllNotes();
  const notes = [];
  let skippedFiles = 0;
  
  console.log(`Processing ${noteFiles.length} files...`);
  
  for (const filePath of noteFiles) {
    try {
      const note = await parseNote(filePath);
      
      // Skip null notes (empty files, parse errors)
      if (!note) {
        skippedFiles++;
        continue;
      }
      
      const chunks = chunkText(note.content);
      
      // Skip notes with no valid chunks
      if (!chunks || chunks.length === 0) {
        console.warn(`Warning: No valid chunks generated for ${filePath}`);
        skippedFiles++;
        continue;
      }
      
      // Calculate note-level metadata
      const noteTokenCount = countTokens(note.content);
      const totalChunks = chunks.length;
      
      // Create enriched chunks with metadata context
      const enrichedChunks = [];
      
      for (let index = 0; index < chunks.length; index++) {
        const chunkText = chunks[index];
        
        try {
          const relativePosition = totalChunks > 1 ? index / (totalChunks - 1) : 0;
          
          const chunkMetadata = {
            chunkIndex: index,
            totalChunks,
            relativePosition
          };
          
          // Create embedding context with rich metadata
          const embeddingContext = createEmbeddingContext(chunkText, chunkMetadata, note);
          
          // Validate that enriched text is not empty
          if (!embeddingContext.enrichedText || embeddingContext.enrichedText.trim().length === 0) {
            console.warn(`Warning: Empty enriched text for chunk ${index} in ${filePath}`);
            continue;
          }
          
          enrichedChunks.push({
            originalText: chunkText,
            chunkIndex: index,
            relativePosition,
            ...embeddingContext
          });
        } catch (chunkError) {
          console.warn(`Error processing chunk ${index} in ${filePath}:`, chunkError.message);
          continue;
        }
      }
      
      // Only add notes with valid chunks
      if (enrichedChunks.length > 0) {
        notes.push({
          ...note,
          chunks: enrichedChunks,
          tokenCount: noteTokenCount,
          totalChunks: enrichedChunks.length
        });
      } else {
        console.warn(`Warning: No valid enriched chunks for ${filePath}`);
        skippedFiles++;
      }
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error.message);
      skippedFiles++;
    }
  }
  
  if (skippedFiles > 0) {
    console.log(`Processed ${notes.length} notes successfully, skipped ${skippedFiles} files`);
  }
  
  return notes;
}