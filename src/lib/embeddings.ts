import OpenAI from 'openai';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

export interface SimilarityResult {
  id: string;
  score: number;
  metadata?: any;
}

/**
 * Gera embedding para um texto usando OpenAI text-embedding-3-small
 * @param text Texto para gerar embedding
 * @returns Array de números (1536 dimensões)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Texto vazio para gerar embedding');
    }

    logger.info({ text: cleanText.substring(0, 100) }, 'Gerando embedding...');

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanText,
      encoding_format: 'float',
    });

    const embedding = response.data[0].embedding;

    logger.info(
      {
        dimensions: embedding.length,
        model: EMBEDDING_MODEL,
      },
      'Embedding gerado com sucesso'
    );

    return embedding;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Erro ao gerar embedding');
    throw new Error(`Falha ao gerar embedding: ${error.message}`);
  }
}

/**
 * Gera embeddings para múltiplos textos em batch
 * @param texts Array de textos
 * @returns Array de embeddings
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    if (texts.length === 0) {
      return [];
    }

    const cleanTexts = texts.map((t) => t.trim()).filter((t) => t.length > 0);

    if (cleanTexts.length === 0) {
      return [];
    }

    logger.info({ count: cleanTexts.length }, 'Gerando embeddings em batch...');

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanTexts,
      encoding_format: 'float',
    });

    const embeddings = response.data.map((item) => item.embedding);

    logger.info(
      {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
      },
      'Embeddings batch gerados com sucesso'
    );

    return embeddings;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Erro ao gerar embeddings batch');
    throw new Error(`Falha ao gerar embeddings batch: ${error.message}`);
  }
}

/**
 * Calcula similaridade de cosseno entre dois vetores
 * @param a Vetor A
 * @param b Vetor B
 * @returns Score de similaridade (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vetores devem ter o mesmo tamanho');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Busca itens similares a um embedding de query
 * @param queryEmbedding Embedding da query
 * @param items Array de items com embeddings
 * @param topK Número de resultados
 * @returns Array de resultados ordenados por similaridade
 */
export function searchSimilar(
  queryEmbedding: number[],
  items: Array<{ id: string; embedding: number[]; metadata?: any }>,
  topK: number = 5
): SimilarityResult[] {
  if (items.length === 0) {
    return [];
  }

  const results = items.map((item) => ({
    id: item.id,
    score: cosineSimilarity(queryEmbedding, item.embedding),
    metadata: item.metadata,
  }));

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Converte array de números para string JSON (para salvar no banco)
 * @param embedding Array de números
 * @returns String JSON
 */
export function embeddingToString(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/**
 * Converte string JSON para array de números
 * @param embeddingStr String JSON
 * @returns Array de números
 */
export function stringToEmbedding(embeddingStr: string | null): number[] | null {
  if (!embeddingStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(embeddingStr);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error({ error }, 'Erro ao parsear embedding');
    return null;
  }
}

/**
 * Valida se um embedding está no formato correto
 * @param embedding Array para validar
 * @returns true se válido
 */
export function isValidEmbedding(embedding: any): boolean {
  if (!Array.isArray(embedding)) {
    return false;
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    return false;
  }

  return embedding.every((n) => typeof n === 'number' && !isNaN(n));
}

/**
 * Calcula estatísticas de um embedding
 * @param embedding Array de números
 * @returns Objeto com estatísticas
 */
export function getEmbeddingStats(embedding: number[]) {
  const sum = embedding.reduce((acc, val) => acc + val, 0);
  const mean = sum / embedding.length;
  const variance =
    embedding.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    embedding.length;
  const stdDev = Math.sqrt(variance);

  const magnitude = Math.sqrt(
    embedding.reduce((acc, val) => acc + val * val, 0)
  );

  return {
    dimensions: embedding.length,
    mean: mean.toFixed(6),
    stdDev: stdDev.toFixed(6),
    magnitude: magnitude.toFixed(6),
    min: Math.min(...embedding).toFixed(6),
    max: Math.max(...embedding).toFixed(6),
  };
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
