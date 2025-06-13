import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { EmbeddingsClient } from './embeddings-client.js';
import { getAllNotes } from './obsidian-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runPreflightChecks() {
  console.log(chalk.blue('🚀 Pre-flight Checks for Obsidian Embeddings\n'));

  let allPassed = true;
  const issues = [];

  // 1. Environment Variables
  console.log(chalk.cyan('📋 Checking environment configuration...'));
  
  const requiredEnvVars = [
    'OBSIDIAN_VAULT_PATH',
    'LM_STUDIO_BASE_URL',
    'NOMIC_MODEL_NAME'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      allPassed = false;
      issues.push(`Missing environment variable: ${envVar}`);
      console.log(chalk.red(`  ❌ ${envVar}: Not set`));
    } else {
      console.log(chalk.green(`  ✅ ${envVar}: ${process.env[envVar]}`));
    }
  }

  // 2. Vault Path Validation
  console.log(chalk.cyan('\n📁 Checking Obsidian vault...'));
  
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (vaultPath) {
    try {
      const stats = await fs.stat(vaultPath);
      if (stats.isDirectory()) {
        console.log(chalk.green(`  ✅ Vault directory exists: ${vaultPath}`));
        
        // Check for markdown files
        try {
          const notes = await getAllNotes();
          console.log(chalk.green(`  ✅ Found ${notes.length} markdown files`));
          
          if (notes.length === 0) {
            issues.push('No markdown files found in vault');
            console.log(chalk.yellow('  ⚠️  No markdown files found'));
          }
        } catch (error) {
          allPassed = false;
          issues.push(`Error reading vault: ${error.message}`);
          console.log(chalk.red(`  ❌ Error reading vault: ${error.message}`));
        }
      } else {
        allPassed = false;
        issues.push('Vault path is not a directory');
        console.log(chalk.red(`  ❌ Path is not a directory: ${vaultPath}`));
      }
    } catch (error) {
      allPassed = false;
      issues.push(`Cannot access vault path: ${error.message}`);
      console.log(chalk.red(`  ❌ Cannot access vault: ${error.message}`));
    }
  }

  // 3. sqlite-vec Extension
  console.log(chalk.cyan('\n🗄️  Checking sqlite-vec extension...'));
  
  const vecExtensionPath = path.join(__dirname, '..', 'vec0.dylib');
  try {
    await fs.access(vecExtensionPath);
    console.log(chalk.green(`  ✅ sqlite-vec extension found: ${vecExtensionPath}`));
  } catch (error) {
    allPassed = false;
    issues.push('sqlite-vec extension not found');
    console.log(chalk.red(`  ❌ sqlite-vec extension not found: ${vecExtensionPath}`));
    console.log(chalk.yellow('    Run: curl -L -o sqlite-vec.tar.gz https://github.com/asg017/sqlite-vec/releases/download/v0.1.6/sqlite-vec-0.1.6-loadable-macos-aarch64.tar.gz && tar -xzf sqlite-vec.tar.gz'));
  }

  // 4. Dependencies
  console.log(chalk.cyan('\n📦 Checking dependencies...'));
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    
    try {
      await fs.access(nodeModulesPath);
      console.log(chalk.green('  ✅ node_modules directory exists'));
      
      // Check critical dependencies
      const criticalDeps = ['sqlite3', 'axios', 'js-tiktoken', 'gray-matter'];
      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        try {
          await fs.access(depPath);
          console.log(chalk.green(`  ✅ ${dep} installed`));
        } catch {
          allPassed = false;
          issues.push(`Missing dependency: ${dep}`);
          console.log(chalk.red(`  ❌ ${dep} not installed`));
        }
      }
    } catch {
      allPassed = false;
      issues.push('Dependencies not installed');
      console.log(chalk.red('  ❌ Dependencies not installed. Run: npm install'));
    }
  } catch (error) {
    allPassed = false;
    issues.push(`Cannot read package.json: ${error.message}`);
    console.log(chalk.red(`  ❌ Cannot read package.json: ${error.message}`));
  }

  // 5. LM Studio Connection
  console.log(chalk.cyan('\n🤖 Testing LM Studio connection...'));
  
  try {
    const client = new EmbeddingsClient();
    const connectionTest = await client.testConnection();
    
    if (connectionTest.success) {
      console.log(chalk.green(`  ✅ Connected to LM Studio`));
      console.log(chalk.green(`  ✅ Model: ${connectionTest.modelName}`));
      console.log(chalk.green(`  ✅ Embedding dimensions: ${connectionTest.embeddingDimensions}`));
    } else {
      allPassed = false;
      issues.push(`LM Studio connection failed: ${connectionTest.error}`);
      console.log(chalk.red(`  ❌ Connection failed: ${connectionTest.error}`));
    }
  } catch (error) {
    allPassed = false;
    issues.push(`LM Studio test failed: ${error.message}`);
    console.log(chalk.red(`  ❌ Connection test failed: ${error.message}`));
  }

  // 6. Disk Space Check
  console.log(chalk.cyan('\n💾 Checking disk space...'));
  
  try {
    const stats = await fs.stat('.');
    // Basic check - we can't easily get disk space in Node.js without external deps
    console.log(chalk.green('  ✅ Current directory accessible'));
    console.log(chalk.yellow('  ⚠️  Manual check: Ensure sufficient disk space for embeddings database'));
  } catch (error) {
    allPassed = false;
    issues.push(`Disk access error: ${error.message}`);
    console.log(chalk.red(`  ❌ Disk access error: ${error.message}`));
  }

  // 7. Write Permissions
  console.log(chalk.cyan('\n✍️  Testing write permissions...'));
  
  const testFile = path.join(__dirname, '..', 'test-write-permissions.tmp');
  try {
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    console.log(chalk.green('  ✅ Write permissions confirmed'));
  } catch (error) {
    allPassed = false;
    issues.push(`Write permission error: ${error.message}`);
    console.log(chalk.red(`  ❌ Write permission error: ${error.message}`));
  }

  // Summary
  console.log(chalk.blue('\n📊 Pre-flight Summary:'));
  
  if (allPassed) {
    console.log(chalk.green('🎉 All checks passed! Ready for embedding generation.'));
    console.log(chalk.gray('\nRun:'), chalk.cyan('npm run generate'), chalk.gray('to start processing your vault.'));
    return true;
  } else {
    console.log(chalk.red('❌ Some checks failed. Please fix the following issues:'));
    issues.forEach(issue => {
      console.log(chalk.red(`  • ${issue}`));
    });
    console.log(chalk.yellow('\nFix these issues before running the embedding generation.'));
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPreflightChecks()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red('Pre-flight check crashed:'), error);
      process.exit(1);
    });
}

export { runPreflightChecks };