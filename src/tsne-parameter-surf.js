import { initDatabase, allAsync } from './database-vec.js';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';

// Simple t-SNE implementation for parameter exploration
class SimpleTSNE {
  constructor(options = {}) {
    this.perplexity = options.perplexity || 30;
    this.learningRate = options.learningRate || 200;
    this.maxIter = options.maxIter || 300; // Reduced for parameter surfing
    this.dims = 2;
  }

  // Simplified t-SNE implementation focused on speed for parameter exploration
  async fit(data) {
    const n = data.length;
    const dims = data[0].length;
    
    // Initialize Y randomly
    const Y = Array(n).fill().map(() => 
      Array(this.dims).fill().map(() => (Math.random() - 0.5) * 1e-4)
    );
    
    // Compute pairwise distances in high-dimensional space
    const distances = this.computeDistances(data);
    
    // Compute P matrix (perplexity-based probabilities)
    const P = this.computePMatrix(distances);
    
    // Gradient descent
    let momentum = Array(n).fill().map(() => Array(this.dims).fill(0));
    
    for (let iter = 0; iter < this.maxIter; iter++) {
      // Compute Q matrix (low-dimensional probabilities)
      const Q = this.computeQMatrix(Y);
      
      // Compute gradient
      const grad = this.computeGradient(P, Q, Y);
      
      // Update Y with momentum
      const alpha = iter < 250 ? 0.5 : 0.8;
      const eta = iter < 250 ? this.learningRate : Math.max(this.learningRate * 0.5, 50);
      
      for (let i = 0; i < n; i++) {
        for (let d = 0; d < this.dims; d++) {
          momentum[i][d] = alpha * momentum[i][d] - eta * grad[i][d];
          Y[i][d] += momentum[i][d];
        }
      }
      
      // Early stopping for parameter exploration
      if (iter % 50 === 0 && iter > 0) {
        const cost = this.computeCost(P, Q);
        if (iter > 100 && cost > 100) break; // Diverging
      }
    }
    
    return Y;
  }
  
  computeDistances(data) {
    const n = data.length;
    const distances = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dist = 0;
        for (let k = 0; k < data[i].length; k++) {
          const diff = data[i][k] - data[j][k];
          dist += diff * diff;
        }
        distances[i][j] = distances[j][i] = Math.sqrt(dist);
      }
    }
    
    return distances;
  }
  
  computePMatrix(distances) {
    const n = distances.length;
    const P = Array(n).fill().map(() => Array(n).fill(0));
    
    // Simplified perplexity-based probability computation
    for (let i = 0; i < n; i++) {
      const sigma = this.findSigma(distances[i], this.perplexity);
      let sum = 0;
      
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          P[i][j] = Math.exp(-distances[i][j] * distances[i][j] / (2 * sigma * sigma));
          sum += P[i][j];
        }
      }
      
      // Normalize
      for (let j = 0; j < n; j++) {
        if (i !== j && sum > 0) {
          P[i][j] /= sum;
        }
      }
    }
    
    // Symmetrize
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        P[i][j] = (P[i][j] + P[j][i]) / (2 * n);
        P[i][j] = Math.max(P[i][j], 1e-12);
      }
    }
    
    return P;
  }
  
  findSigma(distances, targetPerplexity) {
    // Binary search for sigma that gives target perplexity
    let sigmaMin = 1e-20;
    let sigmaMax = 1e20;
    let sigma = 1.0;
    
    for (let iter = 0; iter < 50; iter++) {
      let sum = 0;
      let sumLogP = 0;
      
      for (let j = 0; j < distances.length; j++) {
        if (distances[j] > 0) {
          const p = Math.exp(-distances[j] * distances[j] / (2 * sigma * sigma));
          sum += p;
          if (p > 1e-12) {
            sumLogP += p * Math.log(p);
          }
        }
      }
      
      if (sum === 0) {
        sigma = (sigmaMin + sigmaMax) / 2;
        continue;
      }
      
      const entropy = Math.log(sum) - sumLogP / sum;
      const perplexity = Math.pow(2, entropy);
      
      if (Math.abs(perplexity - targetPerplexity) < 1e-4) break;
      
      if (perplexity > targetPerplexity) {
        sigmaMax = sigma;
        sigma = (sigmaMin + sigma) / 2;
      } else {
        sigmaMin = sigma;
        sigma = (sigma + sigmaMax) / 2;
      }
    }
    
    return sigma;
  }
  
  computeQMatrix(Y) {
    const n = Y.length;
    const Q = Array(n).fill().map(() => Array(n).fill(0));
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dist = 0;
        for (let d = 0; d < this.dims; d++) {
          const diff = Y[i][d] - Y[j][d];
          dist += diff * diff;
        }
        const q = 1 / (1 + dist);
        Q[i][j] = Q[j][i] = q;
        sum += 2 * q;
      }
    }
    
    // Normalize
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (sum > 0) {
          Q[i][j] = Math.max(Q[i][j] / sum, 1e-12);
        }
      }
    }
    
    return Q;
  }
  
  computeGradient(P, Q, Y) {
    const n = Y.length;
    const grad = Array(n).fill().map(() => Array(this.dims).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          let dist = 0;
          for (let d = 0; d < this.dims; d++) {
            const diff = Y[i][d] - Y[j][d];
            dist += diff * diff;
          }
          
          const mult = 4 * (P[i][j] - Q[i][j]) / (1 + dist);
          
          for (let d = 0; d < this.dims; d++) {
            grad[i][d] += mult * (Y[i][d] - Y[j][d]);
          }
        }
      }
    }
    
    return grad;
  }
  
  computeCost(P, Q) {
    let cost = 0;
    for (let i = 0; i < P.length; i++) {
      for (let j = 0; j < P[i].length; j++) {
        if (P[i][j] > 1e-12 && Q[i][j] > 1e-12) {
          cost += P[i][j] * Math.log(P[i][j] / Q[i][j]);
        }
      }
    }
    return cost;
  }
}

