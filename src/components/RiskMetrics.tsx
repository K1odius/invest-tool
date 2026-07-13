import { Shield, Plus, TrendingUp, Sparkles, Trash2 } from "lucide-react";
import { Asset, DividendPayment } from "../types";

interface RiskMetricsProps {
  portfolio: Asset[];
  dividends: DividendPayment[];
  beta: string | number;
  maxDrawdown: string | number;
  onAddDividendPaymentClick: () => void;
  onShowDividendForecast: () => void;
  onDeleteDividend: (id: number) => void;
}

export default function RiskMetrics({
  portfolio,
  dividends,
  beta,
  maxDrawdown,
  onAddDividendPaymentClick,
  onShowDividendForecast,
  onDeleteDividend,
}: RiskMetricsProps) {
  // Sector distribution count
  const sectors = new Set(portfolio.map((a) => a.sector));

  // Determine diversification rating
  let diversificationRating = "Низкая";
  if (sectors.size >= 5 && portfolio.length >= 8) {
    diversificationRating = "Высокая 🌟";
  } else if (sectors.size >= 3 && portfolio.length >= 4) {
    diversificationRating = "Средняя 👍";
  }

  const totalDividends = dividends.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      {/* 1. Risk metrics column */}
      <div className="lg:col-span-6 flex flex-col justify-between">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-slate-100">Метрики портфеля</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Аналитика рисков, чувствительности и диверсификации на основе текущих активов и исторического моделирования.
          </p>
        </div>

        {/* Bento grid layout for risks */}
        <div className="grid grid-cols-2 gap-3">
          {/* Beta */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Beta к рынку
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {beta || "—"}
            </div>
            <p className="text-[9px] text-slate-500 mt-1">Чувствительность к IMOEX</p>
          </div>

          {/* Max drawdown */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Макс. просадка (6м)
            </div>
            <div className="text-xl font-bold text-rose-400 tracking-tight">
              {maxDrawdown ? `${maxDrawdown}` : "—"}
            </div>
            <p className="text-[9px] text-slate-500 mt-1">Худшее падение за полгода</p>
          </div>

          {/* Diversification */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Диверсификация
            </div>
            <div className="text-sm font-bold text-emerald-400 tracking-tight leading-tight">
              {diversificationRating}
            </div>
            <p className="text-[9px] text-slate-500 mt-1.5">{sectors.size} секторов представлено</p>
          </div>

          {/* Active Assets */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
              Всего активов
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {portfolio.length}
            </div>
            <p className="text-[9px] text-slate-500 mt-1">Активные позиции в бумагах</p>
          </div>
        </div>
      </div>

      {/* 2. Dividend log column */}
      <div className="lg:col-span-6 bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-slate-100">Выплаты дивидендов</h3>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={onShowDividendForecast}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition"
              >
                <Sparkles className="w-3 h-3 text-teal-400" />
                <span>Прогноз</span>
              </button>
              <button
                onClick={onAddDividendPaymentClick}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3 h-3" />
                <span>Выплата</span>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800 mb-3.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">
              Всего получено выплат
            </span>
            <span className="text-lg font-extrabold text-emerald-400">
              {totalDividends.toLocaleString("ru-RU")} ₽
            </span>
          </div>

          {/* List of recent payments */}
          <div className="max-h-24 overflow-y-auto pr-1 text-xs text-slate-300 space-y-1.5 scrollbar-thin">
            {dividends.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Лог дивидендных выплат пуст</p>
            ) : (
              [...dividends]
                .reverse()
                .slice(0, 10)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between bg-slate-900/35 px-3 py-2 rounded-lg border border-slate-800/80 hover:border-slate-700/60 transition"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-slate-200">
                        <span className="text-blue-400 font-bold">{d.ticker}</span>
                        <span>+{d.amount.toLocaleString("ru-RU")} ₽</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{d.date}</span>
                        {d.comment && <span className="truncate max-w-[150px] italic">({d.comment})</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteDividend(d.id)}
                      className="p-1 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
