import { initDatabase, allAsync } from './database-vec.js';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';

async function analyzeEmbeddings() {
  console.log(chalk.blue('📊 Embedding Database Analysis'));
  
  await initDatabase();
  
  const spinner = ora('Analyzing embedding database...').start();
  
  // Basic counts
  const noteCount = await allAsync('SELECT COUNT(*) as count FROM notes');
  const embeddingCount = await allAsync('SELECT COUNT(*) as count FROM chunks');
  
  // Note statistics
  const noteLengths = await allAsync(`
    SELECT 
      LENGTH(content) as length,
      LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1 as word_count
    FROM notes 
    WHERE content IS NOT NULL
  `);
  
  // Chunk statistics
  const chunkStats = await allAsync(`
    SELECT 
      LENGTH(chunk_text) as length,
      LENGTH(chunk_text) - LENGTH(REPLACE(chunk_text, ' ', '')) + 1 as word_count,
      chunk_index
    FROM chunks
  `);
  
  // File type analysis
  const fileTypes = await allAsync(`
    SELECT 
      CASE 
        WHEN file_path LIKE '%/%' THEN 
          SUBSTR(file_path, 1, INSTR(file_path, '/') - 1)
        ELSE 'root'
      END as folder,
      COUNT(*) as count
    FROM notes
    GROUP BY folder
    ORDER BY count DESC
  `);
  
  // Content analysis
  const contentPatterns = await allAsync(`
    SELECT 
      SUM(CASE WHEN chunk_text LIKE '%\`\`\`%' THEN 1 ELSE 0 END) as code_blocks,
      SUM(CASE WHEN chunk_text LIKE '%[[%]]%' THEN 1 ELSE 0 END) as wiki_links,
      SUM(CASE WHEN chunk_text LIKE '%#%' THEN 1 ELSE 0 END) as hashtags,
      SUM(CASE WHEN chunk_text LIKE '%http%' THEN 1 ELSE 0 END) as urls,
      COUNT(*) as total_chunks
    FROM chunks
  `);
  
  spinner.succeed('Analysis complete');
  
  // Calculate statistics
  const avgNoteLength = noteLengths.reduce((sum, n) => sum + n.length, 0) / noteLengths.length;
  const avgNoteWords = noteLengths.reduce((sum, n) => sum + n.word_count, 0) / noteLengths.length;
  const avgChunkLength = chunkStats.reduce((sum, c) => sum + c.length, 0) / chunkStats.length;
  const avgChunkWords = chunkStats.reduce((sum, c) => sum + c.word_count, 0) / chunkStats.length;
  
  const maxChunksPerNote = Math.max(...chunkStats.map(c => c.chunk_index)) + 1;
  const avgChunksPerNote = embeddingCount[0].count / noteCount[0].count;
  
  // Display results
  console.log(chalk.green('\n📈 Database Overview:'));
  console.log(`• ${chalk.cyan(noteCount[0].count)} notes`);
  console.log(`• ${chalk.cyan(embeddingCount[0].count)} embedding chunks`);
  console.log(`• ${chalk.cyan(avgChunksPerNote.toFixed(1))} avg chunks per note`);
  console.log(`• ${chalk.cyan(maxChunksPerNote)} max chunks in a single note`);
  
  
  console.log(chalk.green('\n📝 Content Statistics:'));
  console.log(`• Avg note length: ${chalk.cyan(Math.round(avgNoteLength))} chars, ${chalk.cyan(Math.round(avgNoteWords))} words`);
  console.log(`• Avg chunk length: ${chalk.cyan(Math.round(avgChunkLength))} chars, ${chalk.cyan(Math.round(avgChunkWords))} words`);
  
  console.log(chalk.green('\n📁 Folder Distribution:'));
  fileTypes.slice(0, 10).forEach(folder => {
    console.log(`• ${chalk.cyan(folder.folder || 'root')}: ${folder.count} notes`);
  });
  if (fileTypes.length > 10) {
    console.log(`• ... and ${fileTypes.length - 10} more folders`);
  }
  
  console.log(chalk.green('\n🔍 Content Patterns:'));
  const patterns = contentPatterns[0];
  console.log(`• Code blocks: ${chalk.cyan(patterns.code_blocks)} chunks (${(patterns.code_blocks/patterns.total_chunks*100).toFixed(1)}%)`);
  console.log(`• Wiki links: ${chalk.cyan(patterns.wiki_links)} chunks (${(patterns.wiki_links/patterns.total_chunks*100).toFixed(1)}%)`);
  console.log(`• Hashtags: ${chalk.cyan(patterns.hashtags)} chunks (${(patterns.hashtags/patterns.total_chunks*100).toFixed(1)}%)`);
  console.log(`• URLs: ${chalk.cyan(patterns.urls)} chunks (${(patterns.urls/patterns.total_chunks*100).toFixed(1)}%)`);
  
  // Embedding dimension info
  if (embeddingCount[0].count > 0) {
    const sampleEmbedding = await allAsync('SELECT embedding FROM vec_embeddings LIMIT 1');
    const dimensions = new Float32Array(sampleEmbedding[0].embedding.buffer).length;
    
    console.log(chalk.green('\n🧮 Embedding Details:'));
    console.log(`• Vector dimensions: ${chalk.cyan(dimensions)}D`);
    console.log(`• Total vectors: ${chalk.cyan(embeddingCount[0].count)}`);
    console.log(`• Storage size: ~${chalk.cyan(Math.round(embeddingCount[0].count * dimensions * 4 / 1024 / 1024))}MB`);
  }
  
  console.log(chalk.blue('\n🎨 Visualization Suggestions:'));
  console.log('• Use folder/file_name for color coding');
  console.log('• Size points by word_count or char_count');
  console.log('• Filter by has_code, has_links, or chunk_index');
  console.log('• Animate by created_at timestamp');
  console.log('• Facet by folder_depth or relative_position');
  
  // Export ready message
  console.log(chalk.yellow('\n💡 Ready to export?'));
  console.log('• JSON: npm run export -- --format json');
  console.log('• CSV: npm run export -- --format csv');
  console.log('• Python: npm run export -- --format npy');
}

program
  .name('analyze')
  .description('Analyze the embedding database and show statistics')
  .action(async () => {
    await analyzeEmbeddings();
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}