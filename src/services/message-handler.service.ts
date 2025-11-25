import { prisma } from '../lib/prisma';
import { cache } from '../lib/redis';
import { logger } from '../lib/logger';
import { OrchestratorAgent } from '../agents/orchestrator.agent';
import { QuizAgent } from '../agents/quiz.agent';
import { RecommendationAgent } from '../agents/recommendation.agent';
import { guardrails } from './guardrails.service';

export class MessageHandler {
  private orchestrator: OrchestratorAgent;
  private quizAgent: QuizAgent;
  private recommendationAgent: RecommendationAgent;

  constructor() {
    this.orchestrator = new OrchestratorAgent();
    this.quizAgent = new QuizAgent();
    this.recommendationAgent = new RecommendationAgent();
  }

  async handleMessage(phoneNumber: string, message: string): Promise<string> {
    try {
      // 🛡️ GUARDRAIL: Validate input
      const inputValidation = guardrails.validateInput(phoneNumber, message);
      if (!inputValidation.allowed) {
        logger.warn({ phoneNumber, reason: inputValidation.reason }, 'Input blocked by guardrails');
        return inputValidation.reason || 'Desculpe, não consegui processar sua mensagem.';
      }

      // Use sanitized input
      const sanitizedMessage = inputValidation.sanitizedInput || message;
      // Get or create conversation
      let conversation = await this.getOrCreateConversation(phoneNumber);

      // Log message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'incoming',
          content: sanitizedMessage,
          messageType: 'text',
        },
      });

      // Get conversation context from cache
      const contextKey = `conversation:${conversation.id}:context`;
      const cachedContext = await cache.get(contextKey);
      let context = cachedContext ? JSON.parse(cachedContext) : {};

      logger.debug({ 
        conversationId: conversation.id,
        currentStep: conversation.currentStep,
        quizProgress: context.quizProgress,
        hasQuizAnswers: !!context.quizAnswers
      }, 'Processing message with context');

      // Route message based on current step
      let response: string;

      switch (conversation.currentStep) {
        case 'greeting':
          response = await this.handleGreeting(conversation, sanitizedMessage, context);
          break;

        case 'quiz':
          response = await this.handleQuiz(conversation, sanitizedMessage, context);
          break;

        case 'recommendation':
          response = await this.handleRecommendation(conversation, sanitizedMessage, context);
          break;

        default:
          response = await this.handleGeneral(conversation, sanitizedMessage, context);
      }

      // 🛡️ GUARDRAIL: Validate output before sending
      const outputValidation = guardrails.validateOutput(response);
      if (!outputValidation.allowed) {
        logger.error({ conversationId: conversation.id, reason: outputValidation.reason }, 'Output blocked by guardrails');
        response = 'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente ou digite "vendedor" para falar com nossa equipe.';
      }

      // Update last message timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Log outgoing message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'outgoing',
          content: response,
          messageType: 'text',
        },
      });

      // Save updated context to cache (TTL 24 hours)
      await cache.set(contextKey, JSON.stringify(context), 86400);

      return response;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error handling message');
      return 'Desculpe, ocorreu um erro. Por favor, tente novamente.';
    }
  }

  private async getOrCreateConversation(phoneNumber: string) {
    // Check for existing active conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        phoneNumber,
        status: 'active',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          phoneNumber,
          status: 'active',
          currentStep: 'greeting',
        },
      });

      // Log event
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'started',
        },
      });

      logger.info({ conversationId: conversation.id, phoneNumber }, 'New conversation created');
    }

    return conversation;
  }

  private async handleGreeting(conversation: any, message: string, context: any): Promise<string> {
    // Check if we already asked for name
    if (!context.askedName) {
      context.askedName = true;
      
      // Save context to cache
      const contextKey = `conversation:${conversation.id}:context`;
      await cache.set(contextKey, JSON.stringify(context), 86400);
      
      // Ask for name
      return `Olá! 👋 Bem-vindo à *FaciliAuto*!

Sou seu assistente virtual e estou aqui para ajudar você a encontrar o carro usado perfeito! 🚗

Para começar, qual é o seu nome?`;
    }
    
    // User provided their name
    const userName = message.trim();
    
    // Save name in conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { 
        customerName: userName,
        currentStep: 'quiz' 
      },
    });
    
    // Save name in context
    context.userName = userName;
    context.quizProgress = 0;
    context.quizAnswers = {};
    
    // Save context to cache
    const contextKey = `conversation:${conversation.id}:context`;
    await cache.set(contextKey, JSON.stringify(context), 86400);
    
    // Start quiz with personalized greeting
    return `Prazer em conhecer você, *${userName}*! 😊

Vou fazer algumas perguntas rápidas para encontrar o carro ideal para você. 🎯

São apenas *8 perguntas* e leva menos de 2 minutos!

Vamos começar?

💰 *Pergunta 1 de 8*

Qual seu orçamento disponível para o carro?

_Exemplo: 50000 ou 50 mil_`;

    // For subsequent messages, identify intent
    const intent = await this.orchestrator.identifyIntent(message);

    logger.debug({ intent, conversationId: conversation.id }, 'Intent identified');

    if (intent === 'QUALIFICAR') {
      // Start quiz - update conversation in DB
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { currentStep: 'quiz' },
      });

      // Initialize quiz context
      context.quizProgress = 0;
      context.quizAnswers = {};
      
      // Save context immediately to cache
      const contextKey = `conversation:${conversation.id}:context`;
      await cache.set(contextKey, JSON.stringify(context), 86400);
      
      return this.quizAgent.getWelcomeMessage();
    }

    if (intent === 'HUMANO') {
      // Handoff to human
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'handoff_requested',
        },
      });

      return `Entendi! Vou conectar você com um de nossos vendedores especialistas.\n\nUm momento, por favor. ⏳`;
    }

    // Default greeting
    return `Olá! 👋 Bem-vindo à FaciliAuto!\n\nSou seu assistente virtual e estou aqui para ajudar você a encontrar o carro usado perfeito.\n\n🚗 Quer ver nossos veículos disponíveis?\n\n_Digite "sim" para começar ou "falar com vendedor" se preferir atendimento humano._`;
  }

  private async handleQuiz(conversation: any, message: string, context: any): Promise<string> {
    const currentProgress = context.quizProgress || 0;
    const currentAnswers = context.quizAnswers || {};
    
    logger.debug({ 
      conversationId: conversation.id, 
      currentProgress, 
      answersCount: Object.keys(currentAnswers).length,
      message 
    }, 'Starting handleQuiz');

    const { response, isComplete, answers, progressIncrement } = await this.quizAgent.processAnswer(
      message,
      currentProgress,
      currentAnswers
    );

    // Update context only if answer was valid
    if (progressIncrement) {
      context.quizProgress = currentProgress + 1;
    }
    context.quizAnswers = answers;
    
    // 📝 SAVE CONTEXT TO CACHE IMMEDIATELY (critical for MVP)
    const contextKey = `conversation:${conversation.id}:context`;
    await cache.set(contextKey, JSON.stringify(context), 86400);
    
    logger.debug({ 
      conversationId: conversation.id, 
      newProgress: context.quizProgress, 
      answersCount: Object.keys(answers).length,
      isComplete,
      progressIncrement
    }, 'Quiz context updated');

    if (isComplete) {
      logger.info({ conversationId: conversation.id, answers }, 'Quiz completed, generating recommendations');
      
      // Update conversation step in DB
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentStep: 'recommendation',
          quizAnswers: JSON.stringify(answers),
          profileData: JSON.stringify(this.quizAgent.generateProfile(answers)),
        },
      });

      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'quiz_completed',
          metadata: JSON.stringify({ answers }),
        },
      });

      // Generate recommendations
      const recommendations = await this.recommendationAgent.generateRecommendations(
        conversation.id,
        answers
      );

      // Format and return recommendations
      return this.formatRecommendations(recommendations);
    }

    return response;
  }

  private async handleRecommendation(conversation: any, message: string, context: any): Promise<string> {
    // Handle user response to recommendations
    const lowerMessage = message.toLowerCase();

    // Check for exit/reset commands
    if (lowerMessage.includes('sair') || lowerMessage.includes('encerrar') || lowerMessage.includes('tchau')) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { 
          status: 'closed',
          currentStep: 'closed'
        },
      });

      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'conversation_closed',
        },
      });

      return `Obrigado por usar a FaciliAuto! 👋

Foi um prazer ajudar você.

Se precisar de algo, é só enviar uma mensagem novamente que estarei aqui! 😊

Até logo! 🚗`;
    }

    if (lowerMessage.includes('recomeçar') || lowerMessage.includes('reiniciar') || lowerMessage.includes('nova busca')) {
      // Reset conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { 
          status: 'closed',
          currentStep: 'closed'
        },
      });

      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'conversation_reset',
        },
      });

      return `Tudo bem! Vou resetar nossa conversa. ♻️

Envie *"oi"* novamente para começarmos uma nova busca do zero!`;
    }

    if (lowerMessage.includes('mais') || lowerMessage.includes('outro')) {
      return 'No momento, mostrei as 3 melhores opções baseadas no seu perfil.\n\nGostaria de:\n\n1️⃣ Agendar uma visita\n2️⃣ Falar com um vendedor\n3️⃣ Fazer nova busca\n4️⃣ Encerrar\n\nDigite o número da opção.';
    }

    if (lowerMessage.includes('visita') || lowerMessage.includes('agendar') || lowerMessage === '1') {
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'visit_scheduled',
        },
      });

      // Create lead
      await this.createLead(conversation);

      return `Ótimo! 🎉

Vou transferir você para nossa equipe de vendas para agendar sua visita.

Um vendedor entrará em contato em breve via WhatsApp.

Obrigado por escolher a FaciliAuto!

_Digite "sair" para encerrar ou "recomeçar" para nova busca_`;
    }

    if (lowerMessage.includes('vendedor') || lowerMessage === '2') {
      await this.createLead(conversation);

      return `Perfeito! 👨‍💼

Nossa equipe de vendas foi notificada e entrará em contato com você em breve pelo WhatsApp.

Enquanto isso, sinta-se à vontade para acessar os links dos veículos!

_Digite "sair" para encerrar ou "recomeçar" para nova busca_`;
    }

    if (lowerMessage === '3') {
      return `Vamos fazer uma nova busca! ♻️

Digite *"recomeçar"* para iniciar do zero.`;
    }

    if (lowerMessage === '4') {
      return await this.handleRecommendation(conversation, 'sair', context);
    }

    return `Entendi! Como posso ajudar mais?

💬 *Opções:*
• *"agendar"* - Marcar visita
• *"vendedor"* - Falar com equipe
• *"recomeçar"* - Nova busca
• *"sair"* - Encerrar conversa`;
  }

  private async handleGeneral(conversation: any, message: string, context: any): Promise<string> {
    // Use orchestrator for general queries
    return await this.orchestrator.handleQuery(message, context);
  }

  private formatRecommendations(recommendations: any[]): string {
    if (recommendations.length === 0) {
      return 'Desculpe, não encontrei veículos que atendam exatamente suas necessidades no momento.\n\nMas nossa equipe pode ajudar! Digite "vendedor" para falar com um especialista.';
    }

    let message = `🎯 Encontrei ${recommendations.length} veículos perfeitos para você!\n\n`;

    recommendations.forEach((rec, index) => {
      const vehicle = rec.vehicle;
      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*${index + 1}️⃣ ${vehicle.marca} ${vehicle.modelo}*\n`;
      message += `Match: ${rec.matchScore}/100 ⭐\n\n`;
      message += `📅 ${vehicle.ano} | 🛣️ ${vehicle.km.toLocaleString('pt-BR')} km\n`;
      message += `💰 *R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n`;
      message += `🎨 ${vehicle.cor}\n\n`;
      
      // Link SEMPRE primeiro, bem destacado
      if (vehicle.url) {
        message += `🔗 *Ver fotos e detalhes:*\n${vehicle.url}\n\n`;
      }
      
      message += `${rec.reasoning}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📌 *Próximos passos:*\n\n`;
    message += `💬 Digite "vendedor" para falar com nossa equipe\n`;
    message += `📅 Digite "agendar" para marcar test-drive\n`;
    message += `🔄 Digite "recomeçar" para nova busca\n`;
    message += `🚪 Digite "sair" para encerrar`;

    return message;
  }

  private async createLead(conversation: any) {
    // Parse JSON strings
    const profile = conversation.profileData ? JSON.parse(conversation.profileData) : {};
    const answers = conversation.quizAnswers ? JSON.parse(conversation.quizAnswers) : {};

    try {
      await prisma.lead.create({
        data: {
          conversationId: conversation.id,
          name: conversation.customerName || 'Cliente WhatsApp',
          phone: conversation.phoneNumber,
          budget: answers.budget ? parseFloat(answers.budget) : null,
          usage: answers.usage,
          people: answers.people ? parseInt(answers.people) : null,
          hasTradeIn: answers.hasTradeIn === 'sim',
          urgency: answers.urgency,
          status: 'new',
          source: 'whatsapp_bot',
        },
      });

      logger.info({ conversationId: conversation.id }, 'Lead created');
    } catch (error) {
      logger.error({ error, conversationId: conversation.id }, 'Error creating lead');
    }
  }
}
