/**
 * E2E Tests for Quiz Agent
 * 
 * Tests the complete quiz flow from welcome to profile generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuizAgent } from '../../src/agents/quiz.agent';

describe('Quiz Agent - E2E', () => {
  let quizAgent: QuizAgent;

  beforeEach(() => {
    quizAgent = new QuizAgent();
  });

  describe('Welcome Message', () => {
    it('deve gerar mensagem de boas-vindas', () => {
      const message = quizAgent.getWelcomeMessage();
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(50);
    });

    it('deve incluir primeira pergunta na mensagem de boas-vindas', () => {
      const message = quizAgent.getWelcomeMessage();
      
      expect(message).toContain('orçamento');
    });

    it('deve mencionar quantidade de perguntas', () => {
      const message = quizAgent.getWelcomeMessage();
      
      expect(message).toMatch(/\d+ perguntas/);
    });

    it('deve incluir instrução de saída', () => {
      const message = quizAgent.getWelcomeMessage();
      
      expect(message.toLowerCase()).toContain('sair');
    });
  });

  describe('Process Answer - Budget (Question 0)', () => {
    it('deve processar resposta válida de orçamento em número', async () => {
      const result = await quizAgent.processAnswer('50000', 0, {});
      
      expect(result).toBeDefined();
      expect(result.answers).toHaveProperty('budget');
      expect(result.answers.budget).toBe(50000);
      expect(result.progressIncrement).toBe(true);
      expect(result.isComplete).toBe(false);
    });

    it('deve processar orçamento com "mil"', async () => {
      const result = await quizAgent.processAnswer('50 mil', 0, {});
      
      expect(result.answers.budget).toBe(50);
    });

    it('deve processar orçamento com R$', async () => {
      const result = await quizAgent.processAnswer('R$ 60.000', 0, {});
      
      expect(result.answers.budget).toBe(60000);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve rejeitar orçamento inválido (texto)', async () => {
      const result = await quizAgent.processAnswer('abc', 0, {});
      
      expect(result.progressIncrement).toBe(false);
      expect(result.response).toContain('❌');
    });

    it('deve rejeitar orçamento zero', async () => {
      const result = await quizAgent.processAnswer('0', 0, {});
      
      expect(result.progressIncrement).toBe(false);
    });

    it('deve rejeitar orçamento negativo', async () => {
      const result = await quizAgent.processAnswer('-50000', 0, {});
      
      expect(result.progressIncrement).toBe(false);
    });
  });

  describe('Process Answer - Usage (Question 1)', () => {
    it('deve processar uso para trabalho', async () => {
      const result = await quizAgent.processAnswer('vou usar para ir ao trabalho', 1, { budget: 50000 });
      
      expect(result.answers.usage).toContain('trabalho');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar uso para Uber', async () => {
      const result = await quizAgent.processAnswer('quero fazer Uber', 1, { budget: 50000 });
      
      expect(result.answers.usage).toContain('Uber');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar uso para família', async () => {
      const result = await quizAgent.processAnswer('levar família para escola e passeios', 1, { budget: 50000 });
      
      expect(result.answers.usage).toBeTruthy();
      expect(result.progressIncrement).toBe(true);
    });

    it('deve aceitar descrição livre de uso', async () => {
      const result = await quizAgent.processAnswer('viagens longas nos fins de semana', 1, { budget: 50000 });
      
      expect(result.answers.usage).toBeTruthy();
      expect(result.progressIncrement).toBe(true);
    });
  });

  describe('Process Answer - People (Question 2)', () => {
    it('deve processar número de pessoas válido', async () => {
      const result = await quizAgent.processAnswer('5', 2, { budget: 50000, usage: 'família' });
      
      expect(result.answers.people).toBe(5);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar número com texto', async () => {
      const result = await quizAgent.processAnswer('4 pessoas', 2, { budget: 50000, usage: 'família' });
      
      expect(result.answers.people).toBe(4);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve rejeitar número inválido', async () => {
      const result = await quizAgent.processAnswer('abc', 2, { budget: 50000, usage: 'família' });
      
      expect(result.progressIncrement).toBe(false);
      expect(result.response).toContain('❌');
    });

    it('deve rejeitar zero pessoas', async () => {
      const result = await quizAgent.processAnswer('0', 2, { budget: 50000, usage: 'família' });
      
      expect(result.progressIncrement).toBe(false);
    });
  });

  describe('Process Answer - Trade-in (Question 3)', () => {
    it('deve processar "sim" para trade-in', async () => {
      const result = await quizAgent.processAnswer('sim', 3, { budget: 50000, usage: 'família', people: 5 });
      
      expect(result.answers.hasTradeIn).toBe('sim');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar "não" para trade-in', async () => {
      const result = await quizAgent.processAnswer('não', 3, { budget: 50000, usage: 'família', people: 5 });
      
      expect(result.answers.hasTradeIn).toBe('não');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar "nao" (sem acento) para trade-in', async () => {
      const result = await quizAgent.processAnswer('nao', 3, { budget: 50000, usage: 'família', people: 5 });
      
      expect(result.answers.hasTradeIn).toBe('nao');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve rejeitar resposta inválida para trade-in', async () => {
      const result = await quizAgent.processAnswer('talvez', 3, { budget: 50000, usage: 'família', people: 5 });
      
      expect(result.progressIncrement).toBe(false);
      expect(result.response).toContain('Opção inválida');
    });
  });

  describe('Process Answer - Min Year (Question 4)', () => {
    it('deve processar ano válido', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não' };
      const result = await quizAgent.processAnswer('2018', 4, answers);
      
      expect(result.answers.minYear).toBe(2018);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar ano com texto', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não' };
      const result = await quizAgent.processAnswer('a partir de 2020', 4, answers);
      
      expect(result.answers.minYear).toBe(2020);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve rejeitar ano inválido', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não' };
      const result = await quizAgent.processAnswer('abc', 4, answers);
      
      expect(result.progressIncrement).toBe(false);
    });
  });

  describe('Process Answer - Max KM (Question 5)', () => {
    it('deve processar quilometragem em número', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', minYear: 2018 };
      const result = await quizAgent.processAnswer('80000', 5, answers);
      
      expect(result.answers.maxKm).toBe(80000);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar quilometragem com "mil"', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', minYear: 2018 };
      const result = await quizAgent.processAnswer('80 mil km', 5, answers);
      
      expect(result.answers.maxKm).toBe(80);
    });

    it('deve rejeitar quilometragem inválida', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', minYear: 2018 };
      const result = await quizAgent.processAnswer('abc', 5, answers);
      
      expect(result.progressIncrement).toBe(false);
    });
  });

  describe('Process Answer - Body Type (Question 6)', () => {
    it('deve processar tipo SUV', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', minYear: 2018, maxKm: 80000 };
      const result = await quizAgent.processAnswer('SUV', 6, answers);
      
      expect(result.answers.bodyType).toContain('SUV');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar tipo sedan', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', minYear: 2018, maxKm: 80000 };
      const result = await quizAgent.processAnswer('sedan', 6, answers);
      
      expect(result.answers.bodyType).toContain('sedan');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar "tanto faz"', async () => {
      const answers = { budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', minYear: 2018, maxKm: 80000 };
      const result = await quizAgent.processAnswer('tanto faz', 6, answers);
      
      expect(result.answers.bodyType).toBeTruthy();
      expect(result.progressIncrement).toBe(true);
    });

    it('deve processar tipo picape', async () => {
      const answers = { budget: 50000, usage: 'trabalho', people: 2, hasTradeIn: 'não', minYear: 2018, maxKm: 80000 };
      const result = await quizAgent.processAnswer('picape', 6, answers);
      
      expect(result.answers.bodyType).toContain('picape');
      expect(result.progressIncrement).toBe(true);
    });
  });

  describe('Process Answer - Urgency (Question 7)', () => {
    it('deve processar urgência por número (1)', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('1', 7, answers);
      
      expect(result.answers.urgency).toBe('urgente');
      expect(result.progressIncrement).toBe(true);
      expect(result.isComplete).toBe(true);
    });

    it('deve processar urgência por texto "urgente"', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('urgente', 7, answers);
      
      expect(result.answers.urgency).toBe('urgente');
      expect(result.isComplete).toBe(true);
    });

    it('deve processar "esta semana" como urgente', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('esta semana', 7, answers);
      
      expect(result.answers.urgency).toBe('urgente');
    });

    it('deve processar opção 2 como "1 mês"', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('2', 7, answers);
      
      expect(result.answers.urgency).toBe('1mes');
    });

    it('deve processar opção 3 como "3 meses"', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('3', 7, answers);
      
      expect(result.answers.urgency).toBe('3meses');
    });

    it('deve processar opção 4 como "pesquisando"', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('4', 7, answers);
      
      expect(result.answers.urgency).toBe('pesquisando');
    });

    it('deve processar "só olhando" como pesquisando', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('só olhando', 7, answers);
      
      expect(result.answers.urgency).toBe('pesquisando');
    });

    it('deve rejeitar opção inválida', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('5', 7, answers);
      
      expect(result.progressIncrement).toBe(false);
      expect(result.response).toContain('Opção inválida');
    });
  });

  describe('Quiz Completion', () => {
    it('deve completar quiz na última pergunta', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV' 
      };
      const result = await quizAgent.processAnswer('1', 7, answers);
      
      expect(result.isComplete).toBe(true);
      expect(result.response).toContain('✅');
      expect(result.response).toContain('Tenho todas as informações');
    });

    it('deve retornar mensagem de quiz já concluído se index exceder', async () => {
      const answers = { 
        budget: 50000, usage: 'família', people: 5, hasTradeIn: 'não', 
        minYear: 2018, maxKm: 80000, bodyType: 'SUV', urgency: 'urgente' 
      };
      const result = await quizAgent.processAnswer('qualquer coisa', 8, answers);
      
      expect(result.isComplete).toBe(true);
      expect(result.response).toContain('concluído');
    });
  });

  describe('Generate Profile', () => {
    it('deve gerar perfil completo a partir das respostas', () => {
      const answers = { 
        budget: 50000, 
        usage: 'levar família para escola', 
        people: 5, 
        hasTradeIn: 'sim', 
        minYear: 2018, 
        maxKm: 80000, 
        bodyType: 'SUV', 
        urgency: 'urgente' 
      };
      
      const profile = quizAgent.generateProfile(answers);
      
      expect(profile.budget).toBe(50000);
      expect(profile.budgetMin).toBe(40000); // 80% of 50000
      expect(profile.budgetMax).toBe(60000); // 120% of 50000
      expect(profile.usage).toBe('levar família para escola');
      expect(profile.people).toBe(5);
      expect(profile.hasTradeIn).toBe(true);
      expect(profile.minYear).toBe(2018);
      expect(profile.maxKm).toBe(80000);
      expect(profile.bodyType).toBe('SUV');
      expect(profile.urgency).toBe('urgente');
      expect(profile.generatedAt).toBeTruthy();
    });

    it('deve converter hasTradeIn "não" para false', () => {
      const answers = { 
        budget: 50000, 
        usage: 'trabalho', 
        people: 2, 
        hasTradeIn: 'não', 
        minYear: 2020, 
        maxKm: 50000, 
        bodyType: 'hatch', 
        urgency: 'pesquisando' 
      };
      
      const profile = quizAgent.generateProfile(answers);
      
      expect(profile.hasTradeIn).toBe(false);
    });

    it('deve incluir timestamp de geração', () => {
      const answers = { budget: 50000 };
      const profile = quizAgent.generateProfile(answers);
      
      expect(profile.generatedAt).toBeTruthy();
      expect(() => new Date(profile.generatedAt)).not.toThrow();
    });
  });

  describe('Progress Tracking', () => {
    it('deve mostrar progresso nas perguntas', async () => {
      const result = await quizAgent.processAnswer('50000', 0, {});
      
      expect(result.response).toContain('Pergunta');
      expect(result.response).toMatch(/\d+ de \d+/);
    });

    it('deve indicar confirmação de resposta válida', async () => {
      const result = await quizAgent.processAnswer('50000', 0, {});
      
      expect(result.response).toContain('✅');
      expect(result.response).toContain('Anotado');
    });
  });

  describe('Complete Flow Simulation', () => {
    it('deve completar quiz inteiro com respostas válidas', async () => {
      const responses = [
        { answer: '50000', questionIndex: 0 },
        { answer: 'usar para trabalho e família', questionIndex: 1 },
        { answer: '5', questionIndex: 2 },
        { answer: 'não', questionIndex: 3 },
        { answer: '2018', questionIndex: 4 },
        { answer: '80000', questionIndex: 5 },
        { answer: 'SUV', questionIndex: 6 },
        { answer: '2', questionIndex: 7 },
      ];

      let answers: Record<string, any> = {};
      let lastResult: any;

      for (const { answer, questionIndex } of responses) {
        lastResult = await quizAgent.processAnswer(answer, questionIndex, answers);
        answers = lastResult.answers;
        
        if (questionIndex < 7) {
          expect(lastResult.progressIncrement).toBe(true);
          expect(lastResult.isComplete).toBe(false);
        }
      }

      expect(lastResult.isComplete).toBe(true);
      expect(Object.keys(answers)).toHaveLength(8);
      expect(answers.budget).toBe(50000);
      expect(answers.usage).toBeTruthy();
      expect(answers.people).toBe(5);
      expect(answers.hasTradeIn).toBe('não');
      expect(answers.minYear).toBe(2018);
      expect(answers.maxKm).toBe(80000);
      expect(answers.bodyType).toBeTruthy();
      expect(answers.urgency).toBe('1mes');
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com respostas em maiúsculas', async () => {
      const result = await quizAgent.processAnswer('SIM', 3, { budget: 50000, usage: 'família', people: 5 });
      
      expect(result.answers.hasTradeIn).toBe('sim');
      expect(result.progressIncrement).toBe(true);
    });

    it('deve lidar com espaços extras', async () => {
      const result = await quizAgent.processAnswer('   50000   ', 0, {});
      
      expect(result.answers.budget).toBe(50000);
      expect(result.progressIncrement).toBe(true);
    });

    it('deve preservar respostas anteriores', async () => {
      const previousAnswers = { budget: 50000, usage: 'trabalho' };
      const result = await quizAgent.processAnswer('4', 2, previousAnswers);
      
      expect(result.answers.budget).toBe(50000);
      expect(result.answers.usage).toBe('trabalho');
      expect(result.answers.people).toBe(4);
    });
  });
});
