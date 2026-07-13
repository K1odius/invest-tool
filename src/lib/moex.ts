/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SECTOR_DICT: Record<string, string> = {
  SBER: "Финансы",
  VTBR: "Финансы",
  TCSG: "Финансы",
  BSPB: "Финансы",
  CBOM: "Финансы",
  LKOH: "Нефтегаз",
  GAZP: "Нефтегаз",
  TATN: "Нефтегаз",
  TATNP: "Нефтегаз",
  ROSN: "Нефтегаз",
  SNGS: "Нефтегаз",
  SNGSP: "Нефтегаз",
  NVTK: "Нефтегаз",
  SIBN: "Нефтегаз",
  BANEP: "Нефтегаз",
  YDEX: "IT и Телеком",
  OZON: "IT и Телеком",
  VKCO: "IT и Телеком",
  ASTR: "IT и Телеком",
  CHMF: "Металлургия",
  GMKN: "Металлургия",
  NLMK: "Металлургия",
  ALRS: "Металлургия",
  MAGN: "Металлургия",
  PLZL: "Металлургия",
  SELG: "Металлургия",
  MGNT: "Потреб. сектор",
  FIVE: "Потреб. сектор",
  FIXP: "Потреб. сектор",
  BELU: "Потреб. сектор",
  MVID: "Потреб. сектор",
  IRAO: "Энергетика",
  HYDR: "Энергетика",
  UPRO: "Энергетика",
  MSNG: "Энергетика",
  LSNG: "Энергетика",
  LSNGP: "Энергетика",
  PIKK: "Строительство",
  LSRG: "Строительство",
  SMLT: "Строительство",
  FLOT: "Транспорт",
  AFLT: "Транспорт",
  FESH: "Транспорт",
};

export const FUNDS_LIST = ["LQDT", "TRUR", "TMOS", "SBGB", "SBMX", "FXUS", "FXDE", "AKME", "AKMB"];

export function autoDetectSector(ticker: string): string {
  const t = ticker.toUpperCase();
  if (SECTOR_DICT[t]) {
    return SECTOR_DICT[t];
  }
  if (t.startsWith("SU") && t.length >= 8) {
    return "ОФЗ / Гособлигации";
  }
  if (t.startsWith("RU000")) {
    return "Корп. облигации";
  }
  if (FUNDS_LIST.includes(t)) {
    return "Фонды (ETF)";
  }
  return "Другое";
}

export interface MoexPriceData {
  type: "share" | "bond";
  price: number;
  shortName: string;
}

export async function fetchMoexPrice(ticker: string): Promise<MoexPriceData | null> {
  const t = ticker.toUpperCase();
  // 1. Try Shares first
  try {
    const res = await fetch(
      `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${t}.json?iss.meta=off`
    );
    const data = await res.json();
    if (data.securities?.data?.length) {
      const sCols: string[] = data.securities.columns;
      const mCols: string[] = data.marketdata?.columns || [];
      const sData: any[][] = data.securities.data;
      const mData: any[][] = data.marketdata?.data || [];

      // Find standard board like TQBR (T+ shares) or TQTF (T+ funds)
      const sRow =
        sData.find((r) => ["TQBR", "TQTF"].includes(r[sCols.indexOf("BOARDID")])) ||
        sData[0];
      const mRow = mData.find(
        (r) => r[mCols.indexOf("BOARDID")] === sRow[sCols.indexOf("BOARDID")]
      );

      const priceVal =
        mRow && mRow[mCols.indexOf("LAST")] != null
          ? mRow[mCols.indexOf("LAST")]
          : sRow[sCols.indexOf("PREVPRICE")];
      const shortName = sRow[sCols.indexOf("SHORTNAME")] || t;

      if (priceVal) {
        return {
          type: "share",
          price: parseFloat(priceVal),
          shortName,
        };
      }
    }
  } catch (e) {
    console.error("Error fetching share price for", t, e);
  }

  // 2. Try Bonds if Shares failed or didn't yield price
  try {
    const res = await fetch(
      `https://iss.moex.com/iss/engines/stock/markets/bonds/securities/${t}.json?iss.meta=off`
    );
    const data = await res.json();
    if (data.securities?.data?.length) {
      const sCols: string[] = data.securities.columns;
      const mCols: string[] = data.marketdata?.columns || [];
      const sData: any[][] = data.securities.data;
      const mData: any[][] = data.marketdata?.data || [];

      // Find standard bond boards TQOB (gov) or TQCB (corp)
      const sRow =
        sData.find((r) => ["TQOB", "TQCB"].includes(r[sCols.indexOf("BOARDID")])) ||
        sData[0];
      const mRow = mData.find(
        (r) => r[mCols.indexOf("BOARDID")] === sRow[sCols.indexOf("BOARDID")]
      );

      const percentVal =
        mRow && mRow[mCols.indexOf("LAST")] != null
          ? mRow[mCols.indexOf("LAST")]
          : sRow[sCols.indexOf("PREVPRICE")];
      const shortName = sRow[sCols.indexOf("SHORTNAME")] || t;

      if (percentVal) {
        const faceValue = parseFloat(sRow[sCols.indexOf("FACEVALUE")] || 1000);
        const accruedInterest = parseFloat(sRow[sCols.indexOf("ACCRUEDINT")] || 0);
        const rublePrice = faceValue * (parseFloat(percentVal) / 100) + accruedInterest;
        return {
          type: "bond",
          price: rublePrice,
          shortName,
        };
      }
    }
  } catch (e) {
    console.error("Error fetching bond price for", t, e);
  }

  return null;
}

export interface MoexSearchResult {
  ticker: string;
  name: string;
  type: "share" | "bond";
}

export async function fetchMoexSearch(query: string): Promise<MoexSearchResult[]> {
  try {
    const res = await fetch(
      `https://iss.moex.com/iss/securities.json?q=${encodeURIComponent(query)}&limit=10`
    );
    const data = await res.json();
    if (!data.securities?.data?.length) return [];
    const cols: string[] = data.securities.columns;
    const rData: any[][] = data.securities.data;

    return rData
      .filter((r) => {
        const group: string = r[cols.indexOf("group")] || "";
        return (
          group.startsWith("stock_") ||
          group.startsWith("bond_") ||
          group.includes("etf")
        );
      })
      .slice(0, 9)
      .map((r) => ({
        ticker: r[cols.indexOf("secid")],
        name: r[cols.indexOf("shortname")],
        type: (r[cols.indexOf("group")] || "").includes("bond") ? "bond" : "share",
      }));
  } catch (e) {
    console.error("Error searching MOEX:", e);
    return [];
  }
}

export interface MoexEventData {
  date: string;
  value: number;
}

export async function fetchDividendData(ticker: string): Promise<MoexEventData[]> {
  try {
    const res = await fetch(
      `https://iss.moex.com/iss/securities/${ticker}/dividends.json?iss.meta=off`
    );
    const data = await res.json();
    if (data.dividends?.data?.length > 0) {
      const cols: string[] = data.dividends.columns;
      const rData: any[][] = data.dividends.data;
      return rData.map((r) => ({
        date: r[cols.indexOf("registryclosedate")],
        value: parseFloat(r[cols.indexOf("value")]),
      }));
    }
  } catch (e) {
    console.error("Error fetching dividends for", ticker, e);
  }
  return [];
}

export async function fetchCouponData(ticker: string): Promise<MoexEventData[]> {
  try {
    const res = await fetch(
      `https://iss.moex.com/iss/securities/${ticker}/bondization.json?iss.meta=off`
    );
    const data = await res.json();
    if (data.coupons?.data?.length > 0) {
      const cols: string[] = data.coupons.columns;
      const rData: any[][] = data.coupons.data;
      return rData
        .map((r) => ({
          date: r[cols.indexOf("coupondate")],
          value: parseFloat(r[cols.indexOf("value")]),
        }))
        .filter((c) => c.date && !isNaN(c.value) && c.value > 0);
    }
  } catch (e) {
    console.error("Error fetching coupons for", ticker, e);
  }
  return [];
}
