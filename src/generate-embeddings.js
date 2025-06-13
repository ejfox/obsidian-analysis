import { initDatabase, insertNote, insertChunkWithEmbedding } from './database-vec.js';
import { processAllNotes } from './obsidian-parser.js';
import { EmbeddingsClient } from './embeddings-client.js';
import chalk from 'chalk';
import ora from 'ora';

async function main() {
  console.log(chalk.blue('🧠 Obsidian Embeddings Generator'));
  console.log(chalk.gray('Generating embeddings for your Obsidian vault...\n'));

  // Test LM Studio connection
  const spinner = ora('Testing LM Studio connection...').start();
  const embeddingsClient = new EmbeddingsClient();
  
  const connectionTest = await embeddingsClient.testConnection();
  if (!connectionTest.success) {
    spinner.fail(chalk.red('Failed to connect to LM Studio'));
    console.error(chalk.red('Error:'), connectionTest.error);
    console.log(chalk.yellow('\nMake sure:'));
    console.log('• LM Studio is running');
    console.log('• The Nomic embedding model is loaded');
    console.log('• The server is accessible at the configured URL');
    process.exit(1);
  }
  
  spinner.succeed(chalk.green(`Connected to LM Studio (${connectionTest.modelName}, ${connectionTest.embeddingDimensions}D)`));

  // Initialize database
  const dbSpinner = ora('Initializing database...').start();
  await initDatabase();
  dbSpinner.succeed('Database ready');

  // Parse all notes
  const parseSpinner = ora('Parsing Obsidian notes...').start();
  let notes;
  try {
    notes = await processAllNotes();
    parseSpinner.succeed(`Parsed ${chalk.cyan(notes.length)} notes`);
  } catch (error) {
    parseSpinner.fail('Failed to parse notes');
    console.error(chalk.red('Error:'), error.message);
    if (error.message.includes('OBSIDIAN_VAULT_PATH')) {
      console.log(chalk.yellow('\nCreate a .env file with your vault path:'));
      console.log('OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault');
    }
    process.exit(1);
  }

  // Generate embeddings
  let totalChunks = 0;
  let processedChunks = 0;
  
  // Count total chunks
  for (const note of notes) {
    totalChunks += note.chunks.length;
  }
  
  console.log(`\nGenerating embeddings for ${chalk.cyan(totalChunks)} chunks across ${chalk.cyan(notes.length)} notes...`);
  
  const embeddingSpinner = ora('Processing notes...').start();
  
  let successfulNotes = 0;
  let failedNotes = 0;

  for (const note of notes) {
    try {
      embeddingSpinner.text = `Processing note: ${note.title.substring(0, 30)}... (${successfulNotes + failedNotes + 1}/${notes.length})`;
      
      // Validate note data
      if (!note.chunks || note.chunks.length === 0) {
        console.warn(chalk.yellow(`\nSkipping ${note.title}: No valid chunks`));
        failedNotes++;
        continue;
      }
      
      // Insert note into database with enhanced metadata
      const noteData = {
        filePath: note.filePath,
        title: note.title || 'Untitled',
        content: note.content || '',
        fileName: note.fileName || 'unknown',
        folderPath: note.folderPath || '',
        folderDepth: note.folderDepth || 0,
        tokenCount: note.tokenCount || 0,
        totalChunks: note.totalChunks || 0,
        hasFrontmatter: note.hasFrontmatter || false,
        frontmatter: note.frontmatter || {}
      };
      
      let noteId;
      try {
        noteId = await insertNote(noteData);
      } catch (dbError) {
        console.error(chalk.red(`\nDatabase error for ${note.title}:`), dbError.message);
        failedNotes++;
        continue;
      }
      
      // Extract enriched texts for embedding (not the original chunks)
      const enrichedTexts = note.chunks.map(chunk => chunk.enrichedText).filter(text => text && text.trim().length > 0);
      
      if (enrichedTexts.length === 0) {
        console.warn(chalk.yellow(`\nSkipping ${note.title}: No valid enriched texts`));
        failedNotes++;
        continue;
      }
      
      // Generate embeddings for enriched context with retry logic
      let embeddings;
      try {
        embeddings = await embeddingsClient.generateBatchEmbeddings(enrichedTexts);
      } catch (embeddingError) {
        console.error(chalk.red(`\nEmbedding generation failed for ${note.title}:`), embeddingError.message);
        failedNotes++;
        continue;
      }
      
      // Validate embeddings array
      if (!embeddings || embeddings.length !== enrichedTexts.length) {
        console.error(chalk.red(`\nEmbedding count mismatch for ${note.title}: expected ${enrichedTexts.length}, got ${embeddings?.length || 0}`));
        failedNotes++;
        continue;
      }
      
      // Store chunks with embeddings and rich metadata
      let successfulChunks = 0;
      for (let i = 0; i < note.chunks.length; i++) {
        const chunk = note.chunks[i];
        
        // Skip chunks with invalid enriched text
        if (!chunk.enrichedText || chunk.enrichedText.trim().length === 0) {
          continue;
        }
        
        const embeddingIndex = successfulChunks;
        if (embeddings[embeddingIndex]) {
          try {
            const chunkData = {
              noteId,
              chunkIndex: chunk.chunkIndex,
              chunkText: chunk.originalText || '', // Store original text
              enrichedText: chunk.enrichedText, // Store enriched text
              tokenCount: chunk.tokenCount || 0,
              relativePosition: chunk.relativePosition || 0,
              hasCode: chunk.hasCode || false,
              hasLinks: chunk.hasLinks || false,
              hasTags: chunk.hasTags || false,
              hasHeadings: chunk.hasHeadings || false,
              questionCount: chunk.questionCount || 0,
              exclamationCount: chunk.exclamationCount || 0,
              wordCount: chunk.wordCount || 0,
              sentenceCount: chunk.sentenceCount || 0,
              avgWordLength: chunk.avgWordLength || 0
            };
            
            await insertChunkWithEmbedding(chunkData, embeddings[embeddingIndex]);
            successfulChunks++;
            processedChunks++;
          } catch (chunkError) {
            console.warn(chalk.yellow(`\nFailed to store chunk ${i} for ${note.title}:`), chunkError.message);
          }
        }
        
        embeddingSpinner.text = `Processing: ${processedChunks}/${totalChunks} chunks (${note.title.substring(0, 30)}...)`;
      }
      
      if (successfulChunks > 0) {
        successfulNotes++;
      } else {
        failedNotes++;
        console.warn(chalk.yellow(`\nNo chunks successfully processed for ${note.title}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`\nUnexpected error processing ${note.title}:`), error.message);
      failedNotes++;
      
      // Add a small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  embeddingSpinner.succeed(chalk.green(`Generated embeddings for ${processedChunks} chunks from ${successfulNotes} notes!`));
  
  if (failedNotes > 0) {
    console.log(chalk.yellow(`⚠️  ${failedNotes} notes failed to process completely`));
  }
  
  console.log(chalk.green('\n✨ All done! Your Obsidian notes are now embedded and searchable.'));
  console.log(chalk.gray('Run'), chalk.cyan('npm run search'), chalk.gray('to try searching your notes.'));
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});