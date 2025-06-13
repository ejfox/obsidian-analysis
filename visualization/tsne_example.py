#!/usr/bin/env python3
"""
Example t-SNE visualization of Obsidian embeddings
Run this after exporting embeddings with: npm run export -- --format npy
"""

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import argparse

try:
    from sklearn.manifold import TSNE
    from sklearn.decomposition import PCA
except ImportError:
    print("Install scikit-learn with: pip install scikit-learn")
    exit(1)

def load_embeddings(base_path):
    """Load embeddings and metadata from exported files"""
    embeddings_file = f"{base_path}_embeddings.json"
    metadata_file = f"{base_path}_metadata.json"
    
    with open(embeddings_file, 'r') as f:
        embeddings = np.array(json.load(f))
    
    with open(metadata_file, 'r') as f:
        metadata = pd.DataFrame(json.load(f))
    
    return embeddings, metadata

def create_tsne_visualization(embeddings, metadata, output_dir="visualizations", max_samples=5000):
    """Create t-SNE visualization with PCA preprocessing"""
    
    Path(output_dir).mkdir(exist_ok=True)
    
    # Sample data if too large (t-SNE is slow on large datasets)
    if len(embeddings) > max_samples:
        print(f"Sampling {max_samples} embeddings for t-SNE (was {len(embeddings)})")
        indices = np.random.choice(len(embeddings), max_samples, replace=False)
        embeddings = embeddings[indices]
        metadata = metadata.iloc[indices].reset_index(drop=True)
    
    print(f"Computing t-SNE for {embeddings.shape[0]} embeddings...")
    
    # PCA preprocessing (recommended for t-SNE)
    print("Preprocessing with PCA...")
    pca = PCA(n_components=50)
    embeddings_pca = pca.fit_transform(embeddings)
    print(f"PCA explained variance ratio: {pca.explained_variance_ratio_.sum():.3f}")
    
    # Compute t-SNE
    tsne = TSNE(
        n_components=2,
        perplexity=30,
        learning_rate=200,
        n_iter=1000,
        random_state=42,
        verbose=1
    )
    
    embedding_2d = tsne.fit_transform(embeddings_pca)
    
    # Add t-SNE coordinates to metadata
    metadata['tsne_x'] = embedding_2d[:, 0]
    metadata['tsne_y'] = embedding_2d[:, 1]
    
    # Create comprehensive visualization
    fig, axes = plt.subplots(3, 3, figsize=(20, 20))
    fig.suptitle('t-SNE Visualization of Obsidian Note Embeddings', fontsize=20)
    
    # 1. Color by folder
    ax = axes[0, 0]
    unique_folders = metadata['folder_path'].value_counts().head(8).index
    colors = plt.cm.Set3(np.linspace(0, 1, len(unique_folders)))
    for folder, color in zip(unique_folders, colors):
        mask = metadata['folder_path'] == folder
        ax.scatter(metadata[mask]['tsne_x'], metadata[mask]['tsne_y'], 
                  alpha=0.7, s=30, c=[color], label=folder[:15])
    ax.set_title('Colored by Folder', fontsize=14)
    ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
    
    # 2. Color by word count (continuous)
    ax = axes[0, 1]
    scatter = ax.scatter(metadata['tsne_x'], metadata['tsne_y'], 
                        c=metadata['word_count'], alpha=0.7, s=30, cmap='viridis')
    ax.set_title('Colored by Word Count', fontsize=14)
    plt.colorbar(scatter, ax=ax)
    
    # 3. Color by chunk position in note
    ax = axes[0, 2]
    scatter = ax.scatter(metadata['tsne_x'], metadata['tsne_y'], 
                        c=metadata['relative_position'], alpha=0.7, s=30, cmap='plasma')
    ax.set_title('Colored by Position in Note', fontsize=14)
    plt.colorbar(scatter, ax=ax)
    
    # 4. Highlight special content types
    ax = axes[1, 0]
    # Regular text
    regular_mask = ~(metadata['has_code'] | metadata['has_links'] | metadata['has_tags'])
    ax.scatter(metadata[regular_mask]['tsne_x'], metadata[regular_mask]['tsne_y'], 
              alpha=0.4, s=20, c='lightgray', label='Regular text')
    # Code
    code_mask = metadata['has_code']
    ax.scatter(metadata[code_mask]['tsne_x'], metadata[code_mask]['tsne_y'], 
              alpha=0.8, s=40, c='red', label='Code blocks')
    # Links
    links_mask = metadata['has_links']
    ax.scatter(metadata[links_mask]['tsne_x'], metadata[links_mask]['tsne_y'], 
              alpha=0.8, s=35, c='blue', label='Has links')
    # Tags
    tags_mask = metadata['has_tags']
    ax.scatter(metadata[tags_mask]['tsne_x'], metadata[tags_mask]['tsne_y'], 
              alpha=0.8, s=35, c='green', label='Has tags')
    ax.set_title('Content Types', fontsize=14)
    ax.legend()
    
    # 5. Color by note length
    ax = axes[1, 1]
    scatter = ax.scatter(metadata['tsne_x'], metadata['tsne_y'], 
                        c=metadata['note_word_count'], alpha=0.7, s=30, cmap='coolwarm')
    ax.set_title('Colored by Note Length', fontsize=14)
    plt.colorbar(scatter, ax=ax)
    
    # 6. First vs later chunks
    ax = axes[1, 2]
    first_chunk_mask = metadata['is_title_chunk']
    ax.scatter(metadata[~first_chunk_mask]['tsne_x'], metadata[~first_chunk_mask]['tsne_y'], 
              alpha=0.5, s=25, c='lightblue', label='Body chunks')
    ax.scatter(metadata[first_chunk_mask]['tsne_x'], metadata[first_chunk_mask]['tsne_y'], 
              alpha=0.9, s=50, c='darkblue', label='First chunks')
    ax.set_title('First vs Body Chunks', fontsize=14)
    ax.legend()
    
    # 7. Question density
    ax = axes[2, 0]
    scatter = ax.scatter(metadata['tsne_x'], metadata['tsne_y'], 
                        c=metadata['question_density'], alpha=0.7, s=30, cmap='Reds')
    ax.set_title('Question Density', fontsize=14)
    plt.colorbar(scatter, ax=ax)
    
    # 8. Folder depth
    ax = axes[2, 1]
    scatter = ax.scatter(metadata['tsne_x'], metadata['tsne_y'], 
                        c=metadata['folder_depth'], alpha=0.7, s=30, cmap='Spectral')
    ax.set_title('Folder Depth', fontsize=14)
    plt.colorbar(scatter, ax=ax)
    
    # 9. Density plot
    ax = axes[2, 2]
    ax.hexbin(metadata['tsne_x'], metadata['tsne_y'], gridsize=30, cmap='Blues')
    ax.set_title('Density Plot', fontsize=14)
    
    plt.tight_layout()
    plt.savefig(f"{output_dir}/obsidian_tsne.png", dpi=300, bbox_inches='tight')
    plt.show()
    
    # Save the enriched data
    metadata.to_csv(f"{output_dir}/embeddings_with_tsne.csv", index=False)
    print(f"Saved visualization to {output_dir}/obsidian_tsne.png")
    print(f"Saved data with t-SNE coordinates to {output_dir}/embeddings_with_tsne.csv")
    
    return metadata

