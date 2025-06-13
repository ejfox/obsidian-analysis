import { initDatabase, searchSimilar } from './database.js';
import { EmbeddingsClient } from './embeddings-client.js';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

async function searchNotes(query, limit = 10) {
  console.log(chalk.blue('🔍 Searching your Obsidian vault'));
  console.log(chalk.gray(`Query: "${query}"\n`));

  // Initialize
  await initDatabase();
  const embeddingsClient = new EmbeddingsClient();

  // Generate embedding for query
  const spinner = ora('Generating query embedding...').start();
  let queryEmbedding;
  try {
    queryEmbedding = await embeddingsClient.generateEmbedding(query);
    spinner.succeed('Query embedding generated');
  } catch (error) {
    spinner.fail('Failed to generate query embedding');
    console.error(chalk.red('Error:'), error.message);
    return;
  }

  // Search for similar chunks
  const searchSpinner = ora('Searching similar content...').start();
  const results = await searchSimilar(queryEmbedding, limit);
  searchSpinner.succeed(`Found ${results.length} results`);

  // Display results
  console.log(chalk.green(`\n📝 Top ${Math.min(limit, results.length)} results:\n`));
  
  results.forEach((result, index) => {
    const similarity = (result.similarity * 100).toFixed(1);
    const title = result.title || 'Untitled';
    const filePath = result.file_path.split('/').pop();
    
    console.log(chalk.cyan(`${index + 1}. ${title}`));
    console.log(chalk.gray(`   📁 ${filePath} | 🎯 ${similarity}% similarity`));
    console.log(`   ${result.chunk_text.substring(0, 200)}${result.chunk_text.length > 200 ? '...' : ''}`);
    console.log();
  });

  if (results.length === 0) {
    console.log(chalk.yellow('No similar content found. Try a different query or generate embeddings first.'));
  }
}

program
  .name('search')
  .description('Search your Obsidian notes using semantic similarity')
  .argument('<query>', 'search query')
  .option('-l, --limit <number>', 'number of results to return', '10')
  .action(async (query, options) => {
    const limit = parseInt(options.limit);
    await searchNotes(query, limit);
  });

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}