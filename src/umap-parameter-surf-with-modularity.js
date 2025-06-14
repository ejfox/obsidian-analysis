import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';

class UMAPParameterSurfWithModularity {
    constructor(dbPath = 'database-vec.db') {
        this.db = new Database(dbPath);
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.sampleSize = 2000; // Manageable size for modularity computation
    }

    async sampleEmbeddings() {
        console.log('📊 Sampling embeddings for UMAP parameter exploration...');
        
        const query = `
            SELECT 
                ve.rowid,
                ve.chunk_text,
                ve.embedding,
                m.title,
                m.file_path,
                m.word_count,
                m.chunk_index,
                m.relative_position,
                m.folder,
                m.folder_depth,
                m.has_code,
                m.has_links,
                m.has_tags
            FROM vec_embeddings ve
            JOIN metadata m ON ve.rowid = m.rowid
            ORDER BY RANDOM()
            LIMIT ?
        `;
        
        const rows = this.db.prepare(query).all(this.sampleSize);
        console.log(`✅ Sampled ${rows.length} embeddings`);
        
        return rows.map(row => ({
            chunkText: row.chunk_text,
            title: row.title,
            filePath: row.file_path,
            wordCount: row.word_count,
            chunkIndex: row.chunk_index,
            relativePosition: row.relative_position,
            folder: row.folder,
            folderDepth: row.folder_depth,
            hasCode: Boolean(row.has_code),
            hasLinks: Boolean(row.has_links),
            hasTags: Boolean(row.has_tags),
            embedding: this.parseEmbedding(row.embedding)
        }));
    }

    parseEmbedding(embeddingBlob) {
        const buffer = Buffer.from(embeddingBlob);
        const embedding = [];
        for (let i = 0; i < buffer.length; i += 4) {
            embedding.push(buffer.readFloatLE(i));
        }
        return embedding;
    }

