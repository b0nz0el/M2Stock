import { describe, it, expect } from 'vitest';
import {
  calculateLevenshteinDistance,
  fuzzyScore,
  fuzzyMatch
} from '../public/assets/js/utils.js';

describe('Typo-Tolerant & Fuzzy Search Engine (utils.js)', () => {
  it('menghitung Levenshtein dan Damerau transposition distance dengan benar', () => {
    expect(calculateLevenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(calculateLevenshteinDistance('cotton', 'cotton')).toBe(0);
    expect(calculateLevenshteinDistance('coton', 'cotton')).toBe(1);
    // Damerau transposition: 'fliter' -> 'filter' harus bernilai 1
    expect(calculateLevenshteinDistance('fliter', 'filter')).toBe(1);
  });

  it('mendeteksi exact match dan substring match dengan skor tinggi', () => {
    const text = 'Kandila Magtool Glass Scraper Stainless';
    expect(fuzzyMatch('scraper', text)).toBe(true);
    expect(fuzzyMatch('Kandila', text)).toBe(true);
    expect(fuzzyMatch('glass scraper', text)).toBe(true);

    const exactScore = fuzzyScore('scraper', text);
    expect(exactScore).toBeGreaterThan(1000);
  });

  it('toleran terhadap typo umum (1-2 karakter) pada nama barang akuarium', () => {
    const itemCotton = 'Cotton Wool Filter Aquarium Ultra White 100g';
    const itemScraper = 'Kandila Glass Scraper Pembersih Kaca';
    const itemAquarium = 'Aquarium Rimless Optic Clear 60cm';
    const itemCanister = 'Canister Filter External CF-1200';
    const itemAerator = 'Baterai Aerator Emergency DC Portable';

    // Typo: "coton" -> "cotton"
    expect(fuzzyMatch('coton', itemCotton)).toBe(true);
    // Typo: "cotoon" -> "cotton"
    expect(fuzzyMatch('cotoon', itemCotton)).toBe(true);
    // Typo: "skreper" -> "scraper"
    expect(fuzzyMatch('skreper', itemScraper)).toBe(true);
    // Typo: "aquariun" -> "aquarium"
    expect(fuzzyMatch('aquariun', itemAquarium)).toBe(true);
    // Typo: "fliter" -> "filter"
    expect(fuzzyMatch('fliter', itemCanister)).toBe(true);
    // Typo fonetik: "kanister" -> "canister"
    expect(fuzzyMatch('kanister', itemCanister)).toBe(true);
    // Typo: "bateray" atau "batre" -> "baterai"
    expect(fuzzyMatch('bateray', itemAerator)).toBe(true);
    expect(fuzzyMatch('batre', itemAerator)).toBe(true);
  });

  it('mendukung pencarian multi-token kombinasi kata kunci', () => {
    const item = 'Lampu LED Celup Kandila View Eco 40cm Pink';
    expect(fuzzyMatch('lamp kandila', item)).toBe(true);
    expect(fuzzyMatch('kandila eco view', item)).toBe(true);
    expect(fuzzyMatch('led 40cm', item)).toBe(true);

    // Jika ada kata yang sama sekali tidak cocok, return false
    expect(fuzzyMatch('lamp kandila eheim', item)).toBe(false);
  });

  it('memberikan skor lebih tinggi untuk exact match dibandingkan typo match', () => {
    const item = 'Filter Gantung Hang On Aquarium';
    const exactScore = fuzzyScore('filter', item);
    const typoScore = fuzzyScore('fliter', item);

    expect(exactScore).toBeGreaterThan(typoScore);
  });

  it('mencegah false positive pada query pendek 1-2 karakter', () => {
    const item = 'Batu Pasir Silika Hitam 1kg';
    expect(fuzzyMatch('xy', item)).toBe(false);
    expect(fuzzyMatch('zz', item)).toBe(false);
  });
});
