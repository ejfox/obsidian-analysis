import path from 'path';
import { countTokens } from './tokenizer.js';

export function enrichTextWithContext(chunkText, metadata) {
  const {
    noteTitle,
    fileName,
    folderPath,
    chunkIndex,
    totalChunks,
    relativePosition,
    frontmatter
  } = metadata;

  // Build context-rich text for embedding
  let enrichedText = '';

  // Document metadata context with full path hierarchy
  enrichedText += `Document: "${noteTitle || fileName}"`;
  
  // Include full file path for maximum semantic context
  const folders = folderPath.split(path.sep).filter(f => f && f !== '.');
  if (folders.length > 0) {
    enrichedText += ` (location: ${folders.join(' > ')} > ${fileName})`;
    
    // Add semantic hints from folder structure
    const folderTypes = categorizePathComponents(folders);
    if (folderTypes.length > 0) {
      enrichedText += ` [context: ${folderTypes.join(', ')}]`;
    }
  } else {
    enrichedText += ` (location: ${fileName})`;
  }
  
  // Add semantic hints from filename
  const fileType = categorizeFileName(fileName);
  if (fileType) {
    enrichedText += ` [file-type: ${fileType}]`;
  }

  // Position context
  if (totalChunks > 1) {
    const positionDesc = getPositionDescription(relativePosition);
    enrichedText += ` - ${positionDesc} (chunk ${chunkIndex + 1} of ${totalChunks})`;
  }

  // Content type context from frontmatter
  if (frontmatter) {
    const tags = frontmatter.tags || frontmatter.tag;
    if (tags) {
      const tagStr = Array.isArray(tags) ? tags.join(', ') : tags;
      enrichedText += ` - Tags: ${tagStr}`;
    }

    if (frontmatter.type || frontmatter.category) {
      enrichedText += ` - Type: ${frontmatter.type || frontmatter.category}`;
    }

    if (frontmatter.status) {
      enrichedText += ` - Status: ${frontmatter.status}`;
    }
  }

  enrichedText += '\n\n';

  // Add the actual content
  enrichedText += chunkText;

  return enrichedText;
}

export function analyzeChunkContent(text) {
  const analysis = {
    // Basic content detection
    hasCode: /```|`[^`\n]+`/.test(text),
    hasLinks: /\[\[.*?\]\]|\[.*?\]\(.*?\)/.test(text),
    hasTags: /#\w+/.test(text),
    hasHeadings: /^#+\s/m.test(text),
    questionCount: (text.match(/\?/g) || []).length,
    exclamationCount: (text.match(/!/g) || []).length,
    wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
    sentenceCount: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
    
    // Enhanced Markdown-specific detection
    hasCodeBlocks: /```[\s\S]*?```/.test(text),
    hasInlineCode: /`[^`\n]+`/.test(text),
    hasTables: /\|.*\|/.test(text),
    hasLists: /^(\s*[-*+]\s|^\s*\d+\.\s)/m.test(text),
    hasBlockquotes: /^>/m.test(text),
    hasHorizontalRules: /^(\*{3,}|-{3,}|_{3,})$/m.test(text),
    hasObsidianLinks: /\[\[.*?\]\]/.test(text),
    hasMarkdownLinks: /\[.*?\]\(.*?\)/.test(text),
    hasImages: /!\[.*?\]\(.*?\)/.test(text),
    
    // Header analysis
    headerLevel: getHighestHeaderLevel(text),
    headerCount: (text.match(/^#+\s/gm) || []).length,
    
    // List analysis
    listItemCount: (text.match(/^(\s*[-*+]\s|^\s*\d+\.\s)/gm) || []).length,
    
    // Code analysis
    codeLanguages: extractCodeLanguages(text)
  };

  analysis.avgWordLength = analysis.wordCount > 0 
    ? text.replace(/\s+/g, '').length / analysis.wordCount 
    : 0;

  return analysis;
}

function getHighestHeaderLevel(text) {
  const headers = text.match(/^(#+)\s/gm);
  if (!headers) return 0;
  
  return Math.min(...headers.map(h => h.trim().length));
}

function extractCodeLanguages(text) {
  const codeBlocks = text.match(/```(\w+)/g);
  if (!codeBlocks) return [];
  
  return [...new Set(codeBlocks.map(block => block.replace('```', '')))];
}

