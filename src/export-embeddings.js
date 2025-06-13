import { initDatabase, getAllEmbeddingsWithMetadata } from './database-vec.js';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';

function getPositionCategory(relativePosition) {
  if (relativePosition < 0.2) return 'beginning';
  if (relativePosition < 0.4) return 'early';
  if (relativePosition < 0.6) return 'middle';
  if (relativePosition < 0.8) return 'late';
  return 'end';
}

async function exportEmbeddings(format = 'json', outputPath = null) {
  console.log(chalk.blue('📊 Exporting Embeddings for Visualization'));
  
  await initDatabase();
  
  const spinner = ora('Loading embeddings from database...').start();
  
  // Get all embeddings with rich metadata
  const embeddings = await getAllEmbeddingsWithMetadata();
  
  spinner.succeed(`Loaded ${chalk.cyan(embeddings.length)} embeddings`);
  
  if (embeddings.length === 0) {
    console.log(chalk.yellow('No embeddings found. Run `npm run generate` first.'));
    return;
  }
  
  // Process embeddings
  const processSpinner = ora('Processing embeddings...').start();
  
  const processedData = embeddings.map((row, index) => {
    // Parse embedding - handle both JSON strings and raw vectors
    let embeddingArray;
    try {
      // Try parsing as JSON first (our current format)
      embeddingArray = JSON.parse(row.embedding);
    } catch (e) {
      // If that fails, assume it's already a raw vector and convert
      embeddingArray = Array.from(new Float32Array(row.embedding));
    }
    
    // Parse frontmatter if available
    let frontmatter = {};
    if (row.frontmatter_json) {
      try {
        frontmatter = JSON.parse(row.frontmatter_json);
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return {
      id: row.id,
      index: index,
      
      // Embedding vector
      embedding: embeddingArray,
      embedding_dim: embeddingArray.length,
      
      // Text content (both original and enriched)
      text: row.chunk_text,
      enriched_text: row.enriched_text,
      chunk_index: row.chunk_index,
      
      // Note metadata (already extracted)
      note_title: row.title,
      file_name: row.file_name,
      file_path: row.file_path,
      folder_path: row.folder_path,
      folder_depth: row.folder_depth,
      
      // Rich chunk metadata (stored in database)
      token_count: row.token_count,
      word_count: row.word_count,
      sentence_count: row.sentence_count,
      avg_word_length: row.avg_word_length,
      relative_position: row.relative_position,
      
      // Content features (stored in database)
      has_code: Boolean(row.has_code),
      has_links: Boolean(row.has_links),
      has_tags: Boolean(row.has_tags),
      has_headings: Boolean(row.has_headings),
      question_count: row.question_count,
      exclamation_count: row.exclamation_count,
      
      // Note-level metadata
      note_token_count: row.note_token_count,
      total_chunks: row.total_chunks,
      has_frontmatter: Boolean(row.has_frontmatter),
      frontmatter: frontmatter,
      
      // Derived features
      is_first_chunk: row.chunk_index === 0,
      is_last_chunk: row.chunk_index === row.total_chunks - 1,
      chunk_position_category: getPositionCategory(row.relative_position),
      
      // Frontmatter features
      tags: frontmatter.tags || frontmatter.tag || [],
      note_type: frontmatter.type || frontmatter.category || null,
      note_status: frontmatter.status || null,
      
      // Timestamps
      created_at: row.created_at
    };
  });
  
  processSpinner.succeed('Embeddings processed');
  
  // Export data
  const exportSpinner = ora(`Exporting as ${format.toUpperCase()}...`).start();
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const defaultPath = `exports/embeddings_${timestamp}`;
  const finalPath = outputPath || defaultPath;
  
  // Ensure export directory exists
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  
  switch (format.toLowerCase()) {
    case 'json':
      await fs.writeFile(`${finalPath}.json`, JSON.stringify(processedData, null, 2));
      break;
      
    case 'csv':
      const csvData = await generateCSV(processedData);
      await fs.writeFile(`${finalPath}.csv`, csvData);
      break;
      
    case 'npy':
      // Export embeddings matrix and metadata separately
      await exportNumPy(processedData, finalPath);
      break;
      
    case 'pkl':
      // Export for Python/pandas
      await exportPickle(processedData, finalPath);
      break;
      
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  exportSpinner.succeed(`Exported to ${chalk.cyan(finalPath)}`);
  
  // Print summary
  console.log(chalk.green('\n📈 Export Summary:'));
  console.log(`• ${chalk.cyan(processedData.length)} embeddings`);
  console.log(`• ${chalk.cyan(processedData[0].embedding_dim)}D vectors`);
  console.log(`• ${chalk.cyan(new Set(processedData.map(d => d.file_path)).size)} unique notes`);
  console.log(`• ${chalk.cyan(new Set(processedData.map(d => d.model)).size)} model(s): ${[...new Set(processedData.map(d => d.model))].join(', ')}`);
  
  console.log(chalk.blue('\n🎨 Ready for visualization!'));
  console.log(chalk.gray('Try UMAP, t-SNE, or PCA on the embedding vectors'));
  console.log(chalk.gray('Use the metadata for coloring and filtering'));
}

async function generateCSV(data) {
  const headers = Object.keys(data[0]).filter(key => key !== 'embedding');
  const embeddingHeaders = data[0].embedding.map((_, i) => `dim_${i}`);
  
  const csvHeaders = [...headers, ...embeddingHeaders].join(',');
  const csvRows = data.map(row => {
    const metaValues = headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    const embeddingValues = row.embedding;
    return [...metaValues, ...embeddingValues].join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

async function exportNumPy(data, basePath) {
  // For now, export as JSON with instructions
  // In production, you'd use a proper NumPy writer
  const embeddings = data.map(d => d.embedding);
  const metadata = data.map(d => {
    const { embedding, ...meta } = d;
    return meta;
  });
  
  await fs.writeFile(`${basePath}_embeddings.json`, JSON.stringify(embeddings));
  await fs.writeFile(`${basePath}_metadata.json`, JSON.stringify(metadata, null, 2));
  
  // Write Python loading script
  const pythonScript = `
import json
import numpy as np
import pandas as pd

# Load embeddings and metadata
with open('${path.basename(basePath)}_embeddings.json', 'r') as f:
    embeddings = np.array(json.load(f))

with open('${path.basename(basePath)}_metadata.json', 'r') as f:
    metadata = pd.DataFrame(json.load(f))

print(f"Embeddings shape: {embeddings.shape}")
print(f"Metadata shape: {metadata.shape}")

# Example UMAP visualization
# import umap
# reducer = umap.UMAP()
# embedding_2d = reducer.fit_transform(embeddings)
# metadata['umap_x'] = embedding_2d[:, 0]
# metadata['umap_y'] = embedding_2d[:, 1]
`.trim();
  
  await fs.writeFile(`${basePath}_load.py`, pythonScript);
}

async function exportPickle(data, basePath) {
  // Export as JSON with pandas loading script
  await fs.writeFile(`${basePath}.json`, JSON.stringify(data, null, 2));
  
  const pythonScript = `
import json
import pandas as pd
import numpy as np

# Load data
with open('${path.basename(basePath)}.json', 'r') as f:
    data = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(data)

# Extract embeddings to numpy array
embeddings = np.vstack(df['embedding'].values)
df = df.drop('embedding', axis=1)

print(f"DataFrame shape: {df.shape}")
print(f"Embeddings shape: {embeddings.shape}")
print(f"Columns: {list(df.columns)}")

# Save as pickle
df.to_pickle('${path.basename(basePath)}_metadata.pkl')
np.save('${path.basename(basePath)}_embeddings.npy', embeddings)
`.trim();
  
  await fs.writeFile(`${basePath}_convert.py`, pythonScript);
}

program
  .name('export')
  .description('Export embeddings for visualization and analysis')
  .option('-f, --format <format>', 'export format (json, csv, npy, pkl)', 'json')
  .option('-o, --output <path>', 'output file path')
  .action(async (options) => {
    await exportEmbeddings(options.format, options.output);
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}