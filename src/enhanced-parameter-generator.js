import fs from 'fs';
import path from 'path';

class EnhancedParameterGenerator {
    constructor() {
        this.k = 10; // Number of clusters
    }

    /**
     * Generate expanded parameter grids for UMAP exploration
     */
    generateExpandedParameterGrid(mode = 'expanded') {
        console.log(`🎯 Generating ${mode} parameter grid...`);
        
        const grids = {
            basic: [
                { n_neighbors: 5, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 5, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 5, min_dist: 0.5, metric: 'cosine' },
                { n_neighbors: 15, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 15, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 15, min_dist: 0.5, metric: 'cosine' },
                { n_neighbors: 30, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 30, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 30, min_dist: 0.5, metric: 'cosine' }
            ],
            expanded: [
                // Core cosine sweep (24 combinations) - smooth transitions
                ...this.generateParameterCombinations([3, 5, 8, 15, 30, 50], [0.0, 0.1, 0.3, 0.5], 'cosine'),
                // Euclidean comparison (12 combinations)
                ...this.generateParameterCombinations([5, 15, 30, 50], [0.0, 0.1, 0.5], 'euclidean'),
                // Manhattan contrast (6 combinations)
                ...this.generateParameterCombinations([5, 30, 50], [0.1, 0.3], 'manhattan'),
                // Fine-grained transitions (14 combinations)
                { n_neighbors: 7, min_dist: 0.05, metric: 'cosine' },
                { n_neighbors: 7, min_dist: 0.15, metric: 'cosine' },
                { n_neighbors: 12, min_dist: 0.07, metric: 'cosine' },
                { n_neighbors: 12, min_dist: 0.25, metric: 'cosine' },
                { n_neighbors: 20, min_dist: 0.2, metric: 'cosine' },
                { n_neighbors: 20, min_dist: 0.35, metric: 'cosine' },
                { n_neighbors: 40, min_dist: 0.4, metric: 'cosine' },
                { n_neighbors: 60, min_dist: 0.6, metric: 'cosine' },
                { n_neighbors: 75, min_dist: 0.8, metric: 'cosine' },
                { n_neighbors: 100, min_dist: 1.0, metric: 'cosine' },
                // Cross-metric explorations
                { n_neighbors: 12, min_dist: 0.7, metric: 'euclidean' },
                { n_neighbors: 25, min_dist: 0.2, metric: 'euclidean' },
                { n_neighbors: 40, min_dist: 0.4, metric: 'euclidean' },
                { n_neighbors: 8, min_dist: 0.2, metric: 'manhattan' }
            ],
            comprehensive: [
                // Full grid search (100+ combinations for deep exploration)
                ...this.generateParameterCombinations(
                    [3, 5, 8, 12, 15, 20, 25, 30, 40, 50, 75, 100], 
                    [0.0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0], 
                    'cosine'
                ),
                ...this.generateParameterCombinations(
                    [5, 15, 30, 50, 100], 
                    [0.0, 0.1, 0.3, 0.5, 0.8], 
                    'euclidean'
                ),
                ...this.generateParameterCombinations(
                    [5, 15, 30, 50], 
                    [0.1, 0.2, 0.4, 0.6], 
                    'manhattan'
                )
            ]
        };
        
        const grid = grids[mode] || grids.expanded;
        console.log(`📐 Generated ${grid.length} parameter combinations for ${mode} mode`);
        return grid;
    }

    generateParameterCombinations(neighbors, distances, metric) {
        const combinations = [];
        for (const n of neighbors) {
            for (const d of distances) {
                combinations.push({ 
                    n_neighbors: n, 
                    min_dist: d, 
                    metric,
                    id: `n${n}_d${d.toFixed(2)}_${metric.slice(0,3)}`
                });
            }
        }
        return combinations;
    }

