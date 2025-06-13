#!/usr/bin/env python3
"""
Example UMAP visualization of Obsidian embeddings
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
    import umap
except ImportError:
    print("Install UMAP with: pip install umap-learn")
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

def create_umap_visualization(embeddings, metadata, output_dir="visualizations"):
    """Create UMAP visualization with multiple color schemes"""
    
    Path(output_dir).mkdir(exist_ok=True)
    
    print(f"Computing UMAP for {embeddings.shape[0]} embeddings...")
    
    # Compute UMAP
    reducer = umap.UMAP(
        n_neighbors=15,
        min_dist=0.1,
        n_components=2,
        metric='cosine',
        random_state=42
    )
    
    embedding_2d = reducer.fit_transform(embeddings)
    
    # Add UMAP coordinates to metadata
    metadata['umap_x'] = embedding_2d[:, 0]
    metadata['umap_y'] = embedding_2d[:, 1]
    
    # Create visualizations
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('UMAP Visualization of Obsidian Note Embeddings', fontsize=16)
    
    # 1. Color by folder
    ax = axes[0, 0]
    unique_folders = metadata['folder_path'].unique()[:10]  # Top 10 folders
    for i, folder in enumerate(unique_folders):
        mask = metadata['folder_path'] == folder
        ax.scatter(metadata[mask]['umap_x'], metadata[mask]['umap_y'], 
                  alpha=0.6, s=20, label=folder[:20])
    ax.set_title('Colored by Folder')
    ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=8)
    
    # 2. Color by word count
    ax = axes[0, 1]
    scatter = ax.scatter(metadata['umap_x'], metadata['umap_y'], 
                        c=metadata['word_count'], alpha=0.6, s=20, cmap='viridis')
    ax.set_title('Colored by Word Count')
    plt.colorbar(scatter, ax=ax)
    
    # 3. Color by chunk position
    ax = axes[0, 2]
    scatter = ax.scatter(metadata['umap_x'], metadata['umap_y'], 
                        c=metadata['relative_position'], alpha=0.6, s=20, cmap='plasma')
    ax.set_title('Colored by Position in Note')
    plt.colorbar(scatter, ax=ax)
    
    # 4. Highlight code chunks
    ax = axes[1, 0]
    code_mask = metadata['has_code']
    ax.scatter(metadata[~code_mask]['umap_x'], metadata[~code_mask]['umap_y'], 
              alpha=0.3, s=15, c='lightgray', label='Text')
    ax.scatter(metadata[code_mask]['umap_x'], metadata[code_mask]['umap_y'], 
              alpha=0.8, s=25, c='red', label='Code')
    ax.set_title('Code vs Text Chunks')
    ax.legend()
    
    # 5. Color by folder depth
    ax = axes[1, 1]
    scatter = ax.scatter(metadata['umap_x'], metadata['umap_y'], 
                        c=metadata['folder_depth'], alpha=0.6, s=20, cmap='coolwarm')
    ax.set_title('Colored by Folder Depth')
    plt.colorbar(scatter, ax=ax)
    
    # 6. Size by note length
    ax = axes[1, 2]
    sizes = np.sqrt(metadata['note_word_count']) * 3  # Scale for visibility
    ax.scatter(metadata['umap_x'], metadata['umap_y'], 
              s=sizes, alpha=0.5, c='blue')
    ax.set_title('Sized by Note Length')
    
    plt.tight_layout()
    plt.savefig(f"{output_dir}/obsidian_umap.png", dpi=300, bbox_inches='tight')
    plt.show()
    
    # Save the enriched data
    metadata.to_csv(f"{output_dir}/embeddings_with_umap.csv", index=False)
    print(f"Saved visualization to {output_dir}/obsidian_umap.png")
    print(f"Saved data with UMAP coordinates to {output_dir}/embeddings_with_umap.csv")
    
    return metadata

def create_interactive_plot(metadata, output_dir="visualizations"):
    """Create interactive plotly visualization"""
    try:
        import plotly.express as px
        import plotly.graph_objects as go
    except ImportError:
        print("Install plotly for interactive plots: pip install plotly")
        return
    
    # Create interactive scatter plot
    fig = px.scatter(
        metadata, 
        x='umap_x', 
        y='umap_y',
        color='folder_path',
        size='word_count',
        hover_data=['note_title', 'chunk_index', 'has_code', 'has_links'],
        title='Interactive UMAP of Obsidian Notes',
        width=1000,
        height=700
    )
    
    fig.update_traces(marker=dict(opacity=0.7))
    fig.write_html(f"{output_dir}/interactive_umap.html")
    print(f"Saved interactive plot to {output_dir}/interactive_umap.html")

def main():
    parser = argparse.ArgumentParser(description='Visualize Obsidian embeddings with UMAP')
    parser.add_argument('--input', default='exports/embeddings_*', 
                       help='Base path to embedding files (without extension)')
    parser.add_argument('--output', default='visualizations',
                       help='Output directory for visualizations')
    
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
    print(f"Metadata columns: {list(metadata.columns)}")
    
    # Create visualizations
    enriched_metadata = create_umap_visualization(embeddings, metadata, args.output)
    create_interactive_plot(enriched_metadata, args.output)
    
    print("\nVisualization complete! 🎨")
    print(f"Check the {args.output}/ directory for your plots.")

if __name__ == "__main__":
    main()