// PCA for preprocessing
function performPCA(data, components = 50) {
  const n = data.length;
  const d = data[0].length;
  
  // Center the data
  const means = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      means[j] += data[i][j];
    }
  }
  for (let j = 0; j < d; j++) {
    means[j] /= n;
  }
  
  const centered = data.map(row => 
    row.map((val, j) => val - means[j])
  );
  
  // Simple PCA: just take first `components` dimensions after centering
  // (This is a simplification - proper PCA would compute eigenvectors)
  return centered.map(row => row.slice(0, Math.min(components, d)));
}

async function loadEmbeddingsFromDB(maxSamples = 1500) {
  await initDatabase();
  
  const spinner = ora('Loading embeddings from database...').start();
  
  // Get embeddings with metadata
  const embeddings = await allAsync(`
    SELECT 
      c.*,
      n.file_path,
      n.title,
      n.folder_path,
      n.folder_depth
    FROM chunks c
    JOIN notes n ON c.note_id = n.id
    ORDER BY RANDOM()
    LIMIT ?
  `, [maxSamples]);
  
  if (embeddings.length === 0) {
    spinner.fail('No embeddings found');
    return null;
  }
  
  spinner.succeed(`Loaded ${embeddings.length} embeddings`);
  
  // Extract embedding vectors from sqlite-vec
  const spinner2 = ora('Extracting embedding vectors...').start();
  
  const vectors = [];
  const metadata = [];
  
  for (const row of embeddings) {
    try {
      // Get the actual embedding vector from sqlite-vec
      const vectorResult = await allAsync(
        'SELECT embedding FROM vec_embeddings WHERE rowid = ?', 
        [row.id]
      );
      
      if (vectorResult.length > 0) {
        // Convert binary blob to float array
        const buffer = vectorResult[0].embedding;
        const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
        vectors.push(Array.from(floatArray));
        
        metadata.push({
          id: row.id,
          chunk_text: row.chunk_text,
          file_path: row.file_path,
          title: row.title,
          folder_path: row.folder_path || 'root',
          folder_depth: row.folder_depth || 0,
          word_count: row.word_count,
          relative_position: row.relative_position,
          has_code: row.has_code,
          has_links: row.has_links,
          has_tags: row.has_tags,
          chunk_index: row.chunk_index
        });
      }
    } catch (error) {
      // Skip this embedding if there's an error
      continue;
    }
  }
  
  spinner2.succeed(`Extracted ${vectors.length} embedding vectors`);
  
  return { vectors, metadata };
}