export function extractNoteMetadata(filePath, content, frontmatter) {
  const fileName = path.basename(filePath, '.md');
  const folderPath = path.dirname(filePath);
  const folders = folderPath.split(path.sep).filter(f => f && f !== '.');
  const folderDepth = folders.length;

  // Extract title with fallback hierarchy
  let title = null;
  
  // 1. Frontmatter title
  if (frontmatter?.title) {
    title = frontmatter.title;
  }
  // 2. First heading
  else {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }
  }
  // 3. Filename
  if (!title) {
    title = fileName.replace(/[-_]/g, ' ');
  }

  return {
    fileName,
    folderPath,
    folders,
    folderDepth,
    title,
    hasFrontmatter: frontmatter && Object.keys(frontmatter).length > 0
  };
}

function getPositionDescription(relativePosition) {
  if (relativePosition < 0.2) return 'beginning';
  if (relativePosition < 0.4) return 'early section';
  if (relativePosition < 0.6) return 'middle section';
  if (relativePosition < 0.8) return 'later section';
  return 'end';
}

function categorizePathComponents(folders) {
  const categories = [];
  
  for (const folder of folders) {
    const lowerFolder = folder.toLowerCase();
    
    // Project categories
    if (lowerFolder.includes('project') || lowerFolder.includes('work')) {
      categories.push('project-work');
    }
    
    // Subject areas
    if (lowerFolder.includes('ai') || lowerFolder.includes('machine') || lowerFolder.includes('ml')) {
      categories.push('artificial-intelligence');
    }
    if (lowerFolder.includes('research') || lowerFolder.includes('paper')) {
      categories.push('research');
    }
    if (lowerFolder.includes('personal') || lowerFolder.includes('journal')) {
      categories.push('personal');
    }
    if (lowerFolder.includes('meeting') || lowerFolder.includes('notes')) {
      categories.push('meeting-notes');
    }
    if (lowerFolder.includes('code') || lowerFolder.includes('programming')) {
      categories.push('programming');
    }
    if (lowerFolder.includes('learning') || lowerFolder.includes('course')) {
      categories.push('learning');
    }
    
    // Time-based
    if (/\d{4}/.test(lowerFolder)) {
      categories.push('dated-content');
    }
    if (lowerFolder.includes('daily') || lowerFolder.includes('weekly')) {
      categories.push('periodic-notes');
    }
    
    // Status
    if (lowerFolder.includes('archive') || lowerFolder.includes('old')) {
      categories.push('archived');
    }
    if (lowerFolder.includes('draft') || lowerFolder.includes('wip')) {
      categories.push('work-in-progress');
    }
  }
  
  return [...new Set(categories)]; // Remove duplicates
}

function categorizeFileName(fileName) {
  const lowerName = fileName.toLowerCase();
  
  // Daily/periodic notes
  if (lowerName.includes('daily') || lowerName.includes('journal')) {
    return 'daily-note';
  }
  if (lowerName.includes('meeting') || lowerName.includes('standup')) {
    return 'meeting-note';
  }
  if (lowerName.includes('todo') || lowerName.includes('task')) {
    return 'task-management';
  }
  
  // Content type
  if (lowerName.includes('readme') || lowerName.includes('index')) {
    return 'index-document';
  }
  if (lowerName.includes('template')) {
    return 'template';
  }
  if (lowerName.includes('quick') || lowerName.includes('scratch')) {
    return 'quick-note';
  }
  
  // Subject hints
  if (lowerName.includes('research') || lowerName.includes('paper')) {
    return 'research-note';
  }
  if (lowerName.includes('code') || lowerName.includes('algorithm')) {
    return 'technical-note';
  }
  
  return null;
}

export function createEmbeddingContext(chunkText, chunkMetadata, noteMetadata) {
  // This is the text that actually gets embedded - rich with context
  const contextualText = enrichTextWithContext(chunkText, {
    ...noteMetadata,
    ...chunkMetadata
  });

  // Content analysis for filtering/visualization
  const contentAnalysis = analyzeChunkContent(chunkText);

  return {
    enrichedText: contextualText,
    ...contentAnalysis,
    tokenCount: countTokens(contextualText)
  };
}