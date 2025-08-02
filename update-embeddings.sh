#!/bin/bash

# Update script for regenerating Obsidian embeddings and UMAP visualizations
# Run this after adding new notes to your Obsidian vault

set -e

echo "🧠 Obsidian Analysis Update Script"
echo "=================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Create .env with: OBSIDIAN_VAULT_PATH=/path/to/your/vault"
    exit 1
fi

# Source environment variables
source .env

echo "📁 Vault path: $OBSIDIAN_VAULT_PATH"
echo ""

# Generate fresh embeddings
echo "🔄 Generating embeddings from Obsidian vault..."
npm run generate

# Create UMAP projections
echo ""
echo "🗺️  Creating UMAP parameter surf visualizations..."
npm run umap-surf

echo ""
echo "✅ Update complete!"
echo ""
echo "Next steps:"
echo "1. cd umap-explorer && npm run dev"
echo "2. Visit http://localhost:3000 to explore your notes"
echo ""
echo "Optional: Upload embeddings.db to R2/S3 for remote access"