    /**
     * Generate Python script for expanded UMAP parameter surfing
     */
    generateExpandedUMAPScript(parameterGrid, dataInfo) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        
        return `#!/usr/bin/env python3
"""
Enhanced UMAP Parameter Surfing with ${parameterGrid.length} combinations
Generated on ${new Date().toISOString()}
Mode: ${dataInfo.mode}
Total combinations: ${parameterGrid.length}
"""

import json
import numpy as np
import umap
from datetime import datetime
import time
from tqdm import tqdm

def load_data():
    print("Loading embeddings and metadata...")
    
    with open('${dataInfo.embeddingsFile}', 'r') as f:
        embeddings = np.array(json.load(f))
    
    with open('${dataInfo.metadataFile}', 'r') as f:
        metadata = json.load(f)
    
    return embeddings, metadata

def run_enhanced_umap_parameter_surf():
    embeddings, metadata = load_data()
    enhanced_embeddings = metadata['embeddings']
    community_stats = metadata.get('communityStats', {})
    top_folders = metadata.get('topFolders', [])
    
    print(f"Processing {len(embeddings)} embeddings with {embeddings.shape[1]} dimensions")
    print(f"Community detection: {community_stats.get('n_communities', 'N/A')} communities")
    
    # Enhanced parameter combinations
    parameter_combinations = ${JSON.stringify(parameterGrid, null, 8)}
    
    # Folder color mapping (reuse existing)
    folder_color_map = {}
    for i, folder in enumerate(top_folders):
        folder_color_map[folder] = i
    
    results = []
    
    # Progress tracking
    with tqdm(total=len(parameter_combinations), desc="UMAP Parameter Surfing") as pbar:
        for i, params in enumerate(parameter_combinations):
            pbar.set_description(f"UMAP {params['id']}")
            start_time = time.time()
            
            try:
                # Run UMAP with current parameters
                reducer = umap.UMAP(
                    n_neighbors=params['n_neighbors'],
                    min_dist=params['min_dist'],
                    metric=params['metric'],
                    random_state=42,
                    n_components=2,
                    verbose=False  # Reduce output noise
                )
                
                embedding_2d = reducer.fit_transform(embeddings)
                compute_time = time.time() - start_time
                
                # Prepare data for visualization
                plot_data = []
                for j, (x, y) in enumerate(embedding_2d):
                    item = enhanced_embeddings[j]
                    
                    plot_data.append({
                        'x': float(x),
                        'y': float(y),
                        'title': item['title'],
                        'filePath': item['filePath'],
                        'chunkText': item['chunkText'],
                        'chunkIndex': item['chunkIndex'],
                        'wordCount': item['wordCount'],
                        'relativePosition': item['relativePosition'],
                        'folder': item['folder'],
                        'folderDepth': item['folderDepth'],
                        'folderColor': folder_color_map.get(item['folder'], len(top_folders)),
                        'hasCode': item['hasCode'],
                        'hasLinks': item['hasLinks'],
                        'hasTags': item['hasTags'],
                        'community': item.get('community', 0),
                        'communityColor': item.get('communityColor', 0.5),
                        'communitySize': item.get('communitySize', 1)
                    })
                
                # Store results
                results.append({
                    'parameters': params,
                    'data': plot_data,
                    'metadata': {
                        'computeTime': compute_time,
                        'sampleCount': len(plot_data),
                        'topFolders': top_folders,
                        'parameterString': params['id'],
                        'communityStats': community_stats
                    }
                })
                
                pbar.set_postfix({
                    'time': f"{compute_time:.1f}s",
                    'total': f"{sum(r['metadata']['computeTime'] for r in results):.1f}s"
                })
                
            except Exception as e:
                print(f"Error with parameters {params}: {e}")
                continue
            
            pbar.update(1)
    
    # Export results
    output_data = {
        'timestamp': '${timestamp}',
        'mode': '${dataInfo.mode}',
        'totalSamples': len(embeddings),
        'totalCombinations': len(results),
        'results': results,
        'communityDetection': community_stats,
        'parameterGridInfo': {
            'mode': '${dataInfo.mode}',
            'totalGenerated': ${parameterGrid.length},
            'successfulRuns': len(results),
            'avgComputeTime': sum(r['metadata']['computeTime'] for r in results) / len(results) if results else 0
        }
    }
    
    output_file = 'umap_parameter_surf_${timestamp}.json'
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\\n🎉 Enhanced UMAP parameter surfing complete!")
    print(f"   Output: {output_file}")
    print(f"   Successful combinations: {len(results)}/${parameterGrid.length}")
    print(f"   Total compute time: {sum(r['metadata']['computeTime'] for r in results):.1f}s")
    print(f"   Ready for ${dataInfo.mode} visualization!")

if __name__ == '__main__':
    run_enhanced_umap_parameter_surf()
`;
    }

    /**
     * Create parallel coordinates data preparation
     */
    generateParallelCoordinatesData(umapData, dimensions = 50) {
        console.log(`🔄 Preparing parallel coordinates data with ${dimensions} dimensions...`);
        
        const baseData = umapData.results[0].data;
        
        // Extract feature dimensions (metadata-based for now)
        const features = baseData.map(item => ([
            item.folderDepth || 0,
            item.wordCount / 1000,
            item.relativePosition || 0.5,
            item.hasCode ? 1 : 0,
            item.hasLinks ? 1 : 0,
            item.hasTags ? 1 : 0,
            item.x || 0,
            item.y || 0,
            (item.chunkText?.length || 0) / 1000,
            (item.filePath?.split('/').length || 0) / 10,
            // Add more synthetic dimensions for richer parallel coordinates
            Math.sin(item.wordCount / 100) * 0.5 + 0.5,
            Math.cos(item.relativePosition * Math.PI * 2) * 0.5 + 0.5,
            (item.chunkIndex || 0) / 10,
            // Pad to requested dimensions
            ...Array(Math.max(0, dimensions - 13)).fill(0).map(() => Math.random())
        ]));
        
        return {
            features: features.slice(0, dimensions),
            labels: baseData.map(item => item.title),
            communities: baseData.map(item => item.community || 0),
            communityColors: baseData.map(item => item.communityColor || 0.5),
            metadata: baseData,
            dimensionNames: [
                'Folder Depth', 'Word Count', 'Position', 'Has Code', 'Has Links', 
                'Has Tags', 'UMAP X', 'UMAP Y', 'Text Length', 'Path Depth',
                'Word Freq', 'Position Cycle', 'Chunk Index',
                ...Array(Math.max(0, dimensions - 13)).fill(0).map((_, i) => `Dim ${i + 14}`)
            ].slice(0, dimensions)
        };
    }

    /**
     * Enhanced processing with expanded parameters
     */
    async processEnhancedData(mode = 'expanded') {
        console.log('🚀 Processing with enhanced parameter generation...');
        
        // Load existing data
        const dataPath = '/Users/ejfox/code/obsidian-analysis/exports/umap_parameter_surf_2025-06-13T14:19:30.json';
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // Generate expanded parameter grid
        const expandedParameters = this.generateExpandedParameterGrid(mode);
        
        // Prepare enhanced metadata with parallel coordinates data
        const parallelData = this.generateParallelCoordinatesData(data, 50);
        
        // Enhanced output with both UMAP and parallel coordinates support
        const enhancedData = {
            ...data,
            expandedParameterGrid: {
                mode: mode,
                totalCombinations: expandedParameters.length,
                parameters: expandedParameters,
                description: `${mode} parameter grid with ${expandedParameters.length} combinations`
            },
            parallelCoordinatesData: parallelData,
            generationInfo: {
                timestamp: new Date().toISOString(),
                mode: mode,
                features: ['Enhanced parameter grid', 'Parallel coordinates data', 'Community detection']
            }
        };
        
        // Save enhanced data
        const outputPath = '/Users/ejfox/code/obsidian-analysis/umap-explorer/public/enhanced_umap_data.json';
        fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2));
        
        console.log(`✅ Enhanced data saved to: ${outputPath}`);
        console.log(`📊 Generated:`);
        console.log(`   📐 ${expandedParameters.length} parameter combinations (${mode} mode)`);
        console.log(`   📈 ${parallelData.features.length} samples × ${parallelData.dimensionNames.length} dimensions`);
        console.log(`   🎨 ${data.results.length} existing UMAP results`);
        
        return enhancedData;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'expanded';
    
    console.log(`🎯 Enhanced Parameter Generator - Mode: ${mode}`);
    
    const generator = new EnhancedParameterGenerator();
    await generator.processEnhancedData(mode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default EnhancedParameterGenerator;