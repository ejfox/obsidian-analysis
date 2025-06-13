import { program } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('obsidian-embeddings')
  .description('Generate and search embeddings for your Obsidian vault')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate embeddings for all notes in your Obsidian vault')
  .action(() => {
    console.log(chalk.blue('🚀 Starting embedding generation...\n'));
    const child = spawn('node', [path.join(__dirname, 'generate-embeddings.js')], {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Embedding generation completed!'));
      } else {
        console.log(chalk.red('\n❌ Embedding generation failed.'));
        process.exit(code);
      }
    });
  });

program
  .command('search <query>')
  .description('Search your notes using semantic similarity')
  .option('-l, --limit <number>', 'number of results to return', '10')
  .action((query, options) => {
    const args = [path.join(__dirname, 'search.js'), query, '--limit', options.limit];
    const child = spawn('node', args, {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      process.exit(code);
    });
  });

program
  .command('export')
  .description('Export embeddings for visualization')
  .option('-f, --format <format>', 'export format (json, csv, npy, pkl)', 'json')
  .option('-o, --output <path>', 'output file path')
  .action((options) => {
    const args = [path.join(__dirname, 'export-embeddings.js')];
    if (options.format) args.push('--format', options.format);
    if (options.output) args.push('--output', options.output);
    
    const child = spawn('node', args, {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      process.exit(code);
    });
  });

program
  .command('analyze')
  .description('Analyze embedding database statistics')
  .action(() => {
    const child = spawn('node', [path.join(__dirname, 'analyze-embeddings.js')], {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      process.exit(code);
    });
  });

program
  .command('status')
  .description('Check system status and configuration')
  .action(async () => {
    console.log(chalk.blue('📊 System Status\n'));
    
    try {
      const { initDatabase, allAsync } = await import('./database.js');
      const { EmbeddingsClient } = await import('./embeddings-client.js');
      
      // Check database
      await initDatabase();
      const noteCount = await allAsync('SELECT COUNT(*) as count FROM notes');
      const embeddingCount = await allAsync('SELECT COUNT(*) as count FROM embeddings');
      
      console.log(chalk.green('✅ Database:'), `${noteCount[0].count} notes, ${embeddingCount[0].count} embeddings`);
      
      // Check LM Studio connection
      const client = new EmbeddingsClient();
      const connectionTest = await client.testConnection();
      
      if (connectionTest.success) {
        console.log(chalk.green('✅ LM Studio:'), `Connected (${connectionTest.modelName})`);
      } else {
        console.log(chalk.red('❌ LM Studio:'), connectionTest.error);
      }
      
      // Check .env configuration
      console.log(chalk.cyan('\n🔧 Configuration:'));
      console.log(`Vault Path: ${process.env.OBSIDIAN_VAULT_PATH || 'Not set'}`);
      console.log(`LM Studio URL: ${process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234 (default)'}`);
      console.log(`Model: ${process.env.NOMIC_MODEL_NAME || 'nomic-embed-text-v1.5 (default)'}`);
      
    } catch (error) {
      console.error(chalk.red('Error checking status:'), error.message);
    }
  });

program.parse();