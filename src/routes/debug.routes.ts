/**
 * Debug Routes
 * Para verificar configuração em produção
 */

import { Router } from 'express';
import { env } from '../config/env';
import { featureFlags } from '../lib/feature-flags';

const router = Router();

/**
 * GET /debug/config
 * Mostra configuração de feature flags (sem expor secrets)
 */
router.get('/config', (req, res) => {
  const testPhone = req.query.phone as string || '5511999999999';
  
  res.json({
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    featureFlags: {
      conversationalMode: {
        enabled: env.ENABLE_CONVERSATIONAL_MODE,
        rolloutPercentage: env.CONVERSATIONAL_ROLLOUT_PERCENTAGE,
      },
      testResult: {
        phone: testPhone,
        shouldUseConversational: featureFlags.shouldUseConversationalMode(testPhone),
      }
    },
    rawEnvVars: {
      ENABLE_CONVERSATIONAL_MODE: process.env.ENABLE_CONVERSATIONAL_MODE,
      CONVERSATIONAL_ROLLOUT_PERCENTAGE: process.env.CONVERSATIONAL_ROLLOUT_PERCENTAGE,
    }
  });
});

export default router;