async function generateTSNEParameterGrid(maxSamples = 1500) {
  console.log(chalk.blue('🔬 t-SNE Parameter Exploration'));
  
  // Load data
  const data = await loadEmbeddingsFromDB(maxSamples);
  if (!data) return;
  
  const { vectors, metadata } = data;
  
  // PCA preprocessing
  const spinner = ora('Preprocessing with PCA...').start();
  const pcaVectors = performPCA(vectors, 50);
  spinner.succeed('PCA preprocessing complete');
  
  // Define parameter combinations to explore
  const parameterSets = [
    { perplexity: 5, learningRate: 50 },
    { perplexity: 5, learningRate: 200 },
    { perplexity: 5, learningRate: 500 },
    { perplexity: 15, learningRate: 50 },
    { perplexity: 15, learningRate: 200 },
    { perplexity: 15, learningRate: 500 },
    { perplexity: 30, learningRate: 50 },
    { perplexity: 30, learningRate: 200 },
    { perplexity: 30, learningRate: 500 },
    { perplexity: 50, learningRate: 50 },
    { perplexity: 50, learningRate: 200 },
    { perplexity: 50, learningRate: 500 },
    { perplexity: 30, learningRate: 1000 },
    { perplexity: 15, learningRate: 1000 },
    { perplexity: 75, learningRate: 200 },
    { perplexity: 100, learningRate: 200 }
  ];
  
  const results = [];
  
  console.log(chalk.green(`\\n🧮 Computing ${parameterSets.length} t-SNE variations...`));
  
  for (let i = 0; i < parameterSets.length; i++) {
    const { perplexity, learningRate } = parameterSets[i];
    
    const spinner = ora(`Computing t-SNE ${i + 1}/${parameterSets.length}: P=${perplexity}, LR=${learningRate}`).start();
    
    try {
      const startTime = Date.now();
      
      const tsne = new SimpleTSNE({
        perplexity,
        learningRate,
        maxIter: 300
      });
      
      const embedding2d = await tsne.fit(pcaVectors);
      const computeTime = (Date.now() - startTime) / 1000;
      
      // Add color coding for folders
      const folderCounts = {};
      metadata.forEach(m => {
        folderCounts[m.folder_path] = (folderCounts[m.folder_path] || 0) + 1;
      });
      
      const topFolders = Object.entries(folderCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([folder]) => folder);
      
      // Prepare data for regl-scatterplot
      const scatterplotData = embedding2d.map((coords, idx) => {
        const meta = metadata[idx];
        const folderIndex = topFolders.indexOf(meta.folder_path);
        
        return {
          x: coords[0],
          y: coords[1],
          // Metadata for coloring/filtering
          folder: meta.folder_path,
          folderColor: folderIndex >= 0 ? folderIndex : 8, // 8 = "other"
          wordCount: meta.word_count,
          relativePosition: meta.relative_position,
          hasCode: meta.has_code ? 1 : 0,
          hasLinks: meta.has_links ? 1 : 0,
          hasTags: meta.has_tags ? 1 : 0,
          chunkIndex: meta.chunk_index,
          folderDepth: meta.folder_depth,
          // Text for tooltips
          title: meta.title,
          chunkText: meta.chunk_text.substring(0, 100) + '...',
          filePath: meta.file_path
        };
      });
      
      results.push({
        parameters: { perplexity, learningRate },
        data: scatterplotData,
        metadata: {
          computeTime,
          sampleCount: vectors.length,
          topFolders,
          parameterString: `P${perplexity}_LR${learningRate}`
        }
      });
      
      spinner.succeed(`t-SNE ${i + 1}/${parameterSets.length} complete (${computeTime.toFixed(1)}s)`);
      
    } catch (error) {
      spinner.fail(`t-SNE ${i + 1}/${parameterSets.length} failed: ${error.message}`);
    }
  }
  
  // Export results for visualization
  const timestamp = new Date().toISOString().slice(0, 19);
  const outputPath = `exports/tsne_parameter_surf_${timestamp}.json`;
  
  const exportData = {
    timestamp,
    totalSamples: vectors.length,
    results: results.map(r => ({
      parameters: r.parameters,
      metadata: r.metadata,
      data: r.data
    })),
    colorSchemes: {
      folder: {
        name: 'Folder',
        property: 'folderColor',
        type: 'categorical',
        labels: results[0]?.metadata.topFolders.concat(['Other']) || []
      },
      wordCount: {
        name: 'Word Count',
        property: 'wordCount',
        type: 'continuous'
      },
      position: {
        name: 'Position in Note',
        property: 'relativePosition',
        type: 'continuous'
      },
      contentType: {
        name: 'Content Type',
        property: 'hasCode',
        type: 'categorical',
        labels: ['Regular', 'Has Code', 'Has Links', 'Has Tags']
      }
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  
  console.log(chalk.green('\\n✅ t-SNE Parameter Exploration Complete!'));
  console.log(chalk.cyan(`📁 Exported to: ${outputPath}`));
  console.log(chalk.yellow('\\n🎨 Ready for regl-scatterplot visualization!'));
  
  // Print summary
  console.log(chalk.blue('\\n📊 Results Summary:'));
  results.forEach((result, i) => {
    const { perplexity, learningRate } = result.parameters;
    const { computeTime } = result.metadata;
    console.log(`${i + 1}. P=${perplexity}, LR=${learningRate} - ${computeTime.toFixed(1)}s`);
  });
  
  console.log(chalk.green('\\n💡 Next steps:'));
  console.log('• Import this JSON in your Vue.js app');
  console.log('• Use regl-scatterplot to render each parameter set');
  console.log('• Create UI controls to switch between parameter combinations');
  console.log('• Add color scheme toggles for different metadata properties');
  
  return outputPath;
}

// CLI
program
  .name('tsne-parameter-surf')
  .description('Generate t-SNE parameter exploration data for regl-scatterplot')
  .option('-s, --samples <number>', 'maximum samples to use', '1500')
  .action(async (options) => {
    const maxSamples = parseInt(options.samples);
    await generateTSNEParameterGrid(maxSamples);
  });

program.parse();