import { getEncoding } from 'js-tiktoken';

// Use cl100k_base encoding (same as GPT-3.5/4) which is close to what Nomic uses
const encoding = getEncoding('cl100k_base');

export function countTokens(text) {
  return encoding.encode(text).length;
}

export function truncateToTokens(text, maxTokens) {
  const tokens = encoding.encode(text);
  if (tokens.length <= maxTokens) {
    return text;
  }
  
  const truncatedTokens = tokens.slice(0, maxTokens);
  return encoding.decode(truncatedTokens);
}

export function chunkTextByTokens(text, maxTokensPerChunk = 1024, overlapTokens = 100) {
  const tokens = encoding.encode(text);
  
  if (tokens.length <= maxTokensPerChunk) {
    return [text];
  }
  
  const chunks = [];
  let start = 0;
  
  while (start < tokens.length) {
    const end = Math.min(start + maxTokensPerChunk, tokens.length);
    const chunkTokens = tokens.slice(start, end);
    const chunkText = encoding.decode(chunkTokens);
    
    chunks.push(chunkText);
    
    // Move start position with overlap
    start = end - overlapTokens;
    
    // Prevent infinite loop
    if (start >= end - overlapTokens) {
      break;
    }
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
}

// Free encoding when done (optional cleanup)
export function cleanup() {
  encoding.free();
}