import { countTokens } from './tokenizer.js';

export function semanticChunkText(text, maxTokensPerChunk = 512, overlapTokens = 128) {
  // First, try semantic boundaries (paragraphs, sections)
  const chunks = [];
  
  // Split by major sections first (headers)
  const sections = text.split(/(?=^#{1,6}\s)/m).filter(section => section.trim());
  
  for (const section of sections) {
    const sectionChunks = processSection(section, maxTokensPerChunk, overlapTokens);
    chunks.push(...sectionChunks);
  }
  
  // If we didn't get good chunks, fall back to paragraph-based chunking
  if (chunks.length === 0) {
    return paragraphAwareChunking(text, maxTokensPerChunk, overlapTokens);
  }
  
  return chunks.filter(chunk => {
    const tokenCount = countTokens(chunk.trim());
    return tokenCount >= 50; // Minimum viable chunk size
  });
}

function processSection(section, maxTokensPerChunk, overlapTokens) {
  const sectionTokens = countTokens(section);
  
  // If section fits in one chunk, return it
  if (sectionTokens <= maxTokensPerChunk) {
    return [section];
  }
  
  // Try paragraph-based splitting within section
  return paragraphAwareChunking(section, maxTokensPerChunk, overlapTokens);
}

function paragraphAwareChunking(text, maxTokensPerChunk, overlapTokens) {
  // Split by paragraphs (double newlines or more)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  if (paragraphs.length === 1) {
    // Single paragraph - use sentence-aware chunking
    return sentenceAwareChunking(text, maxTokensPerChunk, overlapTokens);
  }
  
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = countTokens(paragraph);
    
    // If paragraph alone exceeds max tokens, split it further
    if (paragraphTokens > maxTokensPerChunk) {
      // Save current chunk if it exists
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split the large paragraph
      const subChunks = sentenceAwareChunking(paragraph, maxTokensPerChunk, overlapTokens);
      chunks.push(...subChunks);
      continue;
    }
    
    // Check if adding this paragraph would exceed limit
    const combinedTokens = currentTokens + paragraphTokens + (currentChunk ? 20 : 0); // +20 for spacing
    
    if (combinedTokens > maxTokensPerChunk && currentChunk.trim()) {
      // Save current chunk and start new one
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
      currentTokens = paragraphTokens;
    } else {
      // Add to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens = combinedTokens;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // Add overlap between chunks
  return addOverlapToChunks(chunks, overlapTokens);
}

function sentenceAwareChunking(text, maxTokensPerChunk, overlapTokens) {
  // Split by sentences (more comprehensive regex)
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*\n+/).filter(s => s.trim());
  
  if (sentences.length === 1) {
    // Single sentence - use word-based chunking as last resort
    return wordBasedChunking(text, maxTokensPerChunk, overlapTokens);
  }
  
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    
    // If single sentence exceeds max tokens, split it
    if (sentenceTokens > maxTokensPerChunk) {
      // Save current chunk if it exists
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split the long sentence
      const subChunks = wordBasedChunking(sentence, maxTokensPerChunk, overlapTokens);
      chunks.push(...subChunks);
      continue;
    }
    
    const combinedTokens = currentTokens + sentenceTokens + (currentChunk ? 5 : 0); // +5 for spacing
    
    if (combinedTokens > maxTokensPerChunk && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentTokens = sentenceTokens;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens = combinedTokens;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return addOverlapToChunks(chunks, overlapTokens);
}

function wordBasedChunking(text, maxTokensPerChunk, overlapTokens) {
  // Fallback: split by words (preserve as much meaning as possible)
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const word of words) {
    const wordTokens = countTokens(word);
    const combinedTokens = currentTokens + wordTokens + 1; // +1 for space
    
    if (combinedTokens > maxTokensPerChunk && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
      currentTokens = wordTokens;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
      currentTokens = combinedTokens;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return addOverlapToChunks(chunks, overlapTokens);
}

function addOverlapToChunks(chunks, overlapTokens) {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks;
  }
  
  const overlappedChunks = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    
    // Add overlap from previous chunk (suffix of previous)
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const prevWords = prevChunk.split(/\s+/);
      const overlapWords = getLastNTokensAsWords(prevWords, overlapTokens);
      
      if (overlapWords.length > 0) {
        chunk = overlapWords.join(' ') + ' ' + chunk;
      }
    }
    
    overlappedChunks.push(chunk);
  }
  
  return overlappedChunks;
}

function getLastNTokensAsWords(words, targetTokens) {
  let tokens = 0;
  let wordIndex = words.length - 1;
  
  // Count backwards until we reach target tokens
  while (wordIndex >= 0 && tokens < targetTokens) {
    tokens += countTokens(words[wordIndex]);
    wordIndex--;
  }
  
  return words.slice(wordIndex + 1);
}

export function getChunkingStats(chunks) {
  const tokenCounts = chunks.map(chunk => countTokens(chunk));
  const wordCounts = chunks.map(chunk => chunk.split(/\s+/).length);
  
  return {
    totalChunks: chunks.length,
    avgTokens: Math.round(tokenCounts.reduce((a, b) => a + b, 0) / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    avgWords: Math.round(wordCounts.reduce((a, b) => a + b, 0) / chunks.length),
    tokenDistribution: {
      under256: tokenCounts.filter(t => t < 256).length,
      between256and512: tokenCounts.filter(t => t >= 256 && t <= 512).length,
      over512: tokenCounts.filter(t => t > 512).length
    }
  };
}