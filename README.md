# 🧠 Obsidian Embeddings

Generate semantic embeddings for your Obsidian vault using LM Studio and Nomic embeddings. Search your notes using natural language!

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your settings:
   ```
   OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault
   LM_STUDIO_BASE_URL=http://localhost:1234
   NOMIC_MODEL_NAME=nomic-embed-text-v1.5
   ```

3. **Start LM Studio:**
   - Launch LM Studio
   - Load the Nomic embedding model (`nomic-embed-text-v1.5`)
   - Start the local server

## Usage

### Generate Embeddings
Process all your Obsidian notes and generate embeddings:
```bash
npm run generate
```

### Search Your Notes
Search using natural language:
```bash
npm run search "machine learning concepts"
npm run search "productivity tips" --limit 5
```

### Check Status
View system status and configuration:
```bash
npm start status
```

## Features

- **Intelligent Chunking**: Splits notes into semantic chunks
- **Batch Processing**: Efficient embedding generation
- **Semantic Search**: Find notes by meaning, not just keywords
- **Local & Private**: Everything runs on your machine
- **Fast SQLite Database**: Quick search and retrieval

## Commands

- `npm start generate` - Generate embeddings for all notes
- `npm start export` - Export embeddings for visualization
- `npm start analyze` - Analyze embedding database statistics
- `npm start search <query>` - Search notes semantically
- `npm start status` - Check system status

## Visualization

After generating embeddings, export them for visualization:

```bash
# Export as JSON (default)
npm start export

# Export as CSV for analysis
npm start export -- --format csv

# Export for Python/NumPy
npm start export -- --format npy
```

### Python Visualization Examples

Install Python dependencies:
```bash
cd visualization
pip install -r requirements.txt
```

Create UMAP visualization:
```bash
python umap_example.py --input ../exports/embeddings_2024-*
```

**Advanced UMAP Exploration**: Generate and compare 64 different UMAP parameter combinations:
```bash
python src/generate-64-umap-combinations.py
```
Then explore results in the interactive web interface at `umap-explorer/`.

Create t-SNE visualization:
```bash
python tsne_example.py --input ../exports/embeddings_2024-*
```

## Export Formats

- **JSON**: Full data with embeddings and metadata
- **CSV**: Flattened format for spreadsheet analysis
- **NPY**: Separate arrays for Python/NumPy workflows
- **PKL**: Pandas-ready format with conversion scripts

## Requirements

- Node.js 18+
- LM Studio with Nomic embedding model
- Obsidian vault with markdown files
- Python 3.8+ (for visualizations)