import { Coins, TrendingUp, TrendingDown, Award, Calendar, Percent, RefreshCw, BarChart3 } from "lucide-react";
import { Asset, DividendPayment } from "../types";

interface StatsProps {
  portfolio: Asset[];
  dividends: DividendPayment[];
  realizedPnl: number;
  lastForecastYield: number | null;
  lastForecastDividendAmount: number;
  onShowRealizedTrades: () => void;
}

export default function Stats({
  portfolio,
  dividends,
  realizedPnl,
  lastForecastYield,
  lastForecastDividendAmount,
  onShowRealizedTrades,
}: StatsProps) {
  // Calculators
  let totalValue = 0;
  let totalInvested = 0;
  let bestAsset = { name: "—", pnlPct: -Infinity };

  portfolio.forEach((a) => {
    const qty = a.purchases.reduce((sum, p) => sum + p.qty, 0);
    const invested = a.purchases.reduce((sum, p) => sum + p.qty * p.price, 0);
    const val = qty * a.currentPrice;
    totalValue += val;
    totalInvested += invested;

    const pnl = val - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    if (qty > 0 && pnlPct > bestAsset.pnlPct) {
      bestAsset = { name: a.name, pnlPct };
    }
  });

  const totalProfit = totalValue - totalInvested;
  const totalProfitPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Manual 12-month dividends (or total dividends registered)
  const totalDividendsReceived = dividends.reduce((sum, d) => sum + d.amount, 0);
  const divYieldOnCost = totalInvested > 0 ? (totalDividendsReceived / totalInvested) * 100 : 0;
  const divYieldOnValue = totalValue > 0 ? (totalDividendsReceived / totalValue) * 100 : 0;

  const forecastYield = lastForecastYield !== null ? lastForecastYield : divYieldOnValue;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Current Value */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Текущая стоимость</span>
          <Coins className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-white tracking-tight leading-none">
            {totalValue.toLocaleString("ru-RU")} <span className="text-lg">₽</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Оценка портфеля в реальном времени</p>
        </div>
      </div>

      {/* 2. Total Invested */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Всего вложено</span>
          <BarChart3 className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-200 tracking-tight leading-none">
            {totalInvested.toLocaleString("ru-RU")} <span className="text-lg">₽</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Суммарная себестоимость покупок</p>
        </div>
      </div>

      {/* 3. Realized / Unrealized profit */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Прибыль / Убыток</span>
          {totalProfit >= 0 ? (
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-rose-400" />
          )}
        </div>
        <div>
          <div
            className={`text-2xl font-bold tracking-tight leading-none ${
              totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {totalProfit >= 0 ? "+" : ""}
            {totalProfit.toLocaleString("ru-RU")} <span className="text-lg">₽</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-xs font-semibold ${
                totalProfitPct >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {totalProfitPct >= 0 ? "+" : ""}
              {totalProfitPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-500">нереализованный результат</span>
          </div>
        </div>
      </div>

      {/* 4. Best Asset */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">🏆 Лучший актив</span>
          <Award className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-white tracking-tight leading-none truncate">
            {bestAsset.name}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {bestAsset.pnlPct !== -Infinity ? (
              <>
                <span className="text-xs font-semibold text-emerald-500">
                  +{bestAsset.pnlPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">наибольший прирост</span>
              </>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Realized Profit */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">💰 Реализ. прибыль</span>
          <RefreshCw className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div
            className={`text-xl font-bold leading-none ${
              realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {realizedPnl >= 0 ? "+" : ""}
            {realizedPnl.toLocaleString("ru-RU")} ₽
          </div>
          <button
            onClick={onShowRealizedTrades}
            className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-medium hover:underline block text-left"
          >
            📋 История закрытых сделок
          </button>
        </div>
      </div>

      {/* 6. Dividend yield (on cost) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">📈 Див. дох. (капитал)</span>
          <Percent className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-xl font-bold text-emerald-400 leading-none">
            {divYieldOnCost.toFixed(1)}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Отношение выплат к вложенным средствам</p>
        </div>
      </div>

      {/* 7. Dividend yield (on value) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">📈 Див. дох. (стоимость)</span>
          <Percent className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <div className="text-xl font-bold text-blue-400 leading-none">
            {divYieldOnValue.toFixed(1)}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Отношение выплат к текущей оценке</p>
        </div>
      </div>

      {/* 8. Forecast Dividend yield (12m) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-all">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">🔮 Див. прогноз (12 мес)</span>
          <Calendar className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <div className="text-xl font-bold text-teal-400 leading-none">
            {forecastYield.toFixed(1)}%
          </div>
          {lastForecastDividendAmount > 0 ? (
            <div className="text-xs font-semibold text-teal-300 mt-1">
              ~{lastForecastDividendAmount.toLocaleString("ru-RU")} ₽
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 mt-1">Нажмите «Прогноз» для калькуляции</p>
          )}
        </div>
      </div>
    </div>
  );
}
