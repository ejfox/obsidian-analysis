# Claude Development Notes

## Visualization & Analysis Roadmap

### Dimension Reduction
- [x] t-SNE parameter surfing (basic implementation)
- [ ] **UMAP parameter surfing** (preferred for large embeddings)
  - UMAP is faster and better for 3214 embeddings vs t-SNE
  - Key parameters to explore: n_neighbors (5, 15, 30, 50), min_dist (0.0, 0.1, 0.5), metric ('cosine', 'euclidean')
  - Export for regl-scatterplot visualization in Vue.js

### Network Analysis 
- [ ] **Radial linking system** for connecting related notes
  - Use embedding similarity within radius threshold
  - Create network graph connections between chunks/notes
  - Different radius values create different connection densities
  - Could use for:
    - Finding note clusters and communities
    - Identifying bridge notes that connect different topics
    - Creating interactive network visualizations
    - Suggesting related content based on network position

### Architecture Notes
- Primary stack: Node.js → Vue.js (Python as secondary option)
- Use regl-scatterplot for interactive visualizations
- Database: SQLite with sqlite-vec extension for vector operations
- Current: 3214 embedding chunks, 608 notes, 768D vectors

### Performance Notes
- Sample ~1500-2000 embeddings for parameter exploration (full 3214 too slow)
- Use PCA preprocessing to ~50 dimensions before UMAP/t-SNE
- Export JSON format optimized for regl-scatterplot consumption

### Future Enhancements
- Interactive parameter controls in Vue app
- Real-time similarity search with network visualization
- Temporal analysis of note creation/editing patterns
- Topic modeling integration with embeddings