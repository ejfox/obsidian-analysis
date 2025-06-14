import fs from 'fs';
import path from 'path';

class SimpleModularityDetector {
    constructor() {
        this.k = 10; // Number of clusters
    }

    // Simple K-means clustering implementation
    kmeans(data, k, maxIterations = 100) {
        const n = data.length;
        const d = data[0].length;
        
        // Initialize centroids randomly
        let centroids = [];
        for (let i = 0; i < k; i++) {
            const centroid = [];
            for (let j = 0; j < d; j++) {
                centroid.push(Math.random() * 2 - 1); // Random values between -1 and 1
            }
            centroids.push(centroid);
        }
        
        let assignments = new Array(n).fill(0);
        
        for (let iter = 0; iter < maxIterations; iter++) {
            // Assign points to nearest centroid
            let changed = false;
            for (let i = 0; i < n; i++) {
                let bestDist = Infinity;
                let bestCluster = 0;
                
                for (let j = 0; j < k; j++) {
                    const dist = this.cosineDistance(data[i], centroids[j]);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestCluster = j;
                    }
                }
                
                if (assignments[i] !== bestCluster) {
                    assignments[i] = bestCluster;
                    changed = true;
                }
            }
            
            if (!changed) break;
            
            // Update centroids
            const clusterSums = new Array(k).fill(null).map(() => new Array(d).fill(0));
            const clusterCounts = new Array(k).fill(0);
            
            for (let i = 0; i < n; i++) {
                const cluster = assignments[i];
                clusterCounts[cluster]++;
                for (let j = 0; j < d; j++) {
                    clusterSums[cluster][j] += data[i][j];
                }
            }
            
            for (let i = 0; i < k; i++) {
                if (clusterCounts[i] > 0) {
                    for (let j = 0; j < d; j++) {
                        centroids[i][j] = clusterSums[i][j] / clusterCounts[i];
                    }
                }
            }
        }
        
        return assignments;
    }
    
    cosineDistance(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) return 1;
        
        const similarity = dotProduct / (normA * normB);
        return 1 - similarity; // Convert similarity to distance
    }
    
    // Calculate pseudo-modularity based on within-cluster vs between-cluster distances
    calculateModularity(data, assignments) {
        const k = Math.max(...assignments) + 1;
        let withinClusterDist = 0;
        let betweenClusterDist = 0;
        let withinCount = 0;
        let betweenCount = 0;
        
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                const dist = this.cosineDistance(data[i], data[j]);
                
                if (assignments[i] === assignments[j]) {
                    withinClusterDist += dist;
                    withinCount++;
                } else {
                    betweenClusterDist += dist;
                    betweenCount++;
                }
            }
        }
        
        const avgWithin = withinCount > 0 ? withinClusterDist / withinCount : 0;
        const avgBetween = betweenCount > 0 ? betweenClusterDist / betweenCount : 1;
        
        // Pseudo-modularity: ratio of between-cluster to within-cluster distance
        const modularity = avgBetween / (avgWithin + avgBetween);
        
        return modularity;
    }
    
    addCommunityColors(embeddings, assignments) {
        const uniqueCommunities = [...new Set(assignments)];
        const communityToColor = {};
        
        uniqueCommunities.forEach((comm, i) => {
            // Spread colors across [0, 1] range for maximum separation
            communityToColor[comm] = uniqueCommunities.length > 1 ? 
                i / (uniqueCommunities.length - 1) : 
                Math.random(); // Random color if only one community
        });
        
        return embeddings.map((item, index) => ({
            ...item,
            community: assignments[index],
            communityColor: communityToColor[assignments[index]],
            communitySize: assignments.filter(a => a === assignments[index]).length
        }));
    }
    
    async processExistingData() {
        console.log('🔍 Processing existing UMAP data with simple modularity detection...');
        
        // Load existing UMAP parameter surfing data
        const dataPath = '/Users/ejfox/code/obsidian-analysis/exports/umap_parameter_surf_2025-06-13T14:19:30.json';
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        console.log(`📊 Loaded ${data.results.length} parameter combinations with ${data.totalSamples} samples`);
        
        // Extract embeddings from the first parameter set for community detection
        const baseData = data.results[0].data;
        const embeddings = baseData.map(item => {
            // Create a simple feature vector from available metadata
            return [
                item.folderDepth || 0,
                item.wordCount / 1000, // Normalize word count
                item.relativePosition || 0.5,
                item.hasCode ? 1 : 0,
                item.hasLinks ? 1 : 0,
                item.hasTags ? 1 : 0,
                // Add position features
                item.x || 0,
                item.y || 0
            ];
        });
        
        console.log('🔢 Running K-means clustering...');
        const assignments = this.kmeans(embeddings, this.k);
        const modularity = this.calculateModularity(embeddings, assignments);
        
        console.log(`✅ Clustering complete: ${this.k} communities, pseudo-modularity: ${modularity.toFixed(4)}`);
        
        // Add community information to all parameter sets
        const enhancedResults = data.results.map(result => ({
            ...result,
            data: this.addCommunityColors(result.data, assignments),
            metadata: {
                ...result.metadata,
                communityStats: {
                    algorithm: 'kmeans_simple',
                    modularity: modularity,
                    n_communities: this.k,
                    community_sizes: this.k
                }
            }
        }));
        
        // Create enhanced output
        const outputData = {
            ...data,
            results: enhancedResults,
            communityDetection: {
                algorithm: 'kmeans_simple',
                modularity: modularity,
                n_communities: this.k,
                timestamp: new Date().toISOString()
            }
        };
        
        // Save enhanced data
        const outputPath = '/Users/ejfox/code/obsidian-analysis/umap-explorer/public/umap_parameter_surf_with_communities.json';
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        
        console.log(`🎉 Enhanced UMAP data saved to: ${outputPath}`);
        console.log(`📊 Community Detection Results:`);
        console.log(`   Algorithm: kmeans_simple`);
        console.log(`   Communities: ${this.k}`);
        console.log(`   Pseudo-modularity: ${modularity.toFixed(4)}`);
        
        return outputData;
    }
}

// Main execution
async function main() {
    const detector = new SimpleModularityDetector();
    await detector.processExistingData();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default SimpleModularityDetector;