import { VectorSearchService } from './src/services/vector-search.service';

async function testEmbeddingsSearch() {
  console.log('\n🧪 Testando Busca Semântica com OpenAI Embeddings\n');
  console.log('='.repeat(60));

  const service = new VectorSearchService();

  // Teste 1: Busca por orçamento e uso
  console.log('\n📝 Teste 1: Carro para trabalho, até R$ 50.000');
  console.log('-'.repeat(60));
  
  const results1 = await service.searchVehicles({
    budget: 50000,
    usage: 'trabalho',
    persons: 1,
    year: 2018,
  }, 3);

  results1.forEach((v, i) => {
    console.log(`\n${i + 1}. ${v.brand} ${v.model} ${v.version} (${v.year})`);
    console.log(`   💯 Match Score: ${v.matchScore}%`);
    console.log(`   💰 Preço: R$ ${v.price.toLocaleString('pt-BR')}`);
    console.log(`   📊 KM: ${v.mileage.toLocaleString('pt-BR')}km`);
    console.log(`   ✨ Razões: ${v.matchReasons.join(', ')}`);
    if (v._semanticScore) {
      console.log(`   🧠 Score Semântico: ${v._semanticScore}% | 📏 Score Critérios: ${v._criteriaScore}%`);
    }
  });

  // Teste 2: Busca por família (SUV)
  console.log('\n\n📝 Teste 2: SUV para família, até R$ 80.000');
  console.log('-'.repeat(60));
  
  const results2 = await service.searchVehicles({
    budget: 80000,
    usage: 'família',
    persons: 5,
    bodyType: 'SUV',
    essentialItems: ['ar condicionado', 'airbag'],
  }, 3);

  results2.forEach((v, i) => {
    console.log(`\n${i + 1}. ${v.brand} ${v.model} ${v.version} (${v.year})`);
    console.log(`   💯 Match Score: ${v.matchScore}%`);
    console.log(`   💰 Preço: R$ ${v.price.toLocaleString('pt-BR')}`);
    console.log(`   🚙 Tipo: ${v.transmission} - ${v.fuelType}`);
    console.log(`   ✨ Features: ${v.features.join(', ')}`);
    if (v._semanticScore) {
      console.log(`   🧠 Score Semântico: ${v._semanticScore}% | 📏 Score Critérios: ${v._criteriaScore}%`);
    }
  });

  // Teste 3: Busca econômica (hatch)
  console.log('\n\n📝 Teste 3: Hatch econômico, até R$ 40.000');
  console.log('-'.repeat(60));
  
  const results3 = await service.searchVehicles({
    budget: 40000,
    usage: 'urbano',
    bodyType: 'Hatch',
    year: 2017,
  }, 3);

  results3.forEach((v, i) => {
    console.log(`\n${i + 1}. ${v.brand} ${v.model} ${v.version} (${v.year})`);
    console.log(`   💯 Match Score: ${v.matchScore}%`);
    console.log(`   💰 Preço: R$ ${v.price.toLocaleString('pt-BR')}`);
    console.log(`   ⛽ Combustível: ${v.fuelType} | 🔧 Câmbio: ${v.transmission}`);
    if (v._semanticScore) {
      console.log(`   🧠 Score Semântico: ${v._semanticScore}% | 📏 Score Critérios: ${v._criteriaScore}%`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testes concluídos com sucesso!\n');
  
  process.exit(0);
}

testEmbeddingsSearch().catch((error) => {
  console.error('\n❌ Erro:', error.message);
  console.error(error);
  process.exit(1);
});