def create_cluster_analysis(metadata, output_dir="visualizations"):
    """Perform clustering analysis on the t-SNE results"""
    try:
        from sklearn.cluster import KMeans, DBSCAN
    except ImportError:
        print("Clustering analysis requires scikit-learn")
        return
    
    # K-means clustering
    X = metadata[['tsne_x', 'tsne_y']].values
    
    # Try different numbers of clusters
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Cluster Analysis of t-SNE Results', fontsize=16)
    
    cluster_numbers = [5, 10, 15, 20]
    
    for i, n_clusters in enumerate(cluster_numbers):
        ax = axes[i//2, i%2]
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        clusters = kmeans.fit_predict(X)
        
        scatter = ax.scatter(metadata['tsne_x'], metadata['tsne_y'], 
                           c=clusters, alpha=0.7, s=30, cmap='tab20')
        ax.set_title(f'K-means: {n_clusters} clusters')
        
        # Add cluster centers
        centers = kmeans.cluster_centers_
        ax.scatter(centers[:, 0], centers[:, 1], 
                  c='red', marker='x', s=100, linewidths=3)
    
    plt.tight_layout()
    plt.savefig(f"{output_dir}/tsne_clusters.png", dpi=300, bbox_inches='tight')
    plt.show()
    
    # Analyze what's in each cluster (for 10 clusters)
    kmeans = KMeans(n_clusters=10, random_state=42)
    metadata['cluster'] = kmeans.fit_predict(X)
    
    print("\nCluster Analysis (10 clusters):")
    for cluster_id in range(10):
        cluster_data = metadata[metadata['cluster'] == cluster_id]
        
        print(f"\nCluster {cluster_id} ({len(cluster_data)} chunks):")
        
        # Most common folders
        top_folders = cluster_data['folder_path'].value_counts().head(3)
        print(f"  Top folders: {dict(top_folders)}")
        
        # Average characteristics
        avg_words = cluster_data['word_count'].mean()
        avg_position = cluster_data['relative_position'].mean()
        code_pct = (cluster_data['has_code'].sum() / len(cluster_data) * 100)
        
        print(f"  Avg words: {avg_words:.1f}, Avg position: {avg_position:.2f}, Code: {code_pct:.1f}%")
        
        # Sample text
        sample_text = cluster_data['text'].iloc[0][:100] + "..."
        print(f"  Sample: {sample_text}")

def main():
    parser = argparse.ArgumentParser(description='Visualize Obsidian embeddings with t-SNE')
    parser.add_argument('--input', default='exports/embeddings_*', 
                       help='Base path to embedding files (without extension)')
    parser.add_argument('--output', default='visualizations',
                       help='Output directory for visualizations')
    parser.add_argument('--max-samples', type=int, default=5000,
                       help='Maximum number of samples for t-SNE')
    
    args = parser.parse_args()
    
    # Find the most recent export if using wildcard
    if '*' in args.input:
        from glob import glob
        files = glob(args.input + '_metadata.json')
        if not files:
            print("No embedding files found. Run 'npm run export -- --format npy' first.")
            return
        args.input = files[-1].replace('_metadata.json', '')
    
    print(f"Loading embeddings from {args.input}...")
    embeddings, metadata = load_embeddings(args.input)
    
    print(f"Loaded {embeddings.shape[0]} embeddings with {embeddings.shape[1]} dimensions")
    
    # Create visualizations
    enriched_metadata = create_tsne_visualization(embeddings, metadata, args.output, args.max_samples)
    create_cluster_analysis(enriched_metadata, args.output)
    
    print("\nt-SNE visualization complete! 🎨")
    print(f"Check the {args.output}/ directory for your plots.")

if __name__ == "__main__":
    main()