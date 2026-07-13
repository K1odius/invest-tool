/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchRuDataIndicators } from "./rudata";
import { fetchCbondsIndicators } from "./cbonds";

export interface FinancialIndicators {
  roe?: number;       // Return on Equity in %
  eps?: number;       // Earnings per Share in RUB
  pe?: number;        // Price to Earnings ratio
  marketCap?: number; // Market Capitalization in RUB
  dataSource: "RuData (Interfax)" | "Cbonds API" | "Мосбиржа (ISS)" | "Локальный расчет" | "Н/Д";
}

interface CompanyFundamentals {
  sharesCount: number; // Number of outstanding shares
  netIncome: number;   // Net Income in RUB
  equity: number;      // Book Equity in RUB
}

// Database of fundamentals for major Moscow Exchange tickers (last updated values for 2025/2026)
export const FUNDAMENTALS_DB: Record<string, CompanyFundamentals> = {
  SBER: {
    sharesCount: 22386148000,
    netIncome: 1508400000000,
    equity: 6312400000000,
  },
  SBERP: {
    sharesCount: 1000000000,
    netIncome: 1508400000000,
    equity: 6312400000000,
  },
  GAZP: {
    sharesCount: 23673512900,
    netIncome: 696000000000,
    equity: 16215000000000,
  },
  LKOH: {
    sharesCount: 692865000,
    netIncome: 1155000000000,
    equity: 6410000000000,
  },
  ROSN: {
    sharesCount: 10598177817,
    netIncome: 1267000000000,
    equity: 9120000000000,
  },
  TCSG: {
    sharesCount: 199305000,
    netIncome: 121000000000,
    equity: 285000000000,
  },
  YDEX: {
    sharesCount: 365200000,
    netIncome: 64100000000,
    equity: 312000000000,
  },
  MGNT: {
    sharesCount: 101911355,
    netIncome: 89500000000,
    equity: 385000000000,
  },
  GMKN: {
    sharesCount: 152863397,
    netIncome: 215000000000,
    equity: 1180000000000,
  },
  CHMF: {
    sharesCount: 837718660,
    netIncome: 179500000000,
    equity: 590000000000,
  },
  TATN: {
    sharesCount: 2326271000,
    netIncome: 286000000000,
    equity: 1240000000000,
  },
  TATNP: {
    sharesCount: 1475085000,
    netIncome: 286000000000,
    equity: 1240000000000,
  },
  NVTK: {
    sharesCount: 3036306000,
    netIncome: 469000000000,
    equity: 2310000000000,
  },
  VTBR: {
    sharesCount: 268540000000000,
    netIncome: 432000000000,
    equity: 2280000000000,
  },
  ASTR: {
    sharesCount: 210000000,
    netIncome: 4500000000,
    equity: 8200000000,
  },
  NLMK: {
    sharesCount: 5993227240,
    netIncome: 209000000000,
    equity: 980000000000,
  },
  MAGN: {
    sharesCount: 11173000000,
    netIncome: 118000000000,
    equity: 680000000000,
  },
  PLZL: {
    sharesCount: 136894000,
    netIncome: 153000000000,
    equity: 740000000000,
  },
  ALRS: {
    sharesCount: 7364965630,
    netIncome: 85000000000,
    equity: 360000000000,
  },
  SNGS: {
    sharesCount: 35726000000,
    netIncome: 705000000000,
    equity: 5800000000000,
  },
  SNGSP: {
    sharesCount: 7701000000,
    netIncome: 705000000000,
    equity: 5800000000000,
  },
  SIBN: {
    sharesCount: 4741299639,
    netIncome: 641000000000,
    equity: 3200000000000,
  },
  OZON: {
    sharesCount: 216000000,
    netIncome: -42000000000, // Negative Net Income for valuation context
    equity: -55000000000,
  },
};

/**
 * Resolves the final financial indicators for a given ticker and price.
 * Tries RuData first, Cbonds second, and falls back to dynamic local calculations.
 */
export async function getFinancialIndicators(
  ticker: string,
  currentPrice: number
): Promise<FinancialIndicators> {
  const t = ticker.toUpperCase();

  // 1. Try RuData Interfax API
  const ruDataResult = await fetchRuDataIndicators(t);
  if (ruDataResult) {
    return {
      roe: ruDataResult.roe,
      eps: ruDataResult.eps,
      pe: ruDataResult.pe,
      marketCap: ruDataResult.marketCap,
      dataSource: "RuData (Interfax)",
    };
  }

  // 2. Try Cbonds API
  const cbondsResult = await fetchCbondsIndicators(t);
  if (cbondsResult) {
    return {
      roe: cbondsResult.roe,
      eps: cbondsResult.eps,
      pe: cbondsResult.pe,
      marketCap: cbondsResult.marketCap,
      dataSource: "Cbonds API",
    };
  }

  // 3. Fallback to Local high-fidelity calculation database
  const fundamentals = FUNDAMENTALS_DB[t];
  if (fundamentals && currentPrice > 0) {
    const marketCap = currentPrice * fundamentals.sharesCount;
    const eps = fundamentals.netIncome / fundamentals.sharesCount;
    const pe = currentPrice / eps;
    const roe = (fundamentals.netIncome / fundamentals.equity) * 100;

    return {
      roe: parseFloat(roe.toFixed(2)),
      eps: parseFloat(eps.toFixed(2)),
      pe: pe > 0 ? parseFloat(pe.toFixed(2)) : undefined,
      marketCap: Math.round(marketCap),
      dataSource: "Локальный расчет",
    };
  }

  // Generic fallback estimates for other tickers to prevent empty fields
  // Using Sector as anchor if available can be done in calling function.
  return {
    dataSource: "Н/Д",
  };
}
