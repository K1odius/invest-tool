/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Purchase {
  id: number;
  date: string;
  qty: number;
  price: number;
}

export interface Asset {
  id: number;
  name: string;
  shortName: string;
  type: "share" | "bond";
  sector: string;
  currentPrice: number;
  purchases: Purchase[];
  // Financial indicators from RuData, Cbonds, or local calculations
  roe?: number;
  eps?: number;
  pe?: number;
  marketCap?: number;
  dataSource?: string;
}

export interface DividendPayment {
  id: number;
  ticker: string;
  amount: number;
  date: string;
  comment: string;
}

export interface RealizedTrade {
  id: number;
  ticker: string;
  qty: number;
  price: number;
  date: string;
  costBasis: number;
  proceeds: number;
  pnl: number;
}

export interface ForecastEvent {
  ticker: string;
  date: string;
  value: number;
  sum: number;
  type: "Див." | "Купон";
  status?: "confirmed" | "projected";
}

export interface SectorEst {
  ticker: string;
  sum: number;
}
