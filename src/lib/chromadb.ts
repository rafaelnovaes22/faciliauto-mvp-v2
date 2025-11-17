export async function initChromaDB(): Promise<void> {
  console.log('ℹ️  ChromaDB desabilitado, usando busca SQL');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Embeddings desabilitados - retorna array vazio
  // O sistema vai usar busca SQL como fallback
  return generateMockEmbedding(text);
}

function generateMockEmbedding(text: string): number[] {
  const dimension = 1536;
  const seed = hashString(text);
  const random = seededRandom(seed);
  
  const embedding = [];
  for (let i = 0; i < dimension; i++) {
    embedding.push(random() * 2 - 1);
  }
  
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export async function isChromaDBAvailable(): Promise<boolean> {
  return false;
}

export async function closeChromaDB(): Promise<void> {
  openai = null;
  console.log('🔌 ChromaDB desconectado');
}
