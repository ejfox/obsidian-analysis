import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LM_STUDIO_BASE_URL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234';
const NOMIC_MODEL_NAME = process.env.NOMIC_MODEL_NAME || 'nomic-embed-text-v1.5';

export class EmbeddingsClient {
  constructor() {
    this.baseURL = LM_STUDIO_BASE_URL;
    this.modelName = NOMIC_MODEL_NAME;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async generateEmbedding(text, taskType = 'search_document', retries = 3) {
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input for embedding generation');
    }
    
    if (text.trim().length === 0) {
      throw new Error('Empty text provided for embedding generation');
    }

    // Add proper Nomic task prefix
    const prefixedText = `${taskType}: ${text}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.post('/v1/embeddings', {
          model: this.modelName,
          input: prefixedText,
          encoding_format: 'float'
        });

        if (response.data && response.data.data && response.data.data[0]) {
          const embedding = response.data.data[0].embedding;
          
          // Validate embedding
          if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('Invalid embedding format received');
          }
          
          return embedding;
        } else {
          throw new Error('Invalid response format from LM Studio');
        }
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        if (error.response) {
          const errorMsg = `LM Studio API error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`;
          if (isLastAttempt) throw new Error(errorMsg);
          console.warn(`Attempt ${attempt}/${retries} failed: ${errorMsg}. Retrying...`);
        } else if (error.request) {
          const errorMsg = 'Unable to connect to LM Studio. Make sure it\'s running on ' + this.baseURL;
          if (isLastAttempt) throw new Error(errorMsg);
          console.warn(`Attempt ${attempt}/${retries} failed: Connection error. Retrying...`);
        } else {
          const errorMsg = `Error generating embedding: ${error.message}`;
          if (isLastAttempt) throw new Error(errorMsg);
          console.warn(`Attempt ${attempt}/${retries} failed: ${errorMsg}. Retrying...`);
        }
        
        // Wait before retry (exponential backoff)
        if (!isLastAttempt) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  async generateBatchEmbeddings(texts, batchSize = 10, taskType = 'search_document') {
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      // Add proper Nomic task prefixes to batch
      const prefixedBatch = batch.map(text => `${taskType}: ${text}`);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
      
      try {
        const response = await this.client.post('/v1/embeddings', {
          model: this.modelName,
          input: prefixedBatch,
          encoding_format: 'float'
        });

        if (response.data && response.data.data) {
          const batchEmbeddings = response.data.data.map(item => item.embedding);
          embeddings.push(...batchEmbeddings);
        } else {
          throw new Error('Invalid response format from LM Studio');
        }
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, error.message);
        // For failed batches, process individually
        for (const text of batch) {
          try {
            const embedding = await this.generateEmbedding(text, taskType);
            embeddings.push(embedding);
          } catch (individualError) {
            console.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`);
            embeddings.push(null);
          }
        }
      }
      
      // Small delay between batches to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return embeddings;
  }

  async testConnection() {
    try {
      const testEmbedding = await this.generateEmbedding("Hello, world!");
      return {
        success: true,
        modelName: this.modelName,
        embeddingDimensions: testEmbedding.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}