/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, LayoutDashboard, Calendar, CheckCircle2, AlertTriangle, Trash2, FileSpreadsheet } from "lucide-react";
import { Asset, Purchase, DividendPayment, RealizedTrade, ForecastEvent, SectorEst } from "./types";
import { fetchMoexPrice, fetchDividendData, fetchCouponData } from "./lib/moex";
import { getFinancialIndicators } from "./lib/financials";

// Component imports
import Stats from "./components/Stats";
import PurchaseForm from "./components/PurchaseForm";
import PortfolioTable from "./components/PortfolioTable";
import RiskMetrics from "./components/RiskMetrics";
import SvgDoughnut from "./components/SvgDoughnut";
import SvgLineChart from "./components/SvgLineChart";

// Modals
import {
  ImportModal,
  PurchasesModal,
  EditPurchaseModal,
  AddDividendModal,
  DividendForecastModal,
  RebalanceModal,
  WhatIfModal,
  SellModal,
  RealizedTradesModal,
} from "./components/Modals";

interface CustomConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  type?: "danger" | "warning" | "info";
}

interface CustomAlertConfig {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
}

export default function App() {
  // ==================== STATE MANAGEMENT ====================
  const [portfolio, setPortfolio] = useState<Asset[]>([]);
  const [dividends, setDividends] = useState<DividendPayment[]>([]);
  const [realizedTrades, setRealizedTrades] = useState<RealizedTrade[]>([]);

  // Custom confirm and alert state
  const [customConfirm, setCustomConfirm] = useState<CustomConfirmConfig | null>(null);
  const [customAlert, setCustomAlert] = useState<CustomAlertConfig | null>(null);

  // UI States
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);



  // Modal control states
  const [activeModal, setActiveModal] = useState<
    "import" | "purchases" | "edit" | "dividend" | "forecast" | "rebalance" | "whatif" | "sell" | "realized" | null
  >(null);

  // Selection states
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // Backtest state
  const [backtestDates, setBacktestDates] = useState<string[]>([]);
  const [backtestPortReturns, setBacktestPortReturns] = useState<number[]>([]);
  const [backtestIndexReturns, setBacktestIndexReturns] = useState<number[]>([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestMaxDD, setBacktestMaxDD] = useState<number | string>("—");
  const [backtestBeta, setBacktestBeta] = useState<number | string>("—");

  // Forecast states
  const [forecastLoading, setForecastLoading] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<ForecastEvent[]>([]);
  const [historicalEst, setHistoricalEst] = useState<SectorEst[]>([]);
  const [forecastTotal, setForecastTotal] = useState(0);
  const [lastForecastYield, setLastForecastYield] = useState<number | null>(null);

  // ==================== CORE PERSISTENCE LOADERS ====================
  useEffect(() => {
    const saved = localStorage.getItem("proPortfolioV5") || localStorage.getItem("proPortfolioV4");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.portfolio) setPortfolio(data.portfolio);
        if (data.dividends) setDividends(data.dividends);
        if (data.realizedTrades) setRealizedTrades(data.realizedTrades);
      } catch (e) {
        console.error("Error loading local storage data:", e);
      }
    }
  }, []);

  const saveAll = (
    updatedPortfolio: Asset[],
    updatedDividends: DividendPayment[],
    updatedRealizedTrades: RealizedTrade[]
  ) => {
    // Save locally
    localStorage.setItem(
      "proPortfolioV5",
      JSON.stringify({
        portfolio: updatedPortfolio,
        dividends: updatedDividends,
        realizedTrades: updatedRealizedTrades,
      })
    );
  };

  // ==================== REFRESH LIVE TICKER PRICES ====================
  const refreshAllPrices = useCallback(async (currentPortfolio: Asset[]) => {
    if (currentPortfolio.length === 0) return;
    setRefreshLoading(true);
    const updated = [...currentPortfolio];

    for (let i = 0; i < updated.length; i++) {
      const asset = updated[i];
      try {
        const data = await fetchMoexPrice(asset.name);
        if (data) {
          const indicators = await getFinancialIndicators(asset.name, data.price);
          updated[i] = {
            ...asset,
            currentPrice: data.price,
            shortName: data.shortName || asset.shortName,
            roe: indicators.roe,
            eps: indicators.eps,
            pe: indicators.pe,
            marketCap: indicators.marketCap,
            dataSource: indicators.dataSource,
          };
        }
      } catch (e) {
        console.error("Error refreshing ticker price:", asset.name, e);
      }
      // Delay slightly to prevent rate limiting
      await new Promise((r) => setTimeout(r, 60));
    }

    setPortfolio(updated);
    saveAll(updated, dividends, realizedTrades);
    setRefreshLoading(false);
  }, [dividends, realizedTrades]);

  // Handle initial refresh on start
  useEffect(() => {
    const saved = localStorage.getItem("proPortfolioV5") || localStorage.getItem("proPortfolioV4");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.portfolio && data.portfolio.length > 0) {
          refreshAllPrices(data.portfolio);
        }
      } catch (e) {}
    }
  }, [refreshAllPrices]);

  // Auto refresh interval loop
  useEffect(() => {
    if (!autoRefresh || portfolio.length === 0) return;
    const interval = setInterval(() => {
      refreshAllPrices(portfolio);
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, portfolio, refreshAllPrices]);

  // ==================== MOEX TRANSACTIONS ADDER ====================
  const handleAddPurchase = async (
    name: string,
    sector: string,
    date: string,
    qty: number,
    price: number
  ): Promise<boolean> => {
    const tickerName = name.toUpperCase().trim();
    try {
      const data = await fetchMoexPrice(tickerName);
      if (!data) return false;

      const indicators = await getFinancialIndicators(tickerName, data.price);

      const updated = [...portfolio];
      const existingIdx = updated.findIndex((a) => a.name === tickerName);

      const newPurchase: Purchase = {
        id: Date.now() + Math.random(),
        date,
        qty,
        price,
      };

      if (existingIdx !== -1) {
        const existing = updated[existingIdx];
        updated[existingIdx] = {
          ...existing,
          sector: sector !== existing.sector ? sector : existing.sector,
          currentPrice: data.price,
          shortName: data.shortName || existing.shortName,
          purchases: [...existing.purchases, newPurchase],
          roe: indicators.roe,
          eps: indicators.eps,
          pe: indicators.pe,
          marketCap: indicators.marketCap,
          dataSource: indicators.dataSource,
        };
      } else {
        updated.push({
          id: Date.now() + Math.random(),
          name: tickerName,
          shortName: data.shortName || tickerName,
          type: data.type,
          sector,
          currentPrice: data.price,
          purchases: [newPurchase],
          roe: indicators.roe,
          eps: indicators.eps,
          pe: indicators.pe,
          marketCap: indicators.marketCap,
          dataSource: indicators.dataSource,
        });
      }

      setPortfolio(updated);
      saveAll(updated, dividends, realizedTrades);
      return true;
    } catch (e) {
      console.error("Error adding purchase transaction:", e);
      return false;
    }
  };

  // ==================== CSV BULK IMPORTER ====================
  const handleCSVImport = async (rows: any[], mode: "add" | "replace") => {
    let basePortfolio = mode === "replace" ? [] : [...portfolio];

    for (const r of rows) {
      const tickerName = r.name.toUpperCase().trim();
      const existingIdx = basePortfolio.findIndex((a) => a.name === tickerName);

      const newPurchase: Purchase = {
        id: Date.now() + Math.random(),
        date: r.date,
        qty: r.qty,
        price: r.price,
      };

      if (existingIdx !== -1) {
        basePortfolio[existingIdx].purchases.push(newPurchase);
      } else {
        // Find prices and names
        let type: "share" | "bond" = "share";
        let livePrice = r.price;
        let shortName = tickerName;
        let roe: number | undefined;
        let eps: number | undefined;
        let pe: number | undefined;
        let marketCap: number | undefined;
        let dataSource: string | undefined;

        try {
          const live = await fetchMoexPrice(tickerName);
          if (live) {
            type = live.type;
            livePrice = live.price;
            shortName = live.shortName || tickerName;

            const indicators = await getFinancialIndicators(tickerName, livePrice);
            roe = indicators.roe;
            eps = indicators.eps;
            pe = indicators.pe;
            marketCap = indicators.marketCap;
            dataSource = indicators.dataSource;
          }
        } catch (e) {}

        basePortfolio.push({
          id: Date.now() + Math.random(),
          name: tickerName,
          shortName,
          type,
          sector: r.sector,
          currentPrice: livePrice,
          purchases: [newPurchase],
          roe,
          eps,
          pe,
          marketCap,
          dataSource,
        });

        // Prevention limit delay
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    setPortfolio(basePortfolio);
    saveAll(basePortfolio, dividends, realizedTrades);
    alert("Данные из файла успешно импортированы!");
  };

  // ==================== DYNAMIC 12M DIVIDEND FORECAST ====================
  const handleCalculateForecast = async () => {
    if (portfolio.length === 0) return;
    setForecastLoading(true);
    setActiveModal("forecast");

    const upcoming: ForecastEvent[] = [];
    const historical: SectorEst[] = [];

    const today = new Date().toISOString().split("T")[0];
    const d1yrAgo = new Date();
    d1yrAgo.setFullYear(d1yrAgo.getFullYear() - 1);
    const oneYearAgo = d1yrAgo.toISOString().split("T")[0];

    const d1yrAhead = new Date();
    d1yrAhead.setFullYear(d1yrAhead.getFullYear() + 1);
    const oneYearAhead = d1yrAhead.toISOString().split("T")[0];

    for (const asset of portfolio) {
      const qty = asset.purchases.reduce((sum, p) => sum + p.qty, 0);
      if (qty <= 0) continue;

      const isBond = asset.type === "bond";
      const events = isBond ? await fetchCouponData(asset.name) : await fetchDividendData(asset.name);
      await new Promise((r) => setTimeout(r, 70)); // Anti rate limits

      // 1. Find future registry closing dates up to 12 months ahead (confirmed)
      const futureEvents = events.filter((e) => e.date >= today && e.date <= oneYearAhead && e.value > 0);
      const assetConfirmed: ForecastEvent[] = [];

      futureEvents.forEach((e) => {
        const sum = e.value * qty;
        assetConfirmed.push({
          ticker: asset.name,
          date: e.date,
          value: e.value,
          sum,
          type: isBond ? "Купон" : "Див.",
          status: "confirmed",
        });
      });

      // 2. Find historical events in the past 12 months and project them 1 year forward
      const pastEvents = events.filter((e) => e.date >= oneYearAgo && e.date < today && e.value > 0);
      const assetProjected: ForecastEvent[] = [];

      pastEvents.forEach((e) => {
        // Project 1 year forward
        const originalDate = new Date(e.date);
        originalDate.setFullYear(originalDate.getFullYear() + 1);
        const projectedDateStr = originalDate.toISOString().split("T")[0];

        if (projectedDateStr >= today && projectedDateStr <= oneYearAhead) {
          // Check if we already have a confirmed event for this company in that calendar month
          const projMonth = projectedDateStr.slice(0, 7); // "YYYY-MM"
          const hasConfirmedInSameMonth = assetConfirmed.some(
            (c) => c.date.slice(0, 7) === projMonth
          );

          if (!hasConfirmedInSameMonth) {
            const sum = e.value * qty;
            assetProjected.push({
              ticker: asset.name,
              date: projectedDateStr,
              value: e.value,
              sum,
              type: isBond ? "Купон" : "Див.",
              status: "projected",
            });
          }
        }
      });

      // Merge confirmed and projected events
      upcoming.push(...assetConfirmed);
      upcoming.push(...assetProjected);

      // Compute total 12M expected sum for this asset (confirmed + projected)
      const assetTotalSum = assetConfirmed.reduce((s, x) => s + x.sum, 0) + assetProjected.reduce((s, x) => s + x.sum, 0);
      if (assetTotalSum > 0) {
        historical.push({
          ticker: asset.name,
          sum: assetTotalSum,
        });
      }
    }

    // Sort upcoming events by date
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    
    // Sort company totals by sum descending
    historical.sort((a, b) => b.sum - a.sum);

    const fTotal = upcoming.reduce((s, x) => s + x.sum, 0);
    setUpcomingEvents(upcoming);
    setHistoricalEst(historical);
    setForecastTotal(fTotal);

    const currentTotalValue = portfolio.reduce(
      (sum, a) => sum + a.purchases.reduce((s, p) => s + p.qty, 0) * a.currentPrice,
      0
    );
    const calculatedYield = currentTotalValue > 0 ? (fTotal / currentTotalValue) * 100 : 0;
    setLastForecastYield(calculatedYield);

    setForecastLoading(false);
  };

  // ==================== 6-MONTH BACKTEST GENERATOR ====================
  const handleBuildBacktest = async () => {
    if (portfolio.length === 0) return;
    setBacktestLoading(true);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 6);
    const fromStr = fromDate.toISOString().split("T")[0];

    try {
      // 1. Fetch IMOEX index candles
      const indexRes = await fetch(
        `https://iss.moex.com/iss/engines/stock/markets/index/securities/IMOEX/candles.json?interval=24&from=${fromStr}`
      );
      const idxJson = await indexRes.json();
      const indexMap: Record<string, number> = {};
      const dates: string[] = [];

      if (idxJson.candles?.data?.length) {
        const closeIdx = idxJson.candles.columns.indexOf("close");
        const beginIdx = idxJson.candles.columns.indexOf("begin");
        idxJson.candles.data.forEach((r: any[]) => {
          const dateStr = r[beginIdx].split(" ")[0];
          indexMap[dateStr] = r[closeIdx];
          dates.push(dateStr);
        });
      }

      // 2. Fetch historical candle lines for each ticker with robust forward-filling
      const assetHistory: Record<string, Record<string, number>> = {};
      for (const asset of portfolio) {
        const mkt = asset.type === "bond" ? "bonds" : "shares";
        try {
          const res = await fetch(
            `https://iss.moex.com/iss/engines/stock/markets/${mkt}/securities/${asset.name}/candles.json?interval=24&from=${fromStr}`
          );
          const j = await res.json();
          const hist: Record<string, number> = {};
          if (j.candles?.data?.length) {
            const closeIdx = j.candles.columns.indexOf("close");
            const beginIdx = j.candles.columns.indexOf("begin");
            j.candles.data.forEach((r: any[]) => {
              const dateStr = r[beginIdx].split(" ")[0];
              let price = r[closeIdx];
              // Convert bond coupon percent coordinates to absolute Rubles
              if (asset.type === "bond") {
                price = price * 10;
              }
              hist[dateStr] = price;
            });
          }

          // Forward fill the prices for all dates to prevent drifting/coordinate misalignment
          let lastPrice = asset.currentPrice;
          const sortedHistDates = Object.keys(hist).sort();
          if (sortedHistDates.length > 0) {
            lastPrice = hist[sortedHistDates[0]];
          }

          const filledHist: Record<string, number> = {};
          dates.forEach((d) => {
            if (hist[d] !== undefined) {
              lastPrice = hist[d];
            }
            filledHist[d] = lastPrice;
          });

          assetHistory[asset.name] = filledHist;
        } catch (e) {
          console.error("Error loading historical candles for backtest", asset.name, e);
          const filledHist: Record<string, number> = {};
          dates.forEach((d) => {
            filledHist[d] = asset.currentPrice;
          });
          assetHistory[asset.name] = filledHist;
        }
        await new Promise((r) => setTimeout(r, 65));
      }

      // 3. Assemble backtest return lists
      const finalDates: string[] = [];
      const portReturns: number[] = [];
      const indexReturns: number[] = [];

      let startPort: number | null = null;
      let startIndex: number | null = null;
      let peakRet = 0;
      let maxDD = 0;

      dates.forEach((d) => {
        let dailyVal = 0;
        portfolio.forEach((asset) => {
          const qty = asset.purchases.reduce((s, p) => s + p.qty, 0);
          const histPrice = assetHistory[asset.name]?.[d] || asset.currentPrice;
          dailyVal += histPrice * qty;
        });

        const idxPrice = indexMap[d];
        if (!idxPrice) return;

        if (startPort === null) startPort = dailyVal;
        if (startIndex === null) startIndex = idxPrice;

        const portRet = startPort > 0 ? ((dailyVal - startPort) / startPort) * 100 : 0;
        const indexRet = startIndex > 0 ? ((idxPrice - startIndex) / startIndex) * 100 : 0;

        if (portRet > peakRet) peakRet = portRet;
        const dd = peakRet - portRet;
        if (dd > maxDD) maxDD = dd;

        finalDates.push(d);
        portReturns.push(portRet);
        indexReturns.push(indexRet);
      });

      setBacktestDates(finalDates);
      setBacktestPortReturns(portReturns);
      setBacktestIndexReturns(indexReturns);
      setBacktestMaxDD(`-${maxDD.toFixed(1)}%`);

      // 4. Calculate Beta Coefficient relative to IMOEX
      if (portReturns.length > 5) {
        const len = portReturns.length;
        let sumPort = 0;
        let sumIdx = 0;
        let sumProd = 0;
        let sumIdxSq = 0;

        for (let i = 0; i < len; i++) {
          sumPort += portReturns[i];
          sumIdx += indexReturns[i];
          sumProd += portReturns[i] * indexReturns[i];
          sumIdxSq += indexReturns[i] * indexReturns[i];
        }

        const covariance = (sumProd - (sumPort * sumIdx) / len) / (len - 1);
        const variance = (sumIdxSq - (sumIdx * sumIdx) / len) / (len - 1);
        const calculatedBeta = variance !== 0 ? covariance / variance : 1;
        setBacktestBeta(calculatedBeta.toFixed(2));
      }
    } catch (e) {
      console.error("Backtest generation failed", e);
      setCustomAlert({
        title: "Ошибка",
        message: "Ошибка построения истории бэктеста. Проверьте подключение к интернету.",
        type: "error"
      });
    } finally {
      setBacktestLoading(false);
    }
  };

  // ==================== ASSET REMOVES & SALES ====================
  const handleDeleteAsset = (id: number) => {
    setCustomConfirm({
      title: "Удаление актива",
      message: "Вы действительно хотите удалить этот актив и всю связанную историю покупок?",
      confirmText: "Удалить",
      type: "danger",
      onConfirm: () => {
        const updated = portfolio.filter((a) => a.id !== id);
        setPortfolio(updated);
        saveAll(updated, dividends, realizedTrades);
        setCustomConfirm(null);
      }
    });
  };

  const handleClearAllData = () => {
    setCustomConfirm({
      title: "Полная очистка портфеля",
      message: "Вы действительно хотите ПОЛНОСТЬЮ очистить портфель, историю покупок, сделок и дивидендов? Это действие необратимо!",
      confirmText: "Удалить всё",
      type: "danger",
      onConfirm: () => {
        setPortfolio([]);
        setDividends([]);
        setRealizedTrades([]);
        saveAll([], [], []);
        setCustomConfirm(null);
        setCustomAlert({
          title: "Успех",
          message: "Все данные портфеля успешно удалены.",
          type: "success"
        });
      }
    });
  };

  const handleSellAsset = (ticker: string, qtyToSell: number, price: number, date: string) => {
    const assetIdx = portfolio.findIndex((a) => a.name === ticker);
    if (assetIdx === -1) return;

    const asset = portfolio[assetIdx];
    // Sort transactions oldest first (FIFO)
    const sortedPurchases = [...asset.purchases].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let remaining = qtyToSell;
    let costBasis = 0;

    const remainingPurchases: Purchase[] = [];

    for (const p of sortedPurchases) {
      if (remaining <= 0) {
        remainingPurchases.push(p);
        continue;
      }

      const take = Math.min(p.qty, remaining);
      costBasis += take * p.price;
      p.qty -= take;
      remaining -= take;

      if (p.qty > 0.000001) {
        remainingPurchases.push(p);
      }
    }

    const proceeds = qtyToSell * price;
    const pnl = proceeds - costBasis;

    const newTrade: RealizedTrade = {
      id: Date.now() + Math.random(),
      ticker,
      qty: qtyToSell,
      price,
      date,
      costBasis,
      proceeds,
      pnl,
    };

    const updatedTrades = [...realizedTrades, newTrade];
    setRealizedTrades(updatedTrades);

    let updatedPortfolio = [...portfolio];
    if (remainingPurchases.length === 0) {
      // Asset completely liquidated
      updatedPortfolio = updatedPortfolio.filter((a) => a.name !== ticker);
    } else {
      updatedPortfolio[assetIdx] = {
        ...asset,
        purchases: remainingPurchases,
      };
    }

    setPortfolio(updatedPortfolio);
    saveAll(updatedPortfolio, dividends, updatedTrades);
  };

  // Delete realized trades records
  const handleDeleteRealizedTrade = (id: number) => {
    setCustomConfirm({
      title: "Удаление записи",
      message: "Удалить запись об этой продаже? (Это не восстановит проданные активы)",
      confirmText: "Удалить",
      type: "warning",
      onConfirm: () => {
        const updated = realizedTrades.filter((t) => t.id !== id);
        setRealizedTrades(updated);
        saveAll(portfolio, dividends, updated);
        setCustomConfirm(null);
      }
    });
  };

  // Manual Dividends logger actions
  const handleAddDividend = (ticker: string, amount: number, date: string, comment: string) => {
    const updated = [
      ...dividends,
      {
        id: Date.now(),
        ticker,
        amount,
        date,
        comment,
      },
    ];
    setDividends(updated);
    saveAll(portfolio, updated, realizedTrades);
  };

  const handleDeleteDividend = (id: number) => {
    setCustomConfirm({
      title: "Удаление начисления",
      message: "Вы действительно хотите удалить эту запись о дивидендах/купонах?",
      confirmText: "Удалить",
      type: "warning",
      onConfirm: () => {
        const updated = dividends.filter((d) => d.id !== id);
        setDividends(updated);
        saveAll(portfolio, updated, realizedTrades);
        setCustomConfirm(null);
      }
    });
  };

  // Transactions list triggers inside purchases modal
  const handleSaveEditedPurchase = (date: string, qty: number, price: number) => {
    if (!selectedAsset || !selectedPurchase) return;

    const updatedPortfolio = portfolio.map((a) => {
      if (a.id === selectedAsset.id) {
        const updatedPurchases = a.purchases.map((p) => {
          if (p.id === selectedPurchase.id) {
            return { ...p, date, qty, price };
          }
          return p;
        });
        return { ...a, purchases: updatedPurchases };
      }
      return a;
    });

    setPortfolio(updatedPortfolio);
    saveAll(updatedPortfolio, dividends, realizedTrades);

    // Refresh modal states
    const found = updatedPortfolio.find((x) => x.id === selectedAsset.id);
    if (found) setSelectedAsset(found);
    setActiveModal("purchases");
  };

  const handleDeleteSubPurchase = (purchaseId: number) => {
    if (!selectedAsset) return;
    setCustomConfirm({
      title: "Удаление сделки покупки",
      message: "Вы действительно хотите удалить эту сделку из истории?",
      confirmText: "Удалить",
      type: "danger",
      onConfirm: () => {
        const updatedPortfolio = portfolio
          .map((a) => {
            if (a.id === selectedAsset.id) {
              const filtered = a.purchases.filter((p) => p.id !== purchaseId);
              return { ...a, purchases: filtered };
            }
            return a;
          })
          .filter((a) => a.purchases.length > 0);

        setPortfolio(updatedPortfolio);
        saveAll(updatedPortfolio, dividends, realizedTrades);

        const found = updatedPortfolio.find((x) => x.id === selectedAsset.id);
        if (found) {
          setSelectedAsset(found);
          setActiveModal("purchases");
        } else {
          setActiveModal(null);
          setSelectedAsset(null);
        }
        setCustomConfirm(null);
      }
    });
  };

  // JSON files exporter
  const handleExportJSON = () => {
    const dataStr = JSON.stringify({ portfolio, dividends, realizedTrades }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invest_portfolio_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON files importer
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.portfolio) {
          setPortfolio(parsed.portfolio);
          setDividends(parsed.dividends || []);
          setRealizedTrades(parsed.realizedTrades || []);
          saveAll(parsed.portfolio, parsed.dividends || [], parsed.realizedTrades || []);
          alert("Данные JSON успешно импортированы!");
        } else {
          alert("Неверный формат JSON файла.");
        }
      } catch (err) {
        alert("Ошибка разбора JSON файла.");
      }
    };
    reader.readAsText(file);
  };

  // Calculate charts datasets
  const chartAssetWeights = portfolio.map((a) => {
    const qty = a.purchases.reduce((s, p) => s + p.qty, 0);
    return {
      label: a.name,
      value: qty * a.currentPrice,
    };
  });

  const sectorsRecord: Record<string, number> = {};
  portfolio.forEach((a) => {
    const qty = a.purchases.reduce((s, p) => s + p.qty, 0);
    sectorsRecord[a.sector] = (sectorsRecord[a.sector] || 0) + qty * a.currentPrice;
  });

  const chartSectorWeights = Object.keys(sectorsRecord).map((k) => ({
    label: k,
    value: sectorsRecord[k],
  }));

  const typesRecord: Record<string, number> = {};
  portfolio.forEach((a) => {
    const qty = a.purchases.reduce((s, p) => s + p.qty, 0);
    const typeLabel =
      a.type === "bond" ? "Облигации" : a.sector === "Фонды (ETF)" ? "Фонды" : "Акции";
    typesRecord[typeLabel] = (typesRecord[typeLabel] || 0) + qty * a.currentPrice;
  });

  const chartTypeWeights = Object.keys(typesRecord).map((k) => ({
    label: k,
    value: typesRecord[k],
  }));

  const realizedPnl = realizedTrades.reduce((sum, t) => sum + t.pnl, 0);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 font-sans p-4 sm:p-6 antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header toolbar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>💼 PRO Инвест</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                  Analytics
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">Инвестиционный портфель и котировки MOEX</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Auto Refresh switch */}
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-300">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span className="ml-2">Автообновление (60 сек)</span>
              </label>
            </div>

            {/* Quick backup controls */}
            <div className="flex gap-1.5">
              <button
                onClick={handleExportJSON}
                className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Экспорт в файл"
              >
                📥 JSON
              </button>
              <label className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5">
                📤 JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setActiveModal("import")}
                className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Импорт Excel</span>
              </button>
              <button
                onClick={() => refreshAllPrices(portfolio)}
                disabled={refreshLoading || portfolio.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white font-semibold text-xs px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshLoading ? "animate-spin" : ""}`} />
                <span>Цены</span>
              </button>
              <button
                onClick={handleClearAllData}
                disabled={portfolio.length === 0 && dividends.length === 0 && realizedTrades.length === 0}
                className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 disabled:opacity-40 disabled:hover:bg-rose-950/40 text-rose-400 hover:text-white font-semibold text-xs px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Очистить портфель полностью"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить портфель</span>
              </button>
            </div>
          </div>
        </header>



        {/* Dashboard statistics section */}
        <Stats
          portfolio={portfolio}
          dividends={dividends}
          realizedPnl={realizedPnl}
          lastForecastYield={lastForecastYield}
          lastForecastDividendAmount={forecastTotal}
          onShowRealizedTrades={() => setActiveModal("realized")}
        />

        {/* Add purchase Form */}
        <PurchaseForm onAddPurchase={handleAddPurchase} />

        {/* Portfolio detailed records table */}
        <PortfolioTable
          portfolio={portfolio}
          onShowPurchases={(id) => {
            const found = portfolio.find((a) => a.id === id);
            if (found) {
              setSelectedAsset(found);
              setActiveModal("purchases");
            }
          }}
          onDeleteAsset={handleDeleteAsset}
          onShowRebalance={() => setActiveModal("rebalance")}
          onShowWhatIf={() => setActiveModal("whatif")}
          onShowSell={() => setActiveModal("sell")}
        />

        {/* Analytics charts section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
              <span>Структура активов</span>
            </h3>
            <div className="h-56">
              <SvgDoughnut items={chartAssetWeights} title="Активы" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-purple-500 rounded-full" />
              <span>Диверсификация по секторам</span>
            </h3>
            <div className="h-56">
              <SvgDoughnut items={chartSectorWeights} title="Сектора" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
              <span>Классы активов</span>
            </h3>
            <div className="h-56">
              <SvgDoughnut items={chartTypeWeights} title="Классы" />
            </div>
          </div>
        </div>

        {/* History modelling Backtest IMOEX */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>📈 Бэктест vs Индекс МосБиржи (6 месяцев)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Моделирование доходности портфеля на исторических свечах Московской Биржи по сравнению с IMOEX
              </p>
            </div>

            <button
              onClick={handleBuildBacktest}
              disabled={backtestLoading || portfolio.length === 0}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-850 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
            >
              {backtestLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Построение...</span>
                </>
              ) : (
                <span>Построить исторический график</span>
              )}
            </button>
          </div>

          {backtestDates.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/45 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Портфель</span>
                <strong
                  className={`text-sm font-extrabold ${
                    backtestPortReturns[backtestPortReturns.length - 1] >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {backtestPortReturns[backtestPortReturns.length - 1] >= 0 ? "+" : ""}
                  {backtestPortReturns[backtestPortReturns.length - 1].toFixed(1)}%
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Индекс МосБиржи</span>
                <strong
                  className={`text-sm font-extrabold ${
                    backtestIndexReturns[backtestIndexReturns.length - 1] >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {backtestIndexReturns[backtestIndexReturns.length - 1] >= 0 ? "+" : ""}
                  {backtestIndexReturns[backtestIndexReturns.length - 1].toFixed(1)}%
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Опережение</span>
                <strong
                  className={`text-sm font-extrabold ${
                    backtestPortReturns[backtestPortReturns.length - 1] -
                      backtestIndexReturns[backtestIndexReturns.length - 1] >=
                    0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {backtestPortReturns[backtestPortReturns.length - 1] -
                    backtestIndexReturns[backtestIndexReturns.length - 1] >=
                  0
                    ? "+"
                    : ""}
                  {(
                    backtestPortReturns[backtestPortReturns.length - 1] -
                    backtestIndexReturns[backtestIndexReturns.length - 1]
                  ).toFixed(1)}
                  %
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Макс. просадка</span>
                <strong className="text-sm font-extrabold text-rose-400">{backtestMaxDD}</strong>
              </div>
            </div>
          )}

          <div className="mt-2">
            <SvgLineChart
              dates={backtestDates}
              portfolioData={backtestPortReturns}
              indexData={backtestIndexReturns}
              loading={backtestLoading}
            />
          </div>
        </div>

        {/* Risk & Dividend logging Section */}
        <RiskMetrics
          portfolio={portfolio}
          dividends={dividends}
          beta={backtestBeta}
          maxDrawdown={backtestMaxDD}
          onAddDividendPaymentClick={() => setActiveModal("dividend")}
          onShowDividendForecast={handleCalculateForecast}
          onDeleteDividend={handleDeleteDividend}
        />
      </div>

      {/* ==================== ALL POPUP DIALOGS ==================== */}
      <ImportModal
        isOpen={activeModal === "import"}
        onClose={() => setActiveModal(null)}
        onImport={handleCSVImport}
      />

      <PurchasesModal
        isOpen={activeModal === "purchases"}
        onClose={() => {
          setActiveModal(null);
          setSelectedAsset(null);
        }}
        asset={selectedAsset}
        onEditPurchase={(p) => {
          setSelectedPurchase(p);
          setActiveModal("edit");
        }}
        onDeletePurchase={handleDeleteSubPurchase}
      />

      <EditPurchaseModal
        isOpen={activeModal === "edit"}
        onClose={() => setActiveModal("purchases")}
        purchase={selectedPurchase}
        onSave={handleSaveEditedPurchase}
      />

      <AddDividendModal
        isOpen={activeModal === "dividend"}
        onClose={() => setActiveModal(null)}
        portfolio={portfolio}
        onAdd={handleAddDividend}
      />

      <DividendForecastModal
        isOpen={activeModal === "forecast"}
        onClose={() => setActiveModal(null)}
        loading={forecastLoading}
        upcomingEvents={upcomingEvents}
        historicalEst={historicalEst}
        forecastTotal={forecastTotal}
        totalDividendsReceived={dividends.reduce((s, d) => s + d.amount, 0)}
        portfolio={portfolio}
      />

      <RebalanceModal
        isOpen={activeModal === "rebalance"}
        onClose={() => setActiveModal(null)}
        portfolio={portfolio}
      />

      <WhatIfModal
        isOpen={activeModal === "whatif"}
        onClose={() => setActiveModal(null)}
        portfolio={portfolio}
      />

      <SellModal
        isOpen={activeModal === "sell"}
        onClose={() => setActiveModal(null)}
        portfolio={portfolio}
        onSell={handleSellAsset}
      />

      <RealizedTradesModal
        isOpen={activeModal === "realized"}
        onClose={() => setActiveModal(null)}
        trades={realizedTrades}
        onDeleteTrade={handleDeleteRealizedTrade}
      />

      {/* Custom Confirmation Modal */}
      {customConfirm && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                customConfirm.type === "danger"
                  ? "bg-rose-500/10 text-rose-400"
                  : customConfirm.type === "warning"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-blue-500/10 text-blue-400"
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">{customConfirm.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{customConfirm.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCustomConfirm(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer transition-all"
              >
                {customConfirm.cancelText || "Отмена"}
              </button>
              <button
                type="button"
                onClick={customConfirm.onConfirm}
                className={`px-3.5 py-2 text-white font-bold text-xs rounded-lg cursor-pointer transition-all ${
                  customConfirm.type === "danger"
                    ? "bg-rose-600 hover:bg-rose-500"
                    : customConfirm.type === "warning"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {customConfirm.confirmText || "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                customAlert.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : customAlert.type === "error"
                  ? "bg-rose-500/10 text-rose-400"
                  : "bg-blue-500/10 text-blue-400"
              }`}>
                {customAlert.type === "success" ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">{customAlert.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{customAlert.message}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg cursor-pointer transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
