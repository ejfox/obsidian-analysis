#!/usr/bin/env python3
"""
Modularity-based community detection for embedding vectors.
Uses Leiden algorithm for high-quality community detection.
"""

import json
import numpy as np
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any

try:
    import igraph as ig
    import leidenalg as la
    from sklearn.neighbors import kneighbors_graph
    from sklearn.preprocessing import normalize
    from sklearn.cluster import KMeans
except ImportError as e:
    print(f"Missing required packages. Install with:")
    print("pip install python-igraph leidenalg scikit-learn numpy")
    sys.exit(1)


class ModularityDetector:
    """Detects communities in embedding space using various algorithms."""
    
    def __init__(self, k_neighbors: int = 20, algorithm: str = 'leiden'):
        self.k_neighbors = k_neighbors
        self.algorithm = algorithm
        self.communities = None
        self.modularity_score = None
        self.n_communities = None
        
    def build_knn_graph(self, embeddings: np.ndarray) -> ig.Graph:
        """Build k-nearest neighbors graph from embeddings."""
        print(f"Building k-NN graph with k={self.k_neighbors}...")
        
        # Normalize embeddings for cosine similarity
        embeddings_norm = normalize(embeddings, norm='l2')
        
        # Build k-NN graph using cosine distance
        knn_sparse = kneighbors_graph(
            embeddings_norm,
            n_neighbors=self.k_neighbors,
            mode='distance',
            metric='cosine',
            include_self=False
        )
        
        # Convert sparse matrix to edge list
        sources, targets = knn_sparse.nonzero()
        weights = 1.0 - knn_sparse.data  # Convert distance to similarity
        
        # Create igraph
        edges = list(zip(sources.tolist(), targets.tolist()))
        graph = ig.Graph(n=len(embeddings), edges=edges, directed=False)
        graph.es['weight'] = weights.tolist()
        
        print(f"Created graph with {graph.vcount()} nodes and {graph.ecount()} edges")
        return graph
    
    def detect_communities_leiden(self, graph: ig.Graph) -> Tuple[List[int], float]:
        """Use Leiden algorithm for community detection."""
        print("Running Leiden algorithm...")
        
        partition = la.find_partition(
            graph,
            la.ModularityVertexPartition,
            weights='weight',
            n_iterations=10,  # More iterations for better quality
            seed=42  # For reproducibility
        )
        
        communities = partition.membership
        modularity = partition.modularity
        n_communities = len(set(communities))
        
        print(f"Found {n_communities} communities with modularity {modularity:.4f}")
        return communities, modularity
    
    def detect_communities_kmeans(self, embeddings: np.ndarray, n_clusters: int = None) -> Tuple[List[int], float]:
        """Use K-means clustering as fallback."""
        print("Running K-means clustering...")
        
        if n_clusters is None:
            # Estimate number of clusters using rule of thumb
            n_clusters = max(2, min(20, int(np.sqrt(len(embeddings) / 2))))
        
        embeddings_norm = normalize(embeddings, norm='l2')
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        communities = kmeans.fit_predict(embeddings_norm).tolist()
        
        # Calculate pseudo-modularity for k-means
        # This is not true modularity but gives a sense of cluster quality
        inertia = kmeans.inertia_
        max_inertia = len(embeddings) * embeddings.shape[1]  # Worst case
        pseudo_modularity = 1 - (inertia / max_inertia)
        
        print(f"K-means found {n_clusters} clusters with pseudo-modularity {pseudo_modularity:.4f}")
        return communities, pseudo_modularity
    
    def detect_communities(self, embeddings: np.ndarray) -> Dict[str, Any]:
        """Main method to detect communities."""
        try:
            if self.algorithm == 'leiden':
                graph = self.build_knn_graph(embeddings)
                communities, modularity = self.detect_communities_leiden(graph)
            elif self.algorithm == 'kmeans':
                communities, modularity = self.detect_communities_kmeans(embeddings)
            else:
                raise ValueError(f"Unknown algorithm: {self.algorithm}")
            
            self.communities = communities
            self.modularity_score = modularity
            self.n_communities = len(set(communities))
            
            # Calculate community statistics
            community_sizes = {}
            for comm in communities:
                community_sizes[comm] = community_sizes.get(comm, 0) + 1
            
            return {
                'communities': communities,
                'modularity': modularity,
                'n_communities': self.n_communities,
                'community_sizes': community_sizes,
                'algorithm': self.algorithm,
                'k_neighbors': self.k_neighbors if self.algorithm == 'leiden' else None
            }
            
        except Exception as e:
            print(f"Error in community detection: {e}")
            print("Falling back to K-means...")
            communities, modularity = self.detect_communities_kmeans(embeddings)
            self.communities = communities
            self.modularity_score = modularity
            self.n_communities = len(set(communities))
            
            return {
                'communities': communities,
                'modularity': modularity,
                'n_communities': self.n_communities,
                'community_sizes': {i: communities.count(i) for i in set(communities)},
                'algorithm': 'kmeans_fallback',
                'k_neighbors': None
            }


def load_embeddings(embedding_file: str) -> Tuple[np.ndarray, List[Dict]]:
    """Load embeddings and metadata from JSON file."""
    print(f"Loading embeddings from {embedding_file}...")
    
    with open(embedding_file, 'r') as f:
        data = json.load(f)
    
    embeddings = np.array([item['embedding'] for item in data])
    metadata = [
        {k: v for k, v in item.items() if k != 'embedding'} 
        for item in data
    ]
    
    print(f"Loaded {len(embeddings)} embeddings of dimension {embeddings.shape[1]}")
    return embeddings, metadata


def add_community_colors(metadata: List[Dict], communities: List[int], n_communities: int) -> List[Dict]:
    """Add community color information to metadata."""
    # Create color mapping using a spread across [0, 1] for good color separation
    community_to_color = {}
    unique_communities = sorted(set(communities))
    
    for i, comm in enumerate(unique_communities):
        # Spread colors evenly across [0, 1] for maximum contrast
        community_to_color[comm] = i / max(1, len(unique_communities) - 1)
    
    # Add community info to metadata
    enhanced_metadata = []
    for i, meta in enumerate(metadata):
        enhanced_meta = meta.copy()
        enhanced_meta['community'] = communities[i]
        enhanced_meta['communityColor'] = community_to_color[communities[i]]
        enhanced_meta['communitySize'] = communities.count(communities[i])
        enhanced_metadata.append(enhanced_meta)
    
    return enhanced_metadata


def main():
    """Main function for command line usage."""
    if len(sys.argv) < 2:
        print("Usage: python modularity-detector.py <embeddings.json> [output.json] [--algorithm leiden|kmeans] [--k-neighbors 20]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_communities.json')
    
    # Parse arguments
    algorithm = 'leiden'
    k_neighbors = 20
    
    for i, arg in enumerate(sys.argv):
        if arg == '--algorithm' and i + 1 < len(sys.argv):
            algorithm = sys.argv[i + 1]
        elif arg == '--k-neighbors' and i + 1 < len(sys.argv):
            k_neighbors = int(sys.argv[i + 1])
    
    try:
        # Load data
        embeddings, metadata = load_embeddings(input_file)
        
        # Detect communities
        detector = ModularityDetector(k_neighbors=k_neighbors, algorithm=algorithm)
        results = detector.detect_communities(embeddings)
        
        # Enhance metadata with community information
        enhanced_metadata = add_community_colors(
            metadata, 
            results['communities'], 
            results['n_communities']
        )
        
        # Prepare output
        output_data = {
            'embeddings': enhanced_metadata,
            'community_stats': {
                'modularity': results['modularity'],
                'n_communities': results['n_communities'],
                'community_sizes': results['community_sizes'],
                'algorithm': results['algorithm'],
                'k_neighbors': results.get('k_neighbors')
            },
            'timestamp': None,  # Will be set by calling script
            'source_file': Path(input_file).name
        }
        
        # Save results
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"✅ Community detection complete!")
        print(f"   Modularity: {results['modularity']:.4f}")
        print(f"   Communities: {results['n_communities']}")
        print(f"   Algorithm: {results['algorithm']}")
        print(f"   Output: {output_file}")
        
        return output_data
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()