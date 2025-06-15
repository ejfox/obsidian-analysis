import chalk from 'chalk';

/**
 * Simple modularity system for handling expanded UMAP parameter spaces
 * Provides smart navigation and interpolation between parameter combinations
 */

export class UMAPParameterModulator {
  constructor(parameterSurfData) {
    this.data = parameterSurfData;
    this.results = parameterSurfData.results;
    this.parameterSpace = parameterSurfData.parameterSpace;
    
    // Build parameter indices for fast lookup
    this.parameterIndex = new Map();
    this.results.forEach((result, idx) => {
      const key = this.getParameterKey(result.parameters);
      this.parameterIndex.set(key, idx);
    });
    
    // Current state
    this.currentIndex = 0;
    this.interpolationCache = new Map();
  }
  
  getParameterKey(params) {
    return `${params.n_neighbors}_${params.min_dist}_${params.metric}`;
  }
  
  /**
   * Find the nearest parameter combinations for smooth transitions
   */
  findNearestNeighbors(targetParams, count = 4) {
    const distances = this.results.map((result, idx) => {
      const params = result.parameters;
      
      // Weighted distance calculation
      const nDist = Math.abs(params.n_neighbors - targetParams.n_neighbors) / 100;
      const dDist = Math.abs(params.min_dist - targetParams.min_dist);
      const mDist = params.metric === targetParams.metric ? 0 : 1;
      
      // Weights favor min_dist changes for visual continuity
      const distance = nDist * 0.3 + dDist * 0.5 + mDist * 0.2;
      
      return { idx, distance, params };
    });
    
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, count);
  }
  
  /**
   * Interpolate between parameter combinations for smooth transitions
   */
  interpolateEmbeddings(fromIdx, toIdx, t) {
    const cacheKey = `${fromIdx}_${toIdx}_${t.toFixed(2)}`;
    
    if (this.interpolationCache.has(cacheKey)) {
      return this.interpolationCache.get(cacheKey);
    }
    
    const fromData = this.results[fromIdx].data;
    const toData = this.results[toIdx].data;
    
    // Simple linear interpolation of positions
    const interpolated = fromData.map((point, idx) => {
      const toPoint = toData[idx];
      return {
        ...point,
        x: point.x + (toPoint.x - point.x) * t,
        y: point.y + (toPoint.y - point.y) * t,
        // Keep metadata from source
        _interpolated: true,
        _t: t
      };
    });
    
    // Cache for performance
    this.interpolationCache.set(cacheKey, interpolated);
    
    return interpolated;
  }
  
  /**
   * Get parameter combination by various methods
   */
  getByParameters(n_neighbors, min_dist, metric = 'cosine') {
    const key = this.getParameterKey({ n_neighbors, min_dist, metric });
    const idx = this.parameterIndex.get(key);
    
    if (idx !== undefined) {
      return this.results[idx];
    }
    
    // Find nearest if exact match not found
    const nearest = this.findNearestNeighbors({ n_neighbors, min_dist, metric }, 1)[0];
    console.log(chalk.yellow(`⚠️  Exact match not found, using nearest: ${JSON.stringify(nearest.params)}`));
    return this.results[nearest.idx];
  }
  
  /**
   * Navigate parameter space with smooth transitions
   */
  navigateToParameters(targetParams, steps = 10) {
    const currentParams = this.results[this.currentIndex].parameters;
    const targetKey = this.getParameterKey(targetParams);
    const targetIdx = this.parameterIndex.get(targetKey);
    
    if (targetIdx === undefined) {
      console.log(chalk.red('❌ Target parameters not found in grid'));
      return null;
    }
    
    // Generate transition path
    const path = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const interpolated = this.interpolateEmbeddings(this.currentIndex, targetIdx, t);
      
      path.push({
        t,
        data: interpolated,
        fromParams: currentParams,
        toParams: targetParams,
        step: i
      });
    }
    
    this.currentIndex = targetIdx;
    return path;
  }
  
  /**
   * Get suggested parameter exploration paths
   */
  getSuggestedPaths() {
    return [
      {
        name: 'Local to Global Structure',
        description: 'Transition from tight clusters to global overview',
        path: [
          { n_neighbors: 3, min_dist: 0.0, metric: 'cosine' },
          { n_neighbors: 8, min_dist: 0.05, metric: 'cosine' },
          { n_neighbors: 15, min_dist: 0.1, metric: 'cosine' },
          { n_neighbors: 30, min_dist: 0.3, metric: 'cosine' },
          { n_neighbors: 50, min_dist: 0.5, metric: 'cosine' },
          { n_neighbors: 100, min_dist: 0.5, metric: 'cosine' }
        ]
      },
      {
        name: 'Distance Metric Comparison',
        description: 'Compare different distance metrics at same parameters',
        path: [
          { n_neighbors: 30, min_dist: 0.1, metric: 'cosine' },
          { n_neighbors: 30, min_dist: 0.1, metric: 'euclidean' },
          { n_neighbors: 30, min_dist: 0.1, metric: 'manhattan' },
          { n_neighbors: 30, min_dist: 0.1, metric: 'cosine' }
        ]
      },
      {
        name: 'Density Exploration',
        description: 'Vary min_dist to control point spread',
        path: [
          { n_neighbors: 20, min_dist: 0.0, metric: 'cosine' },
          { n_neighbors: 20, min_dist: 0.1, metric: 'cosine' },
          { n_neighbors: 20, min_dist: 0.2, metric: 'cosine' },
          { n_neighbors: 20, min_dist: 0.3, metric: 'cosine' },
          { n_neighbors: 20, min_dist: 0.5, metric: 'cosine' }
        ]
      }
    ];
  }
  
  /**
   * Get parameter statistics
   */
  getParameterStats() {
    const stats = {
      totalCombinations: this.results.length,
      mode: this.data.mode,
      parameterRanges: {
        n_neighbors: {
          min: Math.min(...this.parameterSpace.n_neighbors),
          max: Math.max(...this.parameterSpace.n_neighbors),
          values: this.parameterSpace.n_neighbors
        },
        min_dist: {
          min: Math.min(...this.parameterSpace.min_dist),
          max: Math.max(...this.parameterSpace.min_dist),
          values: this.parameterSpace.min_dist
        },
        metrics: this.parameterSpace.metrics
      },
      computeTimes: {
        total: this.results.reduce((sum, r) => sum + r.metadata.computeTime, 0),
        average: this.results.reduce((sum, r) => sum + r.metadata.computeTime, 0) / this.results.length,
        min: Math.min(...this.results.map(r => r.metadata.computeTime)),
        max: Math.max(...this.results.map(r => r.metadata.computeTime))
      }
    };
    
    return stats;
  }
}

/**
 * Load and initialize UMAP parameter surf data
 */
export async function loadUMAPParameterSurf(filePath) {
  try {
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    console.log(chalk.green(`✅ Loaded UMAP parameter surf with ${data.results.length} combinations`));
    console.log(chalk.blue(`   Mode: ${data.mode}`));
    console.log(chalk.blue(`   Samples: ${data.totalSamples}`));
    
    return new UMAPParameterModulator(data);
  } catch (error) {
    console.error(chalk.red('❌ Failed to load UMAP parameter surf data:'), error);
    throw error;
  }
}

// Export for use in Vue components
export default {
  UMAPParameterModulator,
  loadUMAPParameterSurf
};