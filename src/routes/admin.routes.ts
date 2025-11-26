import { Router } from 'express';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';

const router = Router();

// ⚠️ IMPORTANTE: Este endpoint deve ser protegido em produção
const SEED_SECRET = process.env.SEED_SECRET || 'dev-secret-change-in-production';

router.get('/seed-robustcar', async (req, res) => {
  const { secret } = req.query;
  
  // Validação de autenticação
  if (secret !== SEED_SECRET) {
    logger.warn('Tentativa de acesso não autorizado ao endpoint de seed');
    return res.status(403).json({ 
      success: false,
      error: 'Unauthorized - Invalid secret' 
    });
  }
  
  try {
    logger.info('🚀 Seed Robust Car iniciado via HTTP endpoint');
    
    // Executar seed
    logger.info('📦 Populando banco de dados...');
    execSync('npx tsx prisma/seed-robustcar.ts', { 
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    
    // Executar geração de embeddings
    logger.info('🔄 Gerando embeddings OpenAI...');
    execSync('npx tsx src/scripts/generate-embeddings.ts generate', { 
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    
    logger.info('✅ Seed e embeddings concluídos com sucesso!');
    
    res.json({ 
      success: true,
      message: '✅ Seed e embeddings executados com sucesso!',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error({ error }, '❌ Erro ao executar seed');
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Verifique os logs do Railway para mais informações'
    });
  }
});

// Endpoint de verificação
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: {
      seed: '/admin/seed-robustcar?secret=YOUR_SECRET'
    }
  });
});

export default router;
