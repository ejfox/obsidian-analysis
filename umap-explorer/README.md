# UMAP Explorer

Interactive web-based visualization for exploring UMAP parameter combinations on embedding data.

## Features

- **Interactive UMAP Visualization**: Explore different parameter combinations (n_neighbors, min_dist, metric)
- **WebGL Rendering**: Fast scatter plot rendering with regl-scatterplot
- **Color-coded Points**: Folder-based color coding for note organization
- **Parameter Switching**: Real-time switching between different UMAP configurations

## Setup

Install dependencies:

```bash
npm install
```

## Usage

1. **Place your UMAP data**: Copy your UMAP parameter surf JSON file to the `public/` directory
2. **Start development server**:
   ```bash
   npm run dev
   ```
3. **Open browser**: Navigate to `http://localhost:3000` (or the port shown in terminal)

## Data Format

The app expects UMAP parameter surf data in this format:

```json
{
  "timestamp": "2025-06-13T14:19:30",
  "totalSamples": 2000,
  "results": [
    {
      "parameters": {
        "n_neighbors": 5,
        "min_dist": 0.0,
        "metric": "cosine"
      },
      "data": [
        {
          "x": 2.7485,
          "y": 14.5584,
          "folder": "/path/to/folder",
          "folderColor": 4,
          "wordCount": 43,
          "title": "Note Title",
          "chunkText": "Content...",
          "filePath": "/full/path/to/file.md"
        }
      ]
    }
  ]
}
```

## Development

Built with:
- **Nuxt 3**: Vue.js framework
- **regl-scatterplot**: WebGL-accelerated scatter plots
- **Vue 3**: Reactive UI framework

For more details, see the [main project README](../README.md).
