/**
 * Onboarding Handler
 * 
 * Manages initial greeting, name collection, and context understanding
 * for new conversations in conversational mode.
 */

import { logger } from '../lib/logger';
import { chatCompletion } from '../lib/llm-router';
import { ConversationState, CustomerProfile } from '../types/state.types';

export interface OnboardingStep {
  step: 'greeting' | 'name_collection' | 'context_discovery' | 'complete';
  needsName: boolean;
  needsContext: boolean;
  isComplete: boolean;
}

export class OnboardingHandler {

  /**
   * Check if conversation needs onboarding
   */
  needsOnboarding(state: ConversationState): boolean {
    const messageCount = state.messages.filter(m => m.role === 'user').length;
    const hasName = !!(state.profile && state.profile.customerName);
    const hasContext = !!(state.profile && state.profile.usoPrincipal);

    // First message always needs greeting
    if (messageCount === 0) return true;

    // If no name, still in onboarding
    if (!hasName && messageCount < 3) return true;

    // If has name but no context yet, continue onboarding
    if (hasName && !hasContext && messageCount < 4) return true;

    // Onboarding complete
    return false;
  }

  /**
   * Determine current onboarding step
   */
  getCurrentStep(state: ConversationState): OnboardingStep {
    const messageCount = state.messages.filter(m => m.role === 'user').length;
    const hasName = !!(state.profile && state.profile.customerName);
    const hasContext = !!(state.profile && (state.profile.usoPrincipal || state.profile.orcamento));

    if (messageCount === 0) {
      return {
        step: 'greeting',
        needsName: true,
        needsContext: true,
        isComplete: false
      };
    }

    if (!hasName) {
      return {
        step: 'name_collection',
        needsName: true,
        needsContext: true,
        isComplete: false
      };
    }

    if (!hasContext) {
      return {
        step: 'context_discovery',
        needsName: false,
        needsContext: true,
        isComplete: false
      };
    }

    return {
      step: 'complete',
      needsName: false,
      needsContext: false,
      isComplete: true
    };
  }

  /**
   * Handle onboarding message
   */
  async handleOnboarding(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedProfile: Partial<CustomerProfile> }> {
    const step = this.getCurrentStep(state);

    logger.debug({
      conversationId: state.conversationId,
      step: step.step,
      messageCount: state.messages.length
    }, 'Onboarding: processing step');

    switch (step.step) {
      case 'greeting':
        return this.handleGreeting(message);

      case 'name_collection':
        return this.handleNameCollection(message, state);

      case 'context_discovery':
        return this.handleContextDiscovery(message, state);

      default:
        return { response: '', updatedProfile: {} };
    }
  }

  /**
   * Handle initial greeting
   */
  private async handleGreeting(message: string): Promise<{
    response: string;
    updatedProfile: Partial<CustomerProfile>;
  }> {
    // Check if user already provided their name in first message
    const extractedName = await this.extractName(message);

    if (extractedName) {
      // User said: "Oi, meu nome é João" or "Olá, sou a Maria"
      const response = `Olá, ${extractedName}! 😊 Prazer em conhecê-lo.

Me conta: o que você está procurando?`;

      return {
        response,
        updatedProfile: { customerName: extractedName }
      };
    }

    // Standard greeting (no name provided)
    const response = `Olá! 😊 Bem-vindo à *FaciliAuto*!

Sou especialista em veículos usados e vou te ajudar a encontrar o carro ideal.

Para começar, qual é o seu nome?`;

    return {
      response,
      updatedProfile: {}
    };
  }

  /**
   * Handle name collection
   */
  private async handleNameCollection(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedProfile: Partial<CustomerProfile> }> {
    const extractedName = await this.extractName(message);

    if (!extractedName) {
      // Couldn't extract name, ask again politely
      return {
        response: 'Desculpe, não entendi seu nome. Pode me dizer de novo? 😊',
        updatedProfile: {}
      };
    }

    const response = `Prazer, ${extractedName}! 🤝

Me conta: o que você está procurando?`;

    return {
      response,
      updatedProfile: { customerName: extractedName }
    };
  }

  /**
   * Handle context discovery (uso principal e orçamento)
   */
  private async handleContextDiscovery(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedProfile: Partial<CustomerProfile> }> {
    // Extract context using LLM
    const context = await this.extractContext(message);

    const customerName = state.profile.customerName || 'amigo';
    const currentBudget = state.profile.orcamento || state.profile.budget;
    const currentUsage = state.profile.usoPrincipal;

    // Update profile with extracted values
    const updatedProfile: Partial<CustomerProfile> = {};

    if (context.usoPrincipal) {
      updatedProfile.usoPrincipal = context.usoPrincipal;
    }
    if (context.orcamento) {
      updatedProfile.orcamento = context.orcamento;
      updatedProfile.budget = context.orcamento;
    }

    // Determine what we still need
    const hasUsage = context.usoPrincipal || currentUsage;
    const hasBudget = context.orcamento || currentBudget;

    let response = '';

    // If we have both, we're done with onboarding
    if (hasUsage && hasBudget) {
      const usage = context.usoPrincipal || currentUsage;
      const budget = context.orcamento || currentBudget;

      if (usage === 'uber' || usage === 'aplicativo') {
        response = `Perfeito! Vou buscar carros aptos para aplicativos até R$ ${budget?.toLocaleString('pt-BR')}. Um momento...`;
      } else {
        response = `Ótimo! Vou buscar as melhores opções até R$ ${budget?.toLocaleString('pt-BR')} para você. Um momento...`;
      }
    }
    // If we only have budget, ask for usage
    else if (hasBudget && !hasUsage) {
      response = `Anotado! Orçamento de R$ ${(context.orcamento || currentBudget)?.toLocaleString('pt-BR')}. 

E qual vai ser o uso principal? Cidade, viagens, trabalho ou aplicativo (Uber/99)?`;
    }
    // If we only have usage, ask for budget
    else if (hasUsage && !hasBudget) {
      if (context.usoPrincipal === 'uber' || context.usoPrincipal === 'aplicativo') {
        response = `Legal! Para Uber/99, temos vários modelos aptos. Qual seu orçamento aproximado?`;
      } else if (context.usoPrincipal === 'familia') {
        response = `Ótimo! Para família temos SUVs e Sedans espaçosos. Qual seu orçamento aproximado?`;
      } else {
        response = `Entendi! Qual seu orçamento aproximado?`;
      }
    }
    // If we have neither, ask for both
    else {
      response = `Me conta: qual vai ser o uso principal do carro e qual seu orçamento aproximado?`;
    }

    return {
      response,
      updatedProfile
    };
  }

  /**
   * Extract name from message using LLM
   */
  private async extractName(message: string): Promise<string | null> {
    try {
      const prompt = `Extraia APENAS o nome da pessoa desta mensagem. Se não houver nome, retorne "NULL".

Mensagem: "${message}"

Exemplos:
- "Oi, meu nome é João" → João
- "Olá, sou Maria" → Maria
- "Pode me chamar de Carlos" → Carlos
- "José Silva aqui" → José
- "Oi" → NULL
- "Quero comprar um carro" → NULL

IMPORTANTE: Retorne APENAS o primeiro nome, sem sobrenome. Se não houver nome, retorne exatamente "NULL".

Nome:`;

      const response = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0,
        maxTokens: 20
      });

      const extracted = response.trim();

      if (extracted === 'NULL' || extracted.length === 0 || extracted.length > 30) {
        return null;
      }

      // Capitalize first letter
      return extracted.charAt(0).toUpperCase() + extracted.slice(1).toLowerCase();

    } catch (error) {
      logger.error({ error }, 'Error extracting name');
      return null;
    }
  }

  /**
   * Extract context (uso principal) from message
   */
  private async extractContext(message: string): Promise<{
    usoPrincipal: string | null;
    orcamento: number | null;
  }> {
    // First, try to extract budget with simple regex (faster, no LLM needed)
    const budgetMatch = this.extractBudgetSimple(message);

    try {
      const prompt = `Identifique o CONTEXTO DE USO e ORÇAMENTO desta mensagem sobre compra de carro.

Mensagem: "${message}"

CONTEXTOS POSSÍVEIS:
- uber: Para trabalhar com Uber, 99, aplicativos de transporte
- familia: Para uso familiar, esposa, filhos
- trabalho: Para ir ao trabalho, uso diário na cidade
- viagem: Para viagens, passeios
- null: Se não mencionar uso específico

ORÇAMENTO:
- Extraia o valor em reais (apenas número inteiro)
- "50 mil" = 50000
- "50k" = 50000
- "R$ 50.000" = 50000
- Se não mencionar valor, retorne null

Responda APENAS o JSON, sem texto adicional:
{"usoPrincipal": "uber|familia|trabalho|viagem|null", "orcamento": 50000}

Exemplos:
"Quero um carro para Uber" → {"usoPrincipal": "uber", "orcamento": null}
"60 mil" → {"usoPrincipal": null, "orcamento": 60000}
"uns 40k" → {"usoPrincipal": null, "orcamento": 40000}
"50000" → {"usoPrincipal": null, "orcamento": 50000}
"trabalho, 70 mil" → {"usoPrincipal": "trabalho", "orcamento": 70000}

JSON:`;

      const response = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0,
        maxTokens: 100
      });

      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { usoPrincipal: null, orcamento: budgetMatch };
      }

      const json = JSON.parse(jsonMatch[0]);

      return {
        usoPrincipal: json.usoPrincipal === 'null' || json.usoPrincipal === null ? null : json.usoPrincipal,
        orcamento: json.orcamento || budgetMatch
      };

    } catch (error) {
      logger.error({ error }, 'Error extracting context');
      // Fallback to simple budget extraction
      return { usoPrincipal: null, orcamento: budgetMatch };
    }
  }

  /**
   * Simple budget extraction without LLM
   */
  private extractBudgetSimple(message: string): number | null {
    const lower = message.toLowerCase().replace(/\s+/g, '');

    // Match patterns like: 50mil, 50k, 50000, R$50.000, 50.000
    const patterns = [
      /(\d+)\s*mil/i,           // 50 mil, 50mil
      /(\d+)\s*k/i,             // 50k, 50K
      /r?\$?\s*(\d{2,3})\.?(\d{3})/i,  // R$ 50.000, 50000, 50.000
      /^(\d{4,6})$/,            // Just numbers: 50000
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        if (pattern.source.includes('mil') || pattern.source.includes('k')) {
          return parseInt(match[1]) * 1000;
        }
        if (match[2]) {
          return parseInt(match[1] + match[2]);
        }
        return parseInt(match[1]);
      }
    }

    return null;
  }
}

// Singleton export
export const onboardingHandler = new OnboardingHandler();
