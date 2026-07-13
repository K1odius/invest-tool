import { useState } from "react";
import { Search, Eye, Trash2, ArrowUpDown, Scale, Sparkles, DollarSign } from "lucide-react";
import { Asset } from "../types";

interface PortfolioTableProps {
  portfolio: Asset[];
  onShowPurchases: (id: number) => void;
  onDeleteAsset: (id: number) => void;
  onShowRebalance: () => void;
  onShowWhatIf: () => void;
  onShowSell: () => void;
}

type SortKey = "name" | "weight" | "qty" | "avg" | "price" | "value" | "pnl" | "cagr" | "roe" | "eps" | "pe" | "marketCap";

interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

export default function PortfolioTable({
  portfolio,
  onShowPurchases,
  onDeleteAsset,
  onShowRebalance,
  onShowWhatIf,
  onShowSell,
}: PortfolioTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "value", direction: "desc" });
  const [viewMode, setViewMode] = useState<"standard" | "fundamentals">("standard");

  // 1. Calculate totals and weights
  let totalValue = 0;
  portfolio.forEach((a) => {
    const qty = a.purchases.reduce((sum, p) => sum + p.qty, 0);
    totalValue += qty * a.currentPrice;
  });

  // 2. Map assets to row representations
  let rows = portfolio.map((a) => {
    const qty = a.purchases.reduce((sum, p) => sum + p.qty, 0);
    const invested = a.purchases.reduce((sum, p) => sum + p.qty * p.price, 0);
    const value = qty * a.currentPrice;
    const avgPrice = qty > 0 ? invested / qty : 0;
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;

    // Calculate CAGR (Compound Annual Growth Rate)
    // Formula: (value / invested) ^ (1 / years) - 1
    const earliestDateVal = Math.min(...a.purchases.map((p) => new Date(p.date).getTime()));
    const daysHeld = Math.max((new Date().getTime() - earliestDateVal) / 86400000, 1);
    const yearsHeld = daysHeld / 365.25;
    const cagr =
      invested > 0 && value > 0 && yearsHeld > 0.05
        ? (Math.pow(value / invested, 1 / yearsHeld) - 1) * 100
        : 0;

    return {
      asset: a,
      qty,
      avgPrice,
      invested,
      value,
      pnl,
      pnlPct,
      weight,
      cagr,
    };
  });

  // 3. Search filter
  const q = search.toLowerCase().trim();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.asset.name.toLowerCase().includes(q) ||
        r.asset.sector.toLowerCase().includes(q) ||
        (r.asset.shortName && r.asset.shortName.toLowerCase().includes(q))
    );
  }

  // 4. Sort helper
  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const getSortedRows = () => {
    const sorted = [...rows];
    const { key, direction } = sort;

    sorted.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (key) {
        case "name":
          valA = a.asset.name;
          valB = b.asset.name;
          return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "weight":
          valA = a.weight;
          valB = b.weight;
          break;
        case "qty":
          valA = a.qty;
          valB = b.qty;
          break;
        case "avg":
          valA = a.avgPrice;
          valB = b.avgPrice;
          break;
        case "price":
          valA = a.asset.currentPrice;
          valB = b.asset.currentPrice;
          break;
        case "value":
          valA = a.value;
          valB = b.value;
          break;
        case "pnl":
          valA = a.pnl;
          valB = b.pnl;
          break;
        case "cagr":
          valA = a.cagr;
          valB = b.cagr;
          break;
        case "roe":
          valA = a.asset.roe ?? -999999;
          valB = b.asset.roe ?? -999999;
          break;
        case "eps":
          valA = a.asset.eps ?? -999999;
          valB = b.asset.eps ?? -999999;
          break;
        case "pe":
          // For PE, put undefined/NaN values at the end of sort
          valA = a.asset.pe ?? (direction === "asc" ? 999999 : -999999);
          valB = b.asset.pe ?? (direction === "asc" ? 999999 : -999999);
          break;
        case "marketCap":
          valA = a.asset.marketCap ?? -999999;
          valB = b.asset.marketCap ?? -999999;
          break;
        default:
          return 0;
      }

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const sortedRows = getSortedRows();

  const renderSortIndicator = (key: SortKey) => {
    if (sort.key === key) {
      return (
        <span className="text-blue-400 font-bold ml-1.5 inline-block text-[11px]">
          {sort.direction === "asc" ? "▲" : "▼"}
        </span>
      );
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-500 ml-1 inline-block" />;
  };

  // Helper to format market capitalization beautifully
  const formatMarketCap = (val?: number): string => {
    if (!val || isNaN(val)) return "—";
    if (val >= 1_000_000_000_000) {
      return `${(val / 1_000_000_000_000).toFixed(2)} трлн ₽`;
    }
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2)} млрд ₽`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)} млн ₽`;
    }
    return `${val.toLocaleString("ru-RU")} ₽`;
  };

  return (
    <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 mb-8">
      {/* Top controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100">Мой портфель</h3>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-medium">
              {portfolio.length} активов
            </span>
          </div>

          {/* View selector segmented control */}
          <div className="flex bg-slate-800/90 p-0.5 rounded-lg border border-slate-700 text-[11px] font-medium w-fit">
            <button
              onClick={() => setViewMode("standard")}
              className={`px-3 py-1 rounded-md transition duration-150 cursor-pointer ${
                viewMode === "standard"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Основной вид
            </button>
            <button
              onClick={() => setViewMode("fundamentals")}
              className={`px-3 py-1 rounded-md transition duration-150 cursor-pointer ${
                viewMode === "fundamentals"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Фундаментальный анализ
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Название или сектор..."
              className="w-full bg-slate-800/80 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs px-3 py-2 rounded-lg pl-8"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Premium triggers */}
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onShowRebalance}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5 text-blue-400" />
              <span>Ребалансировка</span>
            </button>

            <button
              onClick={onShowWhatIf}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Что если?</span>
            </button>

            <button
              onClick={onShowSell}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Продажа</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/60">
        <table className="w-full border-collapse text-left text-xs text-slate-300">
          <thead>
            {viewMode === "standard" ? (
              <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 font-semibold select-none">
                <th
                  onClick={() => handleSort("name")}
                  className="p-3.5 cursor-pointer hover:text-white transition"
                >
                  Актив {renderSortIndicator("name")}
                </th>
                <th
                  onClick={() => handleSort("weight")}
                  className="p-3.5 cursor-pointer hover:text-white transition w-28"
                >
                  Вес {renderSortIndicator("weight")}
                </th>
                <th
                  onClick={() => handleSort("qty")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  Кол-во {renderSortIndicator("qty")}
                </th>
                <th
                  onClick={() => handleSort("avg")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  Ср. цена {renderSortIndicator("avg")}
                </th>
                <th
                  onClick={() => handleSort("price")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  Тек. цена {renderSortIndicator("price")}
                </th>
                <th
                  onClick={() => handleSort("value")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  Стоимость {renderSortIndicator("value")}
                </th>
                <th
                  onClick={() => handleSort("pnl")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  Прибыль / Убыток {renderSortIndicator("pnl")}
                </th>
                <th
                  onClick={() => handleSort("cagr")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right hidden sm:table-cell"
                  title="Среднегодовой темп роста актива"
                >
                  CAGR {renderSortIndicator("cagr")}
                </th>
                <th className="p-3.5 text-center">Действия</th>
              </tr>
            ) : (
              <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 font-semibold select-none">
                <th
                  onClick={() => handleSort("name")}
                  className="p-3.5 cursor-pointer hover:text-white transition"
                >
                  Актив {renderSortIndicator("name")}
                </th>
                <th
                  onClick={() => handleSort("price")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  Тек. цена {renderSortIndicator("price")}
                </th>
                <th
                  onClick={() => handleSort("roe")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                  title="Рентабельность капитала (Return on Equity)"
                >
                  ROE (%) {renderSortIndicator("roe")}
                </th>
                <th
                  onClick={() => handleSort("eps")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                  title="Прибыль на акцию (Earnings Per Share)"
                >
                  EPS {renderSortIndicator("eps")}
                </th>
                <th
                  onClick={() => handleSort("pe")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                  title="Коэффициент Цена / Прибыль (Price to Earnings)"
                >
                  P/E {renderSortIndicator("pe")}
                </th>
                <th
                  onClick={() => handleSort("marketCap")}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                  title="Рыночная капитализация (Market Cap)"
                >
                  Капитализация {renderSortIndicator("marketCap")}
                </th>
                <th
                  className="p-3.5 text-center"
                  title="Источник финансовых данных"
                >
                  Источник
                </th>
                <th className="p-3.5 text-center">Действия</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={viewMode === "standard" ? 9 : 8} className="p-8 text-center text-slate-500">
                  {search ? "Ничего не найдено по вашему поиску" : "Ваш инвестиционный портфель пока пуст"}
                </td>
              </tr>
            ) : (
              sortedRows.map(({ asset, qty, avgPrice, value, pnl, pnlPct, weight, cagr }) => (
                <tr key={asset.id} className="hover:bg-slate-800/40 transition">
                  {/* Common Asset Column */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-100">{asset.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          asset.type === "bond"
                            ? "bg-purple-950/60 text-purple-300 border border-purple-800/40"
                            : "bg-blue-950/60 text-blue-300 border border-blue-800/40"
                        }`}
                      >
                        {asset.type === "bond" ? "Обл." : "Акц."}
                      </span>
                    </div>
                    {asset.shortName && asset.shortName !== asset.name && (
                      <span className="block text-[11px] text-slate-400 mt-1 truncate max-w-[140px]">
                        {asset.shortName}
                      </span>
                    )}
                    <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">
                      {asset.sector}
                    </span>
                  </td>

                  {viewMode === "standard" ? (
                    <>
                      {/* Weight column with micro bar */}
                      <td className="p-3.5">
                        <span className="font-bold text-slate-200">{weight.toFixed(1)}%</span>
                        <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            style={{ width: `${weight}%` }}
                          />
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="p-3.5 text-right font-semibold text-slate-200">
                        {qty}
                      </td>

                      {/* Avg Price */}
                      <td className="p-3.5 text-right font-medium text-slate-300">
                        {avgPrice.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                      </td>

                      {/* Current Price */}
                      <td className="p-3.5 text-right font-medium text-slate-300">
                        {asset.currentPrice.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                      </td>

                      {/* Total Value */}
                      <td className="p-3.5 text-right font-bold text-white">
                        {value.toLocaleString("ru-RU", { minimumFractionDigits: 1 })} ₽
                      </td>

                      {/* P&L */}
                      <td className={`p-3.5 text-right font-semibold`}>
                        <div className={pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {pnl >= 0 ? "+" : ""}
                          {pnl.toLocaleString("ru-RU", { minimumFractionDigits: 1 })} ₽
                        </div>
                        <div className={`text-[10px] ${pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {pnl >= 0 ? "+" : ""}
                          {pnlPct.toFixed(1)}%
                        </div>
                      </td>

                      {/* CAGR */}
                      <td className="p-3.5 text-right hidden sm:table-cell">
                        {qty > 0 && cagr !== 0 ? (
                          <span className={`font-semibold ${cagr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {cagr >= 0 ? "+" : ""}
                            {cagr.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Fundamentals View Cells */}
                      {/* Current Price */}
                      <td className="p-3.5 text-right font-medium text-slate-300">
                        {asset.currentPrice.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                      </td>

                      {/* ROE cell */}
                      <td className="p-3.5 text-right font-semibold">
                        {asset.roe != null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              asset.roe > 15
                                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/40"
                                : asset.roe > 0
                                ? "bg-blue-950/60 text-blue-300 border-blue-800/40"
                                : "bg-rose-950/60 text-rose-300 border-rose-800/40"
                            }`}
                          >
                            {asset.roe > 0 ? "+" : ""}
                            {asset.roe.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* EPS cell */}
                      <td className="p-3.5 text-right font-medium text-slate-300">
                        {asset.eps != null ? (
                          <span>
                            {asset.eps.toLocaleString("ru-RU", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* P/E cell */}
                      <td className="p-3.5 text-right font-semibold">
                        {asset.pe != null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              asset.pe <= 6
                                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/40"
                                : asset.pe <= 12
                                ? "bg-blue-950/60 text-blue-300 border-blue-800/40"
                                : "bg-amber-950/60 text-amber-300 border-amber-800/40"
                            }`}
                          >
                            {asset.pe.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Market Cap cell */}
                      <td className="p-3.5 text-right font-bold text-white">
                        {formatMarketCap(asset.marketCap)}
                      </td>

                      {/* Data Source cell */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${
                            asset.dataSource === "RuData (Interfax)"
                              ? "bg-amber-950/40 text-amber-300 border-amber-900/40"
                              : asset.dataSource === "Cbonds API"
                              ? "bg-teal-950/40 text-teal-300 border-teal-900/40"
                              : asset.dataSource === "Мосбиржа (ISS)"
                              ? "bg-indigo-950/40 text-indigo-300 border-indigo-900/40"
                              : "bg-slate-800 text-slate-400 border-slate-700/60"
                          }`}
                        >
                          {asset.dataSource || "Н/Д"}
                        </span>
                      </td>
                    </>
                  )}

                  {/* Actions column */}
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onShowPurchases(asset.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition cursor-pointer"
                        title="История покупок"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteAsset(asset.id)}
                        className="p-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-900/60 text-rose-400 hover:text-white rounded-md transition cursor-pointer"
                        title="Удалить актив"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewMode === "fundamentals" && (
        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 leading-relaxed grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="font-bold text-slate-300 block mb-1">ROE (Return on Equity):</span>
            Рентабельность собственного капитала. Показывает эффективность использования средств инвесторов. Значение {`>`}15% считается отличным показателем.
          </div>
          <div>
            <span className="font-bold text-slate-300 block mb-1">EPS (Earnings Per Share):</span>
            Чистая прибыль компании, приходящаяся на одну обыкновенную акцию. Ключевой показатель прибыльности бизнеса.
          </div>
          <div>
            <span className="font-bold text-slate-300 block mb-1">P/E (Price to Earnings):</span>
            Мультипликатор «Цена / Прибыль». Показывает, за сколько лет окупятся инвестиции в компанию. Более низкий P/E сигнализирует о недооцененности.
          </div>
          <div>
            <span className="font-bold text-slate-300 block mb-1">Капитализация (Market Cap):</span>
            Рыночная стоимость всех выпущенных акций компании. Рассчитывается динамически на основе текущих рыночных котировок.
          </div>
        </div>
      )}
    </div>
  );
}
