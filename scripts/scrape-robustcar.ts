import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface VehicleData {
  brand: string;
  model: string;
  version: string;
  year: number;
  mileage: number;
  fuel: string;
  color: string;
  price: number | null;
  detailUrl: string;
  category: string;
}

const CATEGORY_MAP: Record<string, string> = {
  // SUVs
  'CRETA': 'SUV',
  'COMPASS': 'SUV',
  'RENEGADE': 'SUV',
  'TRACKER': 'SUV',
  'ECOSPORT': 'SUV',
  'DUSTER': 'SUV',
  'HR-V': 'SUV',
  'TUCSON': 'SUV',
  'SPORTAGE': 'SUV',
  'RAV4': 'SUV',
  'TIGGO': 'SUV',
  'KORANDO': 'SUV',
  'PAJERO': 'SUV',
  'T-CROSS': 'SUV',
  'AIRCROSS': 'SUV',
  'STONIC': 'SUV',
  
  // Sedans
  'CIVIC': 'SEDAN',
  'COROLLA': 'SEDAN',
  'CITY': 'SEDAN',
  'CRUZE': 'SEDAN',
  'HB20S': 'SEDAN',
  'SENTRA': 'SEDAN',
  'LOGAN': 'SEDAN',
  'VOYAGE': 'SEDAN',
  'FOCUS': 'SEDAN',
  'PRIUS': 'SEDAN',
  'ARRIZO': 'SEDAN',
  
  // Hatches
  'ONIX': 'HATCH',
  'HB20': 'HATCH',
  'FIESTA': 'HATCH',
  'KA': 'HATCH',
  'CELTA': 'HATCH',
  'UNO': 'HATCH',
  'PALIO': 'HATCH',
  'FOX': 'HATCH',
  'MOBI': 'HATCH',
  'KWID': 'HATCH',
  'ETIOS': 'HATCH',
  'YARIS': 'HATCH',
  'C3': 'HATCH',
  '207': 'HATCH',
  'PUNTO': 'HATCH',
  
  // Pickups
  'TORO': 'PICKUP',
  'STRADA': 'PICKUP',
  
  // SUV 7 lugares
  'GRAND LIVINA': 'SUV',
  'FREEMONT': 'SUV',
  
  // Minivans
  'MERIVA': 'MINIVAN',
  'IDEA': 'MINIVAN',
  
  // Outros
  'SOUL': 'HATCH',
  'NEO': 'MOTO',
};

function detectCategory(model: string): string {
  const modelUpper = model.toUpperCase();
  
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (modelUpper.includes(key)) {
      return category;
    }
  }
  
  return 'HATCH';
}

function parsePrice(priceText: string): number | null {
  if (priceText.includes('Consulte')) {
    return null;
  }
  
  const cleanPrice = priceText
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  
  return parseFloat(cleanPrice);
}

function parseMileage(kmText: string): number {
  return parseInt(kmText.replace(/\./g, ''), 10) || 0;
}

async function scrapePage(pageNumber: number): Promise<VehicleData[]> {
  const url = `https://robustcar.com.br/busca//pag/${pageNumber}/ordem/ano-desc/`;
  console.log(`📥 Scraping página ${pageNumber}...`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const $ = cheerio.load(response.data);
    const vehicles: VehicleData[] = [];
    
    $('.resultado-busca').each((_, element) => {
      const $el = $(element);
      
      const title = $el.find('h3 a').text().trim();
      const detailUrl = 'https://robustcar.com.br' + $el.find('h3 a').attr('href');
      
      const specs = $el.find('ul.list-unstyled li');
      const fuel = $(specs[0]).text().trim();
      const color = $(specs[1]).text().trim();
      const year = parseInt($(specs[2]).text().trim(), 10);
      const mileage = parseMileage($(specs[3]).text().trim());
      
      const priceText = $el.find('.preco').last().text().trim();
      const price = parsePrice(priceText);
      
      const titleParts = title.split(' ');
      const yearFromTitle = parseInt(titleParts[0], 10);
      const brand = titleParts[1];
      const modelAndVersion = titleParts.slice(2).join(' ');
      
      const model = modelAndVersion.split(' ')[0];
      const version = modelAndVersion.replace(model, '').trim();
      
      const category = detectCategory(model);
      
      vehicles.push({
        brand,
        model,
        version,
        year: year || yearFromTitle,
        mileage,
        fuel,
        color,
        price,
        detailUrl,
        category,
      });
    });
    
    console.log(`✅ Página ${pageNumber}: ${vehicles.length} veículos encontrados`);
    return vehicles;
  } catch (error) {
    console.error(`❌ Erro ao scraping página ${pageNumber}:`, error);
    return [];
  }
}

async function scrapeAllPages(): Promise<VehicleData[]> {
  console.log('🚀 Iniciando scraping da Robust Car...\n');
  
  const allVehicles: VehicleData[] = [];
  const totalPages = 4;
  
  for (let page = 1; page <= totalPages; page++) {
    const vehicles = await scrapePage(page);
    allVehicles.push(...vehicles);
    
    if (page < totalPages) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Scraping concluído! Total: ${allVehicles.length} veículos\n`);
  
  const categoryCounts = allVehicles.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📊 Distribuição por categoria:');
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  
  return allVehicles;
}

async function main() {
  const vehicles = await scrapeAllPages();
  
  const outputPath = join(process.cwd(), 'scripts', 'robustcar-vehicles.json');
  writeFileSync(outputPath, JSON.stringify(vehicles, null, 2), 'utf-8');
  
  console.log(`\n💾 Dados salvos em: ${outputPath}`);
  
  console.log('\n📋 Exemplo de veículo:');
  console.log(JSON.stringify(vehicles[0], null, 2));
}

main().catch(console.error);