    async detectCommunities(embeddings, algorithm = 'leiden') {
        console.log('🔍 Detecting communities using modularity...');
        
        // Prepare embeddings data for Python script
        const embeddingData = embeddings.map(item => ({
            embedding: item.embedding,
            title: item.title,
            filePath: item.filePath,
            folder: item.folder,
            chunkIndex: item.chunkIndex
        }));
        
        const tempFile = path.join(__dirname, '..', 'temp_embeddings.json');
        const outputFile = path.join(__dirname, '..', 'temp_communities.json');
        
        // Write embeddings to temp file
        fs.writeFileSync(tempFile, JSON.stringify(embeddingData, null, 2));
        
        // Run Python modularity detection
        const pythonScript = path.join(__dirname, 'modularity-detector.py');
        
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                pythonScript,
                tempFile,
                outputFile,
                '--algorithm', algorithm,
                '--k-neighbors', '20'
            ]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data); // Real-time output
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data);
            });
            
            pythonProcess.on('close', (code) => {
                // Clean up temp files
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {}
                
                if (code === 0) {
                    try {
                        const results = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
                        fs.unlinkSync(outputFile); // Clean up
                        resolve(results);
                    } catch (e) {
                        reject(new Error(`Failed to parse Python output: ${e.message}`));
                    }
                } else {
                    reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                }
            });
        });
    }

    mergeCommunityData(embeddings, communityResults) {
        console.log('🔗 Merging community data with embeddings...');
        
        const communityEmbeddings = communityResults.embeddings;
        const stats = communityResults.community_stats;
        
        // Merge community information
        const mergedEmbeddings = embeddings.map((item, index) => ({
            ...item,
            community: communityEmbeddings[index].community,
            communityColor: communityEmbeddings[index].communityColor,
            communitySize: communityEmbeddings[index].communitySize
        }));
        
        console.log(`✅ Merged community data: ${stats.n_communities} communities, modularity: ${stats.modularity.toFixed(4)}`);
        
        return {
            embeddings: mergedEmbeddings,
            stats: stats
        };
    }

    async generateUMAPParameterSurf() {
        console.log('🚀 Starting UMAP parameter surfing with modularity detection...');
        
        try {
            // Sample embeddings
            const embeddings = await this.sampleEmbeddings();
            
            // Detect communities
            const communityResults = await this.detectCommunities(embeddings);
            
            // Merge community data
            const { embeddings: enhancedEmbeddings, stats } = this.mergeCommunityData(embeddings, communityResults);
            
            // Define parameter combinations
            const parameterCombinations = [
                { n_neighbors: 5, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 5, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 5, min_dist: 0.5, metric: 'cosine' },
                { n_neighbors: 15, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 15, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 15, min_dist: 0.5, metric: 'cosine' },
                { n_neighbors: 30, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 30, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 30, min_dist: 0.5, metric: 'cosine' },
                { n_neighbors: 50, min_dist: 0.0, metric: 'cosine' },
                { n_neighbors: 50, min_dist: 0.1, metric: 'cosine' },
                { n_neighbors: 50, min_dist: 0.5, metric: 'cosine' }
            ];
            
            // Get top folders for consistent coloring
            const folderCounts = {};
            enhancedEmbeddings.forEach(item => {
                folderCounts[item.folder] = (folderCounts[item.folder] || 0) + 1;
            });
            
            const topFolders = Object.entries(folderCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([folder]) => folder);
            
            // Generate Python script for UMAP computation
            const pythonScript = this.generatePythonScript(
                enhancedEmbeddings, 
                parameterCombinations, 
                topFolders,
                stats
            );
            
            const scriptPath = path.join(__dirname, '..', 'exports', `umap_input_${this.timestamp}_umap_explorer.py`);
            const dataPath = path.join(__dirname, '..', 'exports', `umap_input_${this.timestamp}_embeddings.json`);
            const metadataPath = path.join(__dirname, '..', 'exports', `umap_input_${this.timestamp}_metadata.json`);
            const outputPath = path.join(__dirname, '..', 'exports', `umap_parameter_surf_${this.timestamp}.json`);
            
            // Write files
            fs.writeFileSync(scriptPath, pythonScript);
            fs.writeFileSync(dataPath, JSON.stringify(enhancedEmbeddings.map(item => item.embedding)));
            fs.writeFileSync(metadataPath, JSON.stringify({
                embeddings: enhancedEmbeddings,
                communityStats: stats,
                parameterCombinations,
                topFolders,
                timestamp: this.timestamp,
                sampleSize: enhancedEmbeddings.length
            }));
            
            console.log(`📁 Generated files:`);
            console.log(`   Python script: ${scriptPath}`);
            console.log(`   Embeddings: ${dataPath}`);
            console.log(`   Metadata: ${metadataPath}`);
            console.log(`\n🔥 Run the Python script to generate UMAP visualizations:`);
            console.log(`   cd ${path.dirname(scriptPath)} && python ${path.basename(scriptPath)}`);
            console.log(`\n📊 Community Detection Results:`);
            console.log(`   Algorithm: ${stats.algorithm}`);
            console.log(`   Communities: ${stats.n_communities}`);
            console.log(`   Modularity: ${stats.modularity.toFixed(4)}`);
            console.log(`   Largest communities: ${Object.entries(stats.community_sizes).sort(([,a], [,b]) => b - a).slice(0, 5).map(([id, size]) => `${id}(${size})`).join(', ')}`);
            
            return {
                scriptPath,
                dataPath,
                metadataPath,
                outputPath,
                communityStats: stats
            };
            
        } catch (error) {
            console.error('❌ Error in UMAP parameter surfing:', error);
            throw error;
        }
    }

    generatePythonScript(embeddings, parameterCombinations, topFolders, communityStats) {
        const folderColorMap = {};
        topFolders.forEach((folder, index) => {
            folderColorMap[folder] = index;
        });

        return `#!/usr/bin/env python3
"""
UMAP Parameter Surfing with Modularity-based Community Detection
Generated on ${new Date().toISOString()}

Community Detection Results:
- Algorithm: ${communityStats.algorithm}
- Communities: ${communityStats.n_communities}
- Modularity: ${communityStats.modularity.toFixed(4)}
"""

import json
import numpy as np
import umap
from datetime import datetime
import time

def load_data():
    print("Loading embeddings and metadata...")
    
    with open('umap_input_${this.timestamp}_embeddings.json', 'r') as f:
        embeddings = np.array(json.load(f))
    
    with open('umap_input_${this.timestamp}_metadata.json', 'r') as f:
        metadata = json.load(f)
    
    return embeddings, metadata

def run_umap_parameter_surf():
    embeddings, metadata = load_data()
    enhanced_embeddings = metadata['embeddings']
    community_stats = metadata['communityStats']
    top_folders = metadata['topFolders']
    
    print(f"Processing {len(embeddings)} embeddings with {embeddings.shape[1]} dimensions")
    print(f"Community detection: {community_stats['n_communities']} communities, modularity: {community_stats['modularity']:.4f}")
    
    # Parameter combinations
    parameter_combinations = ${JSON.stringify(parameterCombinations, null, 8)}
    
    # Folder color mapping
    folder_color_map = ${JSON.stringify(folderColorMap, null, 8)}
    
    results = []
    
    for i, params in enumerate(parameter_combinations):
        print(f"\\n[{i+1}/{len(parameter_combinations)}] Running UMAP with {params}")
        start_time = time.time()
        
        # Run UMAP
        reducer = umap.UMAP(
            n_neighbors=params['n_neighbors'],
            min_dist=params['min_dist'],
            metric=params['metric'],
            random_state=42,
            n_components=2
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
                'community': item['community'],
                'communityColor': item['communityColor'],
                'communitySize': item['communitySize']
            })
        
        # Store results
        param_string = f"N{params['n_neighbors']}_D{params['min_dist']}_{'cos' if params['metric'] == 'cosine' else 'euc'}"
        
        results.append({
            'parameters': params,
            'data': plot_data,
            'metadata': {
                'computeTime': compute_time,
                'sampleCount': len(plot_data),
                'topFolders': top_folders,
                'parameterString': param_string,
                'communityStats': community_stats
            }
        })
        
        print(f"✅ Completed in {compute_time:.2f}s")
    
    # Export results
    output_data = {
        'timestamp': '${this.timestamp}',
        'totalSamples': len(embeddings),
        'results': results,
        'communityDetection': {
            'algorithm': community_stats['algorithm'],
            'modularity': community_stats['modularity'],
            'n_communities': community_stats['n_communities'],
            'community_sizes': community_stats['community_sizes']
        }
    }
    
    output_file = 'umap_parameter_surf_${this.timestamp}.json'
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\\n🎉 UMAP parameter surfing complete!")
    print(f"   Output: {output_file}")
    print(f"   Total combinations: {len(results)}")
    print(f"   Community modularity: {community_stats['modularity']:.4f}")
    print(f"   Ready for visualization in Vue.js!")

if __name__ == '__main__':
    run_umap_parameter_surf()
`;
    }
}

// Main execution
async function main() {
    const surfer = new UMAPParameterSurfWithModularity();
    await surfer.generateUMAPParameterSurf();
}

// Check if this is the main module (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default UMAPParameterSurfWithModularity;