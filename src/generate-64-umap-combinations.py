#!/usr/bin/env python3

"""
Generate 64 UMAP parameter combinations with actual embeddings
"""

import json
import numpy as np
import umap
from sklearn.cluster import KMeans
from pathlib import Path
import sqlite3
from datetime import datetime

def load_embeddings_from_db():
    """Load embeddings from the SQLite database"""
    db_path = Path(__file__).parent.parent / "embeddings.db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get embeddings with metadata - join chunks and embeddings tables
    query = """
    SELECT e.embedding, e.chunk_text, n.file_path, c.word_count, n.folder_path
    FROM embeddings e
    JOIN chunks c ON e.note_id = c.note_id AND e.chunk_index = c.chunk_index
    JOIN notes n ON e.note_id = n.id
    WHERE e.embedding IS NOT NULL
    LIMIT 2000
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    
    print(f"📊 Loaded {len(rows)} embeddings from database")
    
    # Parse embeddings and metadata
    embeddings = []
    metadata = []
    
    for row in rows:
        # Parse the embedding blob
        embedding_blob = row[0]
        embedding = np.frombuffer(embedding_blob, dtype=np.float32)
        
        embeddings.append(embedding)
        metadata.append({
            'chunkText': row[1],
            'filePath': row[2], 
            'wordCount': row[3],
            'folder': row[4]
        })
    
    return np.array(embeddings), metadata

def select_64_parameter_combinations():
    """Select 64 improved parameter combinations for better semantic structure"""
    
    # Based on research, create parameters that preserve semantic continuity
    combinations = []
    
    # n_neighbors: Start from 15 to capture more global structure
    # Higher values preserve semantic relationships better
    n_neighbors_values = [15, 20, 25, 30, 40, 50, 75, 100]
    
    # min_dist: Remove 0.0 which creates artificial tight clusters
    # Start from 0.1 to allow natural spacing between points
    min_dist_values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0]
    
    # Create combinations focusing on interesting transitions
    for n in n_neighbors_values:
        for d in min_dist_values:
            combinations.append({
                'n_neighbors': n,
                'min_dist': d,
                'metric': 'cosine'
            })
            
            # Only add euclidean for key combinations to avoid too many
            if n in [5, 15, 30, 50] and d in [0.1, 0.3]:
                combinations.append({
                    'n_neighbors': n,
                    'min_dist': d,
                    'metric': 'euclidean'
                })
    
    # Take first 64 combinations
    combinations = combinations[:64]
    
    print(f"🎯 Selected {len(combinations)} parameter combinations")
    return combinations

def run_umap_with_params(embeddings, params):
    """Run UMAP with specific parameters for better semantic structure"""
    try:
        reducer = umap.UMAP(
            n_neighbors=params['n_neighbors'],
            min_dist=params['min_dist'],
            metric=params['metric'],
            n_components=2,
            spread=1.5,  # Add spread to prevent over-clustering
            random_state=42,
            verbose=False,
            low_memory=False  # Better quality at cost of memory
        )
        
        embedding_2d = reducer.fit_transform(embeddings)
        return embedding_2d
        
    except Exception as e:
        print(f"❌ UMAP failed for {params}: {e}")
        return None

def detect_communities(embeddings_high_dim, n_clusters=10):
    """Detect communities using K-means clustering on high-dimensional embeddings"""
    # Normalize embeddings for better clustering
    from sklearn.preprocessing import normalize
    embeddings_normalized = normalize(embeddings_high_dim, norm='l2')
    
    # Cluster on high-dimensional space for semantic communities
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=20, max_iter=300)
    community_labels = kmeans.fit_predict(embeddings_normalized)
    
    # Convert to community colors (0-1 range)
    community_colors = community_labels / (n_clusters - 1)
    
    return community_labels, community_colors

def calculate_relative_positions(metadata):
    """Calculate relative positions based on file paths for temporal coloring"""
    file_paths = [item['filePath'] for item in metadata]
    
    # Simple relative positioning based on path hash
    positions = []
    for path in file_paths:
        # Use path hash for consistent relative positioning
        hash_val = hash(path) % 1000
        positions.append(hash_val / 1000.0)
    
    return positions

def main():
    print("🚀 Generating 64 UMAP parameter combinations...")
    
    # Load embeddings
    embeddings, metadata = load_embeddings_from_db()
    print(f"📦 Loaded {len(embeddings)} embeddings of dimension {embeddings.shape[1]}")
    
    # Select parameter combinations
    param_combinations = select_64_parameter_combinations()
    
    # Calculate relative positions once
    relative_positions = calculate_relative_positions(metadata)
    
    # Detect communities once on high-dimensional embeddings (better semantic clustering)
    print("🧠 Detecting semantic communities on high-dimensional embeddings...")
    community_labels, community_colors = detect_communities(embeddings)
    
    results = []
    
    for i, params in enumerate(param_combinations):
        print(f"🔄 Processing combination {i+1}/64: {params}")
        
        # Run UMAP
        embedding_2d = run_umap_with_params(embeddings, params)
        
        if embedding_2d is None:
            continue
        
        # Prepare data points
        data_points = []
        for j, (point, meta) in enumerate(zip(embedding_2d, metadata)):
            data_points.append({
                'x': float(point[0]),
                'y': float(point[1]),
                'chunkText': meta['chunkText'],
                'filePath': meta['filePath'],
                'wordCount': meta['wordCount'],
                'folder': meta['folder'],
                'folderColor': hash(meta['folder']) % 10,
                'folderDepth': len(meta['folder'].split('/')),
                'relativePosition': relative_positions[j],
                'hasCode': 1 if any(word in meta['chunkText'].lower() for word in ['def ', 'function', 'class ', 'import']) else 0,
                'hasLinks': 1 if '[[' in meta['chunkText'] or 'http' in meta['chunkText'] else 0,
                'hasTags': 1 if '#' in meta['chunkText'] else 0,
                'community': int(community_labels[j]),
                'communityColor': float(community_colors[j]),
                'title': Path(meta['filePath']).stem
            })
        
        # Create result entry
        result = {
            'parameters': params,
            'data': data_points,
            'metadata': {
                'parameterString': f"n{params['n_neighbors']}_d{params['min_dist']}_{params['metric']}",
                'dataPoints': len(data_points),
                'communities': len(set(community_labels))
            }
        }
        
        results.append(result)
    
    # Create final output
    output = {
        'timestamp': datetime.now().isoformat(),
        'totalSamples': len(metadata),
        'parameterCombinations': len(results),
        'results': results
    }
    
    # Save to file
    output_path = Path(__file__).parent.parent / "umap-explorer" / "public" / "umap_64_combinations.json"
    
    with open(output_path, 'w') as f:
        json.dump(output, f)
    
    print(f"✅ Generated {len(results)} UMAP combinations")
    print(f"💾 Saved to: {output_path}")
    print("🎯 Ready for 64-plot parameter surfing!")

if __name__ == "__main__":
    main()