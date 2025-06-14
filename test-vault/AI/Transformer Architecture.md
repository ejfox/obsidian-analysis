---
tags: [transformers, attention, nlp]
type: technical-note
---

# Transformer Architecture

The transformer revolutionized NLP with its attention mechanism. Unlike RNNs, transformers process sequences in parallel.

## Self-Attention

Self-attention allows each token to attend to all other tokens in the sequence. This creates rich contextual representations.

The attention formula: Attention(Q,K,V) = softmax(QK^T/√d_k)V

## Multi-Head Attention

Multiple attention heads capture different types of relationships:
- Syntactic dependencies
- Semantic similarities  
- Long-range connections

[[Neural Networks]] are the foundation, but transformers add the attention innovation that changed everything!