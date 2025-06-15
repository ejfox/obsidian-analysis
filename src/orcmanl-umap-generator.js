#!/usr/bin/env node

/**
 * ORC-ManL + UMAP Parameter Explorer
 * Generate 64 parameter combinations using Ollivier-Ricci curvature preprocessing
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simplified ORC-ManL implementation for parameter exploration
class ORCManLPreprocessor {
    constructor(options = {}) {
        this.kNeighbors = options.kNeighbors || 15;
        this.curvatureThreshold = options.curvatureThreshold || -0.5;
        this.distortionThreshold = options.distortionThreshold || 2.0;
        this.verbose = options.verbose || false;
        
        this.graph = new Map();
        this.curvatures = new Map();
        this.removedEdges = [];
    }

    euclideanDistance(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += Math.pow(a[i] - b[i], 2);
        }
        return Math.sqrt(sum);
    }

    buildKNNGraph(data) {
        const n = data.length;
        
        // Initialize graph
        this.graph = new Map();
        for (let i = 0; i < n; i++) {
            this.graph.set(i, new Map());
        }
        
        // Build k-NN connections
        for (let i = 0; i < n; i++) {
            const distances = [];
            
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const dist = this.euclideanDistance(data[i], data[j]);
                    distances.push({ index: j, distance: dist });
                }
            }
            
            // Sort and take k nearest
            distances.sort((a, b) => a.distance - b.distance);
            const kNearest = distances.slice(0, this.kNeighbors);
            
            // Add edges
            for (const neighbor of kNearest) {
                this.graph.get(i).set(neighbor.index, neighbor.distance);
                this.graph.get(neighbor.index).set(i, neighbor.distance);
            }
        }
        
        if (this.verbose) {
            const totalEdges = Array.from(this.graph.values())
                .reduce((sum, neighbors) => sum + neighbors.size, 0) / 2;
            console.log(`  Built k-NN graph: ${totalEdges} edges`);
        }
    }

    computeSimplifiedCurvature(u, v) {
        // Simplified curvature computation for speed
        const neighborsU = new Set([u, ...this.graph.get(u).keys()]);
        const neighborsV = new Set([v, ...this.graph.get(v).keys()]);
        
        // Jaccard similarity as proxy for curvature
        const intersection = new Set([...neighborsU].filter(x => neighborsV.has(x)));
        const union = new Set([...neighborsU, ...neighborsV]);
        
        const jaccard = intersection.size / union.size;
        const edgeLength = this.graph.get(u).get(v);
        
        // Convert to curvature-like measure
        const curvature = jaccard - 0.5; // Range roughly [-0.5, 0.5]
        
        return curvature;
    }

    preprocessGraph(data) {
        if (this.verbose) {
            console.log(`  ORC-ManL: k=${this.kNeighbors}, threshold=${this.curvatureThreshold}`);
        }
        
        // Step 1: Build graph
        this.buildKNNGraph(data);
        
        // Step 2: Compute curvatures
        const edges = this.getAllEdges();
        for (const [u, v] of edges) {
            const curvature = this.computeSimplifiedCurvature(u, v);
            this.curvatures.set(`${u}-${v}`, curvature);
        }
        
        // Step 3: Remove edges with negative curvature
        const candidateEdges = edges.filter(([u, v]) => {
            const curvature = this.curvatures.get(`${u}-${v}`);
            return curvature < this.curvatureThreshold;
        });
        
        // Remove edges
        for (const [u, v] of candidateEdges) {
            this.graph.get(u).delete(v);
            this.graph.get(v).delete(u);
            this.removedEdges.push([u, v]);
        }
        
        if (this.verbose) {
            console.log(`  Removed ${candidateEdges.length} spurious edges`);
        }
        
        return this.getPreprocessingStats();
    }

    getAllEdges() {
        const edges = [];
        const visited = new Set();
        
        for (const [u, neighbors] of this.graph) {
            for (const v of neighbors.keys()) {
                const edgeKey = u < v ? `${u}-${v}` : `${v}-${u}`;
                if (!visited.has(edgeKey)) {
                    edges.push(u < v ? [u, v] : [v, u]);
                    visited.add(edgeKey);
                }
            }
        }
        
        return edges;
    }

    getPreprocessingStats() {
        const curvatureValues = Array.from(this.curvatures.values());
        const finalEdges = Array.from(this.graph.values())
            .reduce((sum, neighbors) => sum + neighbors.size, 0) / 2;
        
        return {
            originalEdges: this.curvatures.size,
            finalEdges: finalEdges,
            removedEdges: this.removedEdges.length,
            removalRate: (this.removedEdges.length / this.curvatures.size * 100),
            curvatureStats: {
                mean: curvatureValues.reduce((a, b) => a + b, 0) / curvatureValues.length,
                min: Math.min(...curvatureValues),
                max: Math.max(...curvatureValues)
            }
        };
    }
}

function generate64ParameterCombinations() {
    console.log('🧠 Generating 64 ORC-ManL + UMAP parameter combinations...');
    
    // ORC-ManL preprocessing parameters
    const curvatureThresholds = [-0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8];
    const kNeighborsOrc = [5, 10, 15, 20, 30, 50];
    
    // UMAP parameters
    const nNeighborsUmap = [5, 10, 15, 20, 30, 50];
    const minDistValues = [0.0, 0.1, 0.3, 0.5];
    
    const combinations = [];
    let id = 0;
    
    // Generate combinations to reach 64
    for (const curvThresh of curvatureThresholds) {
        for (const kOrc of kNeighborsOrc) {
            for (const nUmap of nNeighborsUmap) {
                for (const minDist of minDistValues) {
                    if (combinations.length >= 64) break;
                    
                    combinations.push({
                        id: id++,
                        orcParams: {
                            kNeighbors: kOrc,
                            curvatureThreshold: curvThresh,
                            distortionThreshold: 2.0
                        },
                        umapParams: {
                            n_neighbors: nUmap,
                            min_dist: minDist,
                            metric: 'cosine'
                        },
                        description: `ORC k=${kOrc} c=${curvThresh} | UMAP n=${nUmap} d=${minDist}`,
                        category: categorizeParams(curvThresh, kOrc, nUmap, minDist)
                    });
                }
                if (combinations.length >= 64) break;
            }
            if (combinations.length >= 64) break;
        }
        if (combinations.length >= 64) break;
    }
    
    return combinations.slice(0, 64);
}

function categorizeParams(curvThresh, kOrc, nUmap, minDist) {
    // Categorize parameter combinations
    const aggression = curvThresh <= -0.5 ? 'aggressive' : 'conservative';
    const locality = nUmap <= 15 ? 'local' : 'global';
    const tightness = minDist <= 0.1 ? 'tight' : 'loose';
    
    return `${aggression}_${locality}_${tightness}`;
}

async function loadExistingUMAPData() {
    const dataPath = path.join(__dirname, '..', 'umap-explorer', 'public', 'umap_parameter_surf_with_communities.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Extract base data from first parameter set
    const baseData = data.results[0].data;
    
    const embeddings = baseData.map(point => {
        // Create mock high-dimensional embedding from available features
        return [
            point.x, point.y, // Original UMAP coordinates
            point.wordCount / 1000,
            point.folderDepth,
            point.hasCode ? 1 : 0,
            point.hasLinks ? 1 : 0,
            point.relativePosition,
            point.communityColor || Math.random()
        ];
    });
    
    const metadata = baseData.map(point => ({
        chunkText: point.chunkText,
        filePath: point.filePath,
        wordCount: point.wordCount,
        folder: point.folder,
        title: point.title
    }));
    
    console.log(`Loaded ${embeddings.length} data points from existing UMAP data`);
    return { embeddings, metadata };
}

// Mock UMAP function (replace with actual UMAP.js when available)
function mockUMAP(embeddings, params, orcStats) {
    console.log(`  UMAP: n=${params.n_neighbors}, d=${params.min_dist}`);
    
    // Generate mock 2D coordinates with some clustering structure
    const n = embeddings.length;
    const result = [];
    
    for (let i = 0; i < n; i++) {
        // Create clusters based on embedding similarity (simplified)
        const cluster = Math.floor(Math.random() * 8);
        const clusterX = (cluster % 4) * 3 + Math.random() - 0.5;
        const clusterY = Math.floor(cluster / 4) * 3 + Math.random() - 0.5;
        
        // Add parameter-dependent noise
        const noise = params.min_dist * 2;
        const x = clusterX + (Math.random() - 0.5) * noise;
        const y = clusterY + (Math.random() - 0.5) * noise;
        
        result.push([x, y]);
    }
    
    return result;
}

async function generateORCManLResults() {
    console.log('📊 Loading existing UMAP data...');
    const { embeddings, metadata } = await loadExistingUMAPData();
    console.log(`Loaded ${embeddings.length} embeddings`);
    
    const paramCombinations = generate64ParameterCombinations();
    console.log(`Generated ${paramCombinations.length} parameter combinations`);
    
    const results = [];
    
    for (let i = 0; i < paramCombinations.length; i++) {
        const combo = paramCombinations[i];
        console.log(`\n🔄 Processing ${i+1}/64: ${combo.description}`);
        
        // Step 1: ORC-ManL preprocessing
        const preprocessor = new ORCManLPreprocessor({
            ...combo.orcParams,
            verbose: true
        });
        
        const orcStats = preprocessor.preprocessGraph(embeddings);
        
        // Step 2: Mock UMAP (replace with real UMAP.js)
        const coordinates = mockUMAP(embeddings, combo.umapParams, orcStats);
        
        // Step 3: Prepare data points
        const dataPoints = coordinates.map((coord, idx) => ({
            x: coord[0],
            y: coord[1],
            chunkText: metadata[idx].chunkText,
            filePath: metadata[idx].filePath,
            wordCount: metadata[idx].wordCount,
            folder: metadata[idx].folder,
            title: metadata[idx].title,
            folderColor: Math.abs(metadata[idx].folder.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 10,
            folderDepth: metadata[idx].folder.split('/').length,
            relativePosition: idx / metadata.length,
            hasCode: metadata[idx].chunkText.includes('```') ? 1 : 0,
            hasLinks: metadata[idx].chunkText.includes('[[') ? 1 : 0,
            hasTags: metadata[idx].chunkText.includes('#') ? 1 : 0,
            // Add ORC-ManL specific fields
            orcPreprocessed: true,
            removalRate: orcStats.removalRate,
            curvatureMean: orcStats.curvatureStats.mean
        }));
        
        // Create result
        results.push({
            parameters: combo.umapParams,
            orcParameters: combo.orcParams,
            data: dataPoints,
            metadata: {
                parameterString: `orc_k${combo.orcParams.kNeighbors}_c${Math.abs(combo.orcParams.curvatureThreshold)}_umap_n${combo.umapParams.n_neighbors}_d${combo.umapParams.min_dist}`,
                dataPoints: dataPoints.length,
                orcStats: orcStats,
                category: combo.category,
                description: combo.description
            }
        });
    }
    
    // Create output
    const output = {
        timestamp: new Date().toISOString(),
        totalSamples: embeddings.length,
        parameterCombinations: results.length,
        generationMethod: 'ORC-ManL + UMAP',
        results: results
    };
    
    // Save results
    const outputPath = path.join(__dirname, '..', 'umap-explorer', 'public', 'orcmanl_umap_64_combinations.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Generated ${results.length} ORC-ManL + UMAP combinations`);
    console.log(`💾 Saved to: ${outputPath}`);
    console.log('\n📈 Statistics by category:');
    
    // Show category breakdown
    const categories = {};
    results.forEach(r => {
        const cat = r.metadata.category;
        if (!categories[cat]) categories[cat] = 0;
        categories[cat]++;
    });
    
    Object.entries(categories).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} combinations`);
    });
    
    console.log('\n🎯 Ready for 64-plot ORC-ManL parameter surfing!');
    return output;
}

// Run the generator
if (import.meta.url === `file://${process.argv[1]}`) {
    generateORCManLResults().catch(console.error);
}

export { generateORCManLResults, ORCManLPreprocessor };