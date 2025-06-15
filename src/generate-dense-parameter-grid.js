#!/usr/bin/env node

/**
 * Generate dense UMAP parameter grid for comprehensive exploration
 * Based on UMAP best practices research
 */

import fs from 'fs';
import path from 'path';

// Define parameter ranges based on research
const parameterRanges = {
  // n_neighbors: balance local vs global structure
  // 2-5: very local, tight clusters
  // 10-20: default range, good balance
  // 30-100: more global structure
  n_neighbors: [2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100],
  
  // min_dist: controls cluster tightness
  // 0.0: very tight clusters, detailed structure
  // 0.1: default, good balance
  // 0.5-1.0: softer, more spread out
  min_dist: [0.0, 0.025, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 1.0],
  
  // metric: different distance measures
  metric: ['cosine', 'euclidean']
};

function generateParameterGrid() {
  const combinations = [];
  
  for (const n_neighbors of parameterRanges.n_neighbors) {
    for (const min_dist of parameterRanges.min_dist) {
      for (const metric of parameterRanges.metric) {
        combinations.push({
          n_neighbors,
          min_dist,
          metric,
          // Add metadata for categorization
          category: categorizeParameters(n_neighbors, min_dist),
          description: describeParameters(n_neighbors, min_dist, metric)
        });
      }
    }
  }
  
  return combinations;
}

function categorizeParameters(n_neighbors, min_dist) {
  // Categorize parameter combinations for easier understanding
  if (n_neighbors <= 5 && min_dist <= 0.1) return 'local_tight';
  if (n_neighbors <= 5 && min_dist > 0.1) return 'local_loose';
  if (n_neighbors >= 30 && min_dist <= 0.1) return 'global_tight';
  if (n_neighbors >= 30 && min_dist > 0.1) return 'global_loose';
  return 'balanced';
}

function describeParameters(n_neighbors, min_dist, metric) {
  const nDesc = n_neighbors <= 5 ? 'very local' :
                n_neighbors <= 15 ? 'local' :
                n_neighbors <= 30 ? 'balanced' : 'global';
  
  const dDesc = min_dist <= 0.05 ? 'very tight' :
                min_dist <= 0.2 ? 'tight' :
                min_dist <= 0.5 ? 'moderate' : 'loose';
  
  return `${nDesc} view, ${dDesc} clusters, ${metric} distance`;
}

function main() {
  console.log('🔬 Generating dense UMAP parameter grid...');
  
  const combinations = generateParameterGrid();
  
  console.log(`📊 Generated ${combinations.length} parameter combinations:`);
  console.log(`  - n_neighbors: ${parameterRanges.n_neighbors.length} values (${Math.min(...parameterRanges.n_neighbors)} to ${Math.max(...parameterRanges.n_neighbors)})`);
  console.log(`  - min_dist: ${parameterRanges.min_dist.length} values (${Math.min(...parameterRanges.min_dist)} to ${Math.max(...parameterRanges.min_dist)})`);
  console.log(`  - metrics: ${parameterRanges.metric.length} options`);
  
  // Group by category for analysis
  const categories = {};
  combinations.forEach(combo => {
    if (!categories[combo.category]) categories[combo.category] = [];
    categories[combo.category].push(combo);
  });
  
  console.log('\n📈 Parameter distribution:');
  Object.entries(categories).forEach(([cat, combos]) => {
    console.log(`  ${cat}: ${combos.length} combinations`);
  });
  
  // Save the parameter grid
  const outputPath = path.join(process.cwd(), 'dense_umap_parameter_grid.json');
  
  const output = {
    timestamp: new Date().toISOString(),
    totalCombinations: combinations.length,
    parameterRanges,
    categories: Object.fromEntries(
      Object.entries(categories).map(([cat, combos]) => [cat, combos.length])
    ),
    combinations: combinations.map(combo => ({
      parameters: {
        n_neighbors: combo.n_neighbors,
        min_dist: combo.min_dist,
        metric: combo.metric
      },
      metadata: {
        category: combo.category,
        description: combo.description,
        parameterString: `n${combo.n_neighbors}_d${combo.min_dist}_${combo.metric}`
      }
    }))
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved parameter grid to: ${outputPath}`);
  
  // Show some interesting combinations to highlight
  console.log('\n🎯 Interesting parameter combinations to explore:');
  
  const highlights = [
    { n_neighbors: 2, min_dist: 0.0, desc: 'Maximum local detail' },
    { n_neighbors: 15, min_dist: 0.1, desc: 'UMAP defaults (balanced)' },
    { n_neighbors: 100, min_dist: 1.0, desc: 'Maximum global view' },
    { n_neighbors: 5, min_dist: 0.5, desc: 'Local clusters, spread out' },
    { n_neighbors: 50, min_dist: 0.0, desc: 'Global structure, tight clusters' }
  ];
  
  highlights.forEach(h => {
    const combo = combinations.find(c => 
      c.n_neighbors === h.n_neighbors && c.min_dist === h.min_dist
    );
    if (combo) {
      console.log(`  ${combo.metadata.parameterString}: ${h.desc}`);
    }
  });
  
  console.log(`\n✨ Total: ${combinations.length} combinations ready for UMAP surfing!`);
  console.log('💡 Next step: Run UMAP with these parameters to generate embeddings');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}