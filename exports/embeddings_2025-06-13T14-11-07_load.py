import json
import numpy as np
import pandas as pd

# Load embeddings and metadata
with open('embeddings_2025-06-13T14-11-07_embeddings.json', 'r') as f:
    embeddings = np.array(json.load(f))

with open('embeddings_2025-06-13T14-11-07_metadata.json', 'r') as f:
    metadata = pd.DataFrame(json.load(f))

print(f"Embeddings shape: {embeddings.shape}")
print(f"Metadata shape: {metadata.shape}")

# Example UMAP visualization
# import umap
# reducer = umap.UMAP()
# embedding_2d = reducer.fit_transform(embeddings)
# metadata['umap_x'] = embedding_2d[:, 0]
# metadata['umap_y'] = embedding_2d[:, 1]