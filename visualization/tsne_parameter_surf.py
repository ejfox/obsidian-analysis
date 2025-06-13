#!/usr/bin/env python3
"""
t-SNE Parameter Surfing for Obsidian embeddings
Creates a grid of t-SNE visualizations with different parameter combinations
so you can visually compare and choose the best clustering.

Run this after exporting embeddings with: npm run export -- --format npy
"""

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import argparse
from itertools import product
import time

try:
    from sklearn.manifold import TSNE
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler
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

def create_tsne_parameter_grid(embeddings, metadata, output_dir="visualizations", 
                              max_samples=2000, grid_size=(4, 6)):
    """Create a grid of t-SNE visualizations with different parameters"""
    
    Path(output_dir).mkdir(exist_ok=True)
    
    # Sample data if too large (t-SNE is slow on large datasets)
    if len(embeddings) > max_samples:
        print(f"Sampling {max_samples} embeddings for parameter grid (was {len(embeddings)})")
        indices = np.random.choice(len(embeddings), max_samples, replace=False)
        embeddings = embeddings[indices]
        metadata = metadata.iloc[indices].reset_index(drop=True)
    
    # PCA preprocessing (recommended for t-SNE)
    print("Preprocessing with PCA...")
    pca = PCA(n_components=50)
    embeddings_pca = pca.fit_transform(embeddings)
    print(f"PCA explained variance ratio: {pca.explained_variance_ratio_.sum():.3f}")
    
    # Define parameter combinations to explore
    perplexities = [5, 15, 30, 50]
    learning_rates = [10, 50, 200, 500, 1000, 2000]
    
    # Create the parameter combinations
    param_combinations = list(product(perplexities, learning_rates))
    
    # Limit to grid size
    n_plots = grid_size[0] * grid_size[1]
    if len(param_combinations) > n_plots:
        # Select a good spread of parameters
        selected_indices = np.linspace(0, len(param_combinations)-1, n_plots, dtype=int)
        param_combinations = [param_combinations[i] for i in selected_indices]
    
    print(f"Computing t-SNE for {len(param_combinations)} parameter combinations...")
    
    # Create the grid
    fig, axes = plt.subplots(grid_size[0], grid_size[1], figsize=(24, 16))
    fig.suptitle(f't-SNE Parameter Exploration ({embeddings.shape[0]} samples)', fontsize=20)
    
    # Flatten axes for easier indexing
    axes_flat = axes.flatten()
    
    # Color by folder for consistency across plots
    unique_folders = metadata['folder_path'].value_counts().head(8).index
    folder_colors = dict(zip(unique_folders, plt.cm.Set3(np.linspace(0, 1, len(unique_folders)))))
    
    results = []
    
    for i, (perplexity, learning_rate) in enumerate(param_combinations):
        if i >= len(axes_flat):
            break
            
        ax = axes_flat[i]
        
        print(f"Computing t-SNE {i+1}/{len(param_combinations)}: perplexity={perplexity}, lr={learning_rate}")
        
        start_time = time.time()
        
        # Compute t-SNE with current parameters
        tsne = TSNE(
            n_components=2,
            perplexity=perplexity,
            learning_rate=learning_rate,
            n_iter=1000,
            random_state=42,
            verbose=0
        )
        
        try:
            embedding_2d = tsne.fit_transform(embeddings_pca)
            compute_time = time.time() - start_time
            
            # Plot colored by folder
            for folder in unique_folders:
                mask = metadata['folder_path'] == folder
                if mask.sum() > 0:
                    ax.scatter(embedding_2d[mask, 0], embedding_2d[mask, 1], 
                              alpha=0.7, s=15, c=[folder_colors[folder]], 
                              label=folder[:10] if i == 0 else "")
            
            # Add remaining points in gray
            other_mask = ~metadata['folder_path'].isin(unique_folders)
            if other_mask.sum() > 0:
                ax.scatter(embedding_2d[other_mask, 0], embedding_2d[other_mask, 1], 
                          alpha=0.4, s=10, c='lightgray')
            
            ax.set_title(f'P={perplexity}, LR={learning_rate}\\n({compute_time:.1f}s)', fontsize=12)
            ax.set_xticks([])
            ax.set_yticks([])
            
            # Store results for later analysis
            results.append({
                'perplexity': perplexity,
                'learning_rate': learning_rate,
                'embedding_2d': embedding_2d,
                'compute_time': compute_time,
                'kl_divergence': tsne.kl_divergence_
            })
            
        except Exception as e:
            ax.text(0.5, 0.5, f'Failed\\nP={perplexity}\\nLR={learning_rate}\\n{str(e)[:20]}', 
                   ha='center', va='center', transform=ax.transAxes, fontsize=10)
            ax.set_xticks([])
            ax.set_yticks([])
    
    # Add legend to first subplot
    if len(unique_folders) > 0:
        axes_flat[0].legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=8)
    
    plt.tight_layout()
    plt.savefig(f"{output_dir}/tsne_parameter_grid.png", dpi=200, bbox_inches='tight')
    plt.show()
    
    # Create a second grid with different color schemes
    create_alternative_color_grids(results, metadata, output_dir)
    
    # Print parameter recommendations
    print_parameter_recommendations(results)
    
    return results

def create_alternative_color_grids(results, metadata, output_dir):
    """Create additional grids with different color schemes"""
    
    if not results:
        return
    
    # Select top 6 parameter combinations based on KL divergence
    sorted_results = sorted(results, key=lambda x: x['kl_divergence'])[:6]
    
    color_schemes = [
        ('Word Count', 'word_count', 'viridis'),
        ('Position in Note', 'relative_position', 'plasma'),
        ('Content Type', None, None),  # Special handling
        ('Note Length', 'note_word_count', 'coolwarm'),
        ('Folder Depth', 'folder_depth', 'Spectral'),
        ('Question Density', 'question_density', 'Reds')
    ]
    
    for scheme_name, column, cmap in color_schemes:
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle(f'Top 6 t-SNE Results - Colored by {scheme_name}', fontsize=16)
        axes_flat = axes.flatten()
        
        for i, result in enumerate(sorted_results):
            ax = axes_flat[i]
            embedding_2d = result['embedding_2d']
            
            if scheme_name == 'Content Type':
                # Special content type visualization
                regular_mask = ~(metadata['has_code'] | metadata['has_links'] | metadata['has_tags'])
                ax.scatter(embedding_2d[regular_mask, 0], embedding_2d[regular_mask, 1], 
                          alpha=0.4, s=15, c='lightgray', label='Regular')
                
                code_mask = metadata['has_code']
                if code_mask.sum() > 0:
                    ax.scatter(embedding_2d[code_mask, 0], embedding_2d[code_mask, 1], 
                              alpha=0.8, s=25, c='red', label='Code')
                
                links_mask = metadata['has_links']
                if links_mask.sum() > 0:
                    ax.scatter(embedding_2d[links_mask, 0], embedding_2d[links_mask, 1], 
                              alpha=0.8, s=20, c='blue', label='Links')
                
                tags_mask = metadata['has_tags']
                if tags_mask.sum() > 0:
                    ax.scatter(embedding_2d[tags_mask, 0], embedding_2d[tags_mask, 1], 
                              alpha=0.8, s=20, c='green', label='Tags')
                
                if i == 0:
                    ax.legend(fontsize=8)
            else:
                # Regular scatter plot with colormap
                if column in metadata.columns:
                    scatter = ax.scatter(embedding_2d[:, 0], embedding_2d[:, 1], 
                                       c=metadata[column], alpha=0.7, s=15, cmap=cmap)
                    if i == len(sorted_results) - 1:  # Add colorbar to last plot
                        plt.colorbar(scatter, ax=ax)
            
            ax.set_title(f'P={result["perplexity"]}, LR={result["learning_rate"]}\\nKL={result["kl_divergence"]:.2f}', 
                        fontsize=11)
            ax.set_xticks([])
            ax.set_yticks([])
        
        plt.tight_layout()
        safe_name = scheme_name.lower().replace(' ', '_')
        plt.savefig(f"{output_dir}/tsne_top6_{safe_name}.png", dpi=200, bbox_inches='tight')
        plt.show()

def print_parameter_recommendations(results):
    """Print recommendations based on the results"""
    if not results:
        return
    
    print("\\n" + "="*60)
    print("🎯 t-SNE PARAMETER RECOMMENDATIONS")
    print("="*60)
    
    # Sort by KL divergence (lower is better)
    sorted_results = sorted(results, key=lambda x: x['kl_divergence'])
    
    print("\\n🏆 Top 5 parameter combinations (by KL divergence):")
    for i, result in enumerate(sorted_results[:5]):
        print(f"{i+1}. Perplexity: {result['perplexity']:2d}, "
              f"Learning Rate: {result['learning_rate']:4d}, "
              f"KL Divergence: {result['kl_divergence']:.3f}, "
              f"Time: {result['compute_time']:.1f}s")
    
    # Find fastest results
    fast_results = sorted(results, key=lambda x: x['compute_time'])[:3]
    print("\\n⚡ Fastest computations (good for experimentation):")
    for i, result in enumerate(fast_results):
        print(f"{i+1}. Perplexity: {result['perplexity']:2d}, "
              f"Learning Rate: {result['learning_rate']:4d}, "
              f"Time: {result['compute_time']:.1f}s, "
              f"KL Divergence: {result['kl_divergence']:.3f}")
    
    # General recommendations
    print("\\n💡 General Guidelines:")
    print("• Lower KL divergence = better convergence")
    print("• Perplexity 5-15: Good for local structure, tight clusters")
    print("• Perplexity 30-50: Good balance of local and global structure")
    print("• Learning Rate 200-1000: Usually works well")
    print("• Higher learning rates: Faster but may miss fine structure")
    
    best_result = sorted_results[0]
    print(f"\\n🌟 RECOMMENDED: Perplexity={best_result['perplexity']}, Learning Rate={best_result['learning_rate']}")

def create_interactive_tsne(embeddings, metadata, perplexity=30, learning_rate=200, output_dir="visualizations"):
    """Create an interactive t-SNE visualization with the best parameters"""
    
    Path(output_dir).mkdir(exist_ok=True)
    
    # PCA preprocessing
    pca = PCA(n_components=50)
    embeddings_pca = pca.fit_transform(embeddings)
    
    # Compute t-SNE with chosen parameters
    print(f"Computing final t-SNE with perplexity={perplexity}, learning_rate={learning_rate}...")
    tsne = TSNE(
        n_components=2,
        perplexity=perplexity,
        learning_rate=learning_rate,
        n_iter=1000,
        random_state=42,
        verbose=1
    )
    
    embedding_2d = tsne.fit_transform(embeddings_pca)
    
    # Add coordinates to metadata
    metadata_copy = metadata.copy()
    metadata_copy['tsne_x'] = embedding_2d[:, 0]
    metadata_copy['tsne_y'] = embedding_2d[:, 1]
    
    # Create the comprehensive visualization from the original script
    fig, axes = plt.subplots(3, 3, figsize=(20, 20))
    fig.suptitle(f't-SNE Visualization (P={perplexity}, LR={learning_rate})', fontsize=20)
    
    # All the visualization code from the original script...
    # (The same plotting code as in tsne_example.py but using chosen parameters)
    
    # 1. Color by folder
    ax = axes[0, 0]
    unique_folders = metadata_copy['folder_path'].value_counts().head(8).index
    colors = plt.cm.Set3(np.linspace(0, 1, len(unique_folders)))
    for folder, color in zip(unique_folders, colors):
        mask = metadata_copy['folder_path'] == folder
        ax.scatter(metadata_copy[mask]['tsne_x'], metadata_copy[mask]['tsne_y'], 
                  alpha=0.7, s=30, c=[color], label=folder[:15])
    ax.set_title('Colored by Folder', fontsize=14)
    ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
    
    # Continue with other visualizations...
    # (Include all the visualization code from the original script)
    
    plt.tight_layout()
    plt.savefig(f"{output_dir}/final_tsne_visualization.png", dpi=300, bbox_inches='tight')
    plt.show()
    
    # Save results
    metadata_copy.to_csv(f"{output_dir}/embeddings_with_optimal_tsne.csv", index=False)
    print(f"Saved final visualization and data to {output_dir}/")
    
    return metadata_copy

def main():
    parser = argparse.ArgumentParser(description='t-SNE Parameter Surfing for Obsidian embeddings')
    parser.add_argument('--input', default='exports/embeddings_*', 
                       help='Base path to embedding files (without extension)')
    parser.add_argument('--output', default='visualizations',
                       help='Output directory for visualizations')
    parser.add_argument('--max-samples', type=int, default=2000,
                       help='Maximum number of samples for parameter grid')
    parser.add_argument('--grid-size', nargs=2, type=int, default=[4, 6],
                       help='Grid dimensions for parameter exploration')
    parser.add_argument('--final-params', nargs=2, type=int, default=None,
                       help='Create final visualization with specific [perplexity, learning_rate]')
    
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
    
    if args.final_params:
        # Create final visualization with specific parameters
        perplexity, learning_rate = args.final_params
        create_interactive_tsne(embeddings, metadata, perplexity, learning_rate, args.output)
    else:
        # Create parameter exploration grid
        results = create_tsne_parameter_grid(embeddings, metadata, args.output, 
                                           args.max_samples, tuple(args.grid_size))
        
        print("\\n🎨 Parameter surfing complete!")
        print(f"Check the {args.output}/ directory for your parameter exploration plots.")
        print("\\nTo create a final visualization with your chosen parameters, run:")
        print(f"python {__file__} --input {args.input} --final-params PERPLEXITY LEARNING_RATE")

if __name__ == "__main__":
    main()