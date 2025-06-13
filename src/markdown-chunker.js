import { countTokens } from './tokenizer.js';

export function markdownSemanticChunk(text, maxTokensPerChunk = 512, overlapTokens = 128) {
  // Leverage Markdown's natural structure for optimal chunking
  const chunks = [];
  
  // First, split by major headers (# ## ###)
  const sections = splitByHeaders(text);
  
  for (const section of sections) {
    const sectionChunks = procesMarkdownSection(section, maxTokensPerChunk, overlapTokens);
    chunks.push(...sectionChunks);
  }
  
  // Add intelligent overlap that respects Markdown structure
  return addMarkdownAwareOverlap(chunks, overlapTokens);
}

function splitByHeaders(text) {
  // Split by headers while preserving the header in each section
  const lines = text.split('\n');
  const sections = [];
  let currentSection = '';
  let currentLevel = 0;
  
  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      const level = headerMatch[1].length;
      
      // If we hit a header of same or higher level, start new section
      if (currentSection && (level <= currentLevel || currentLevel === 0)) {
        sections.push(currentSection.trim());
        currentSection = line;
        currentLevel = level;
      } else {
        // Sub-header - add to current section
        currentSection += '\n' + line;
        if (currentLevel === 0) currentLevel = level;
      }
    } else {
      currentSection += '\n' + line;
    }
  }
  
  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }
  
  return sections.filter(s => s.trim());
}

function procesMarkdownSection(section, maxTokensPerChunk, overlapTokens) {
  const sectionTokens = countTokens(section);
  
  // If section fits in one chunk, return it
  if (sectionTokens <= maxTokensPerChunk) {
    return [section];
  }
  
  // Parse Markdown elements within the section
  return chunkByMarkdownElements(section, maxTokensPerChunk, overlapTokens);
}

function chunkByMarkdownElements(text, maxTokensPerChunk, overlapTokens) {
  const chunks = [];
  const lines = text.split('\n');
  
  let currentChunk = '';
  let currentTokens = 0;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Detect Markdown elements
    const element = detectMarkdownElement(line, lines, i);
    
    if (element.type !== 'text') {
      // Handle special Markdown elements as units
      const elementText = element.content;
      const elementTokens = countTokens(elementText);
      
      // If element is too large, split it carefully
      if (elementTokens > maxTokensPerChunk) {
        // Save current chunk
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }
        
        // Split large element
        const subChunks = splitLargeMarkdownElement(element, maxTokensPerChunk);
        chunks.push(...subChunks);
        
        i = element.endIndex;
        continue;
      }
      
      // Check if adding element would exceed limit
      if (currentTokens + elementTokens > maxTokensPerChunk && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = elementText;
        currentTokens = elementTokens;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + elementText;
        currentTokens += elementTokens;
      }
      
      i = element.endIndex;
    } else {
      // Regular text line
      const lineTokens = countTokens(line);
      
      if (currentTokens + lineTokens > maxTokensPerChunk && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
        currentTokens = lineTokens;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
        currentTokens += lineTokens;
      }
      
      i++;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function detectMarkdownElement(line, lines, index) {
  // Code blocks
  if (line.startsWith('```')) {
    return detectCodeBlock(lines, index);
  }
  
  // Tables
  if (line.includes('|') && (index === 0 || lines[index + 1]?.includes('|'))) {
    return detectTable(lines, index);
  }
  
  // Lists (including nested)
  if (line.match(/^(\s*[-*+]\s|^s*\d+\.\s)/)) {
    return detectList(lines, index);
  }
  
  // Block quotes
  if (line.startsWith('>')) {
    return detectBlockQuote(lines, index);
  }
  
  // Headers
  if (line.match(/^#{1,6}\s/)) {
    return {
      type: 'header',
      content: line,
      endIndex: index + 1
    };
  }
  
  // Horizontal rules
  if (line.match(/^(\*{3,}|-{3,}|_{3,})$/)) {
    return {
      type: 'hr',
      content: line,
      endIndex: index + 1
    };
  }
  
  // Regular text
  return {
    type: 'text',
    content: line,
    endIndex: index + 1
  };
}

function detectCodeBlock(lines, startIndex) {
  const startLine = lines[startIndex];
  const language = startLine.replace('```', '').trim();
  let content = startLine + '\n';
  let i = startIndex + 1;
  
  while (i < lines.length && !lines[i].startsWith('```')) {
    content += lines[i] + '\n';
    i++;
  }
  
  if (i < lines.length) {
    content += lines[i]; // Closing ```
    i++;
  }
  
  return {
    type: 'code',
    language,
    content: content.trim(),
    endIndex: i
  };
}

function detectTable(lines, startIndex) {
  let content = '';
  let i = startIndex;
  
  while (i < lines.length && lines[i].includes('|')) {
    content += lines[i] + '\n';
    i++;
  }
  
  return {
    type: 'table',
    content: content.trim(),
    endIndex: i
  };
}

function detectList(lines, startIndex) {
  let content = '';
  let i = startIndex;
  const baseIndent = lines[startIndex].match(/^\s*/)[0].length;
  
  while (i < lines.length) {
    const line = lines[i];
    const lineIndent = line.match(/^\s*/)[0].length;
    
    // Continue if it's a list item or indented content
    if (line.match(/^\s*[-*+]\s/) || 
        line.match(/^\s*\d+\.\s/) || 
        (lineIndent > baseIndent && line.trim()) ||
        line.trim() === '') {
      content += line + '\n';
      i++;
    } else {
      break;
    }
  }
  
  return {
    type: 'list',
    content: content.trim(),
    endIndex: i
  };
}

function detectBlockQuote(lines, startIndex) {
  let content = '';
  let i = startIndex;
  
  while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
    content += lines[i] + '\n';
    i++;
  }
  
  return {
    type: 'blockquote',
    content: content.trim(),
    endIndex: i
  };
}

function splitLargeMarkdownElement(element, maxTokensPerChunk) {
  const chunks = [];
  
  if (element.type === 'code') {
    // Split code blocks by logical lines but preserve syntax
    const lines = element.content.split('\n');
    const language = lines[0]; // ```python
    const code = lines.slice(1, -1); // actual code
    const closing = lines[lines.length - 1]; // ```
    
    let currentChunk = language + '\n';
    let currentTokens = countTokens(language);
    
    for (const line of code) {
      const lineTokens = countTokens(line);
      
      if (currentTokens + lineTokens + 10 > maxTokensPerChunk) { // +10 for closing
        currentChunk += closing;
        chunks.push(currentChunk);
        currentChunk = language + '\n' + line + '\n';
        currentTokens = countTokens(language) + lineTokens;
      } else {
        currentChunk += line + '\n';
        currentTokens += lineTokens;
      }
    }
    
    if (currentChunk !== language + '\n') {
      currentChunk += closing;
      chunks.push(currentChunk);
    }
  } else {
    // For other elements, fall back to line-by-line splitting
    const lines = element.content.split('\n');
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const line of lines) {
      const lineTokens = countTokens(line);
      
      if (currentTokens + lineTokens > maxTokensPerChunk && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
        currentTokens = lineTokens;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
        currentTokens += lineTokens;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  }
  
  return chunks;
}

function addMarkdownAwareOverlap(chunks, overlapTokens) {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks;
  }
  
  const overlappedChunks = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    
    // Add overlap from previous chunk
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlap = extractMarkdownOverlap(prevChunk, overlapTokens);
      
      if (overlap) {
        chunk = overlap + '\n\n' + chunk;
      }
    }
    
    overlappedChunks.push(chunk);
  }
  
  return overlappedChunks;
}

function extractMarkdownOverlap(chunk, targetTokens) {
  const lines = chunk.split('\n');
  let overlap = '';
  let tokens = 0;
  
  // Start from the end and work backwards
  for (let i = lines.length - 1; i >= 0 && tokens < targetTokens; i--) {
    const line = lines[i];
    const lineTokens = countTokens(line);
    
    if (tokens + lineTokens <= targetTokens) {
      overlap = line + (overlap ? '\n' + overlap : '');
      tokens += lineTokens;
    } else {
      break;
    }
  }
  
  return overlap;
}

export function getMarkdownChunkingStats(chunks) {
  const tokenCounts = chunks.map(chunk => countTokens(chunk));
  const types = chunks.map(chunk => analyzeMarkdownChunkType(chunk));
  
  return {
    totalChunks: chunks.length,
    avgTokens: Math.round(tokenCounts.reduce((a, b) => a + b, 0) / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    tokenDistribution: {
      under256: tokenCounts.filter(t => t < 256).length,
      between256and512: tokenCounts.filter(t => t >= 256 && t <= 512).length,
      over512: tokenCounts.filter(t => t > 512).length
    },
    contentTypes: {
      hasHeaders: types.filter(t => t.hasHeader).length,
      hasCode: types.filter(t => t.hasCode).length,
      hasLists: types.filter(t => t.hasList).length,
      hasTables: types.filter(t => t.hasTable).length
    }
  };
}

function analyzeMarkdownChunkType(chunk) {
  return {
    hasHeader: /^#{1,6}\s/.test(chunk),
    hasCode: /```/.test(chunk),
    hasList: /^(\s*[-*+]\s|^\s*\d+\.\s)/m.test(chunk),
    hasTable: /\|/.test(chunk),
    hasBlockquote: /^>/m.test(chunk)
  };
}