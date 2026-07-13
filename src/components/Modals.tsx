import React, { useState, useEffect } from "react";
import { X, FileSpreadsheet, Download, RefreshCw, AlertCircle, Edit2, Trash2, Calendar, Percent, TrendingUp, Coins, Info, HelpCircle, Briefcase } from "lucide-react";
import { Asset, Purchase, DividendPayment, RealizedTrade, ForecastEvent, SectorEst } from "../types";
import { fetchMoexPrice } from "../lib/moex";

// ==========================================
// 1. IMPORT MODAL
// ==========================================
interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: any[], mode: "add" | "replace") => Promise<void>;
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const downloadCsvTemplate = () => {
    const csv = "\uFEFFТикер,Сектор,Дата,Количество,Цена\nSBER,Финансы,2026-01-10,10,265.50\nLKOH,Нефтегаз,2026-02-15,2,7100.00\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invest_portfolio_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (c === '"' && next === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === "," || c === ";") {
          row.push(field);
          field = "";
        } else if (c === "\r") {
          // Skip
        } else if (c === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else {
          field += c;
        }
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell && cell.trim() !== ""));
  };

  const normalizeDate = (raw: string) => {
    if (!raw) return new Date().toISOString().split("T")[0];
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(s);
    return isNaN(d.getTime())
      ? new Date().toISOString().split("T")[0]
      : d.toISOString().split("T")[0];
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!file) {
      setErrorMsg("Выберите файл для импорта.");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const csvRows = parseCSV(text);
      if (csvRows.length < 2) {
        throw new Error("Файл не содержит записей.");
      }

      const header = csvRows[0].map((h) => h.toLowerCase().trim());
      const findColIdx = (names: string[]) => {
        for (const name of names) {
          const idx = header.findIndex((h) => h.includes(name));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const tickerCol = findColIdx(["ticker", "тикер", "symbol", "актив"]);
      const sectorCol = findColIdx(["sector", "сектор"]);
      const dateCol = findColIdx(["date", "дата"]);
      const qtyCol = findColIdx(["qty", "количество", "кол-во", "кол"]);
      const priceCol = findColIdx(["price", "цена", "цена покупки"]);

      if (tickerCol === -1 || qtyCol === -1 || priceCol === -1) {
        throw new Error(
          "Файл должен содержать столбцы: Тикер, Количество, Цена покупки."
        );
      }

      const validatedRows: any[] = [];
      for (let i = 1; i < csvRows.length; i++) {
        const row = csvRows[i];
        if (!row || row.length === 0) continue;

        const name = (row[tickerCol] || "").toUpperCase().trim();
        const sector = sectorCol !== -1 ? (row[sectorCol] || "").trim() : "Другое";
        const date = dateCol !== -1 ? normalizeDate(row[dateCol]) : new Date().toISOString().split("T")[0];
        const qtyVal = row[qtyCol]?.replace(",", ".").replace(/\s/g, "") || "0";
        const priceVal = row[priceCol]?.replace(",", ".").replace(/\s/g, "") || "0";

        const qty = parseFloat(qtyVal);
        const price = parseFloat(priceVal);

        if (name && !isNaN(qty) && !isNaN(price) && qty > 0) {
          validatedRows.push({ name, sector: sector || "Другое", date, qty, price });
        }
      }

      if (validatedRows.length === 0) {
        throw new Error("Не найдено корректных строк для импорта.");
      }

      await onImport(validatedRows, mode);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Ошибка чтения файла.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Импорт сделок (Excel / CSV)</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleImportSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Вы можете выгрузить сделки из Google Таблиц в CSV или составить собственный файл. Обязательные столбцы:{" "}
            <b className="text-slate-200">Тикер, Количество, Цена</b>.
          </p>

          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать пример CSV-шаблона</span>
          </button>

          {/* Import mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 block">Режим импорта</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer select-none transition ${
                  mode === "add"
                    ? "bg-blue-950/40 border-blue-500 text-blue-200"
                    : "bg-slate-900 border-slate-700 hover:bg-slate-850 text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === "add"}
                  onChange={() => setMode("add")}
                  className="sr-only"
                />
                <span className="text-xs font-bold">Добавить сделки</span>
                <span className="text-[10px] text-slate-500 text-center">Объединить с текущими</span>
              </label>

              <label
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer select-none transition ${
                  mode === "replace"
                    ? "bg-rose-950/40 border-rose-500 text-rose-200"
                    : "bg-slate-900 border-slate-700 hover:bg-slate-850 text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="sr-only"
                />
                <span className="text-xs font-bold text-rose-400">Заменить портфель</span>
                <span className="text-[10px] text-slate-500 text-center">Очистить прошлые данные</span>
              </label>
            </div>
          </div>

          {/* File input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 block">Выберите файл (.csv)</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-xs p-2 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="flex gap-2 p-3 bg-rose-950/30 border border-rose-800 text-rose-200 rounded-lg text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold text-xs rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Импорт...</span>
                </>
              ) : (
                <span>Импортировать</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. PURCHASES MODAL (TRANSACTIONS OF ASSET)
// ==========================================
interface PurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onEditPurchase: (purchase: Purchase) => void;
  onDeletePurchase: (purchaseId: number) => void;
}

export function PurchasesModal({
  isOpen,
  onClose,
  asset,
  onEditPurchase,
  onDeletePurchase,
}: PurchasesModalProps) {
  if (!isOpen || !asset) return null;

  const totalQty = asset.purchases.reduce((sum, p) => sum + p.qty, 0);
  const totalCost = asset.purchases.reduce((sum, p) => sum + p.qty * p.price, 0);
  const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <div>
            <h3 className="font-bold text-white text-sm">История покупок: {asset.name}</h3>
            {asset.shortName && <span className="text-[11px] text-slate-400 block mt-0.5">{asset.shortName}</span>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[350px] overflow-y-auto space-y-2">
          {[...asset.purchases]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-slate-950/45 border border-slate-800 hover:border-slate-700 p-3.5 rounded-lg text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">
                    {p.qty} шт. × {p.price.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-3">
                    <span>Сделка: {p.date}</span>
                    <span className="font-medium text-slate-400">Сумма: {(p.qty * p.price).toLocaleString("ru-RU")} ₽</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEditPurchase(p)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeletePurchase(p.id)}
                    className="p-1.5 bg-rose-950/30 hover:bg-rose-900/60 border border-rose-900/40 text-rose-400 rounded cursor-pointer transition"
                    title="Удалить"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* Total details in footer */}
        <div className="bg-slate-950/80 p-4 border-t border-slate-800 flex flex-col gap-1 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Всего штук:</span>
            <span className="font-bold text-white">{totalQty} шт.</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Средневзвешенная цена:</span>
            <span className="font-bold text-slate-200">
              {avgPrice.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
            </span>
          </div>
          <div className="flex justify-between text-slate-400 border-t border-slate-800/60 pt-1.5 mt-1">
            <span className="font-semibold text-slate-300">Итого вложено:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {totalCost.toLocaleString("ru-RU")} ₽
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. EDIT PURCHASE MODAL
// ==========================================
interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase | null;
  onSave: (date: string, qty: number, price: number) => void;
}

export function EditPurchaseModal({ isOpen, onClose, purchase, onSave }: EditPurchaseModalProps) {
  const [date, setDate] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (purchase) {
      setDate(purchase.date);
      setQty(String(purchase.qty));
      setPrice(String(purchase.price));
    }
  }, [purchase]);

  if (!isOpen || !purchase) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    const p = parseFloat(price);
    if (!date || isNaN(q) || q <= 0 || isNaN(p) || p < 0) {
      alert("Некорректные параметры");
      return;
    }
    onSave(date, q, p);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">Редактирование покупки</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold block">Дата покупки</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold block">Количество штук</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="5"
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
              min="0.000001"
              step="any"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold block">Цена за шт. (₽)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="210"
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
              min="0"
              step="any"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. ADD DIVIDEND MODAL
// ==========================================
interface AddDividendModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolio: Asset[];
  onAdd: (ticker: string, amount: number, date: string, comment: string) => void;
}

export function AddDividendModal({ isOpen, onClose, portfolio, onAdd }: AddDividendModalProps) {
  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (portfolio.length > 0) {
      setTicker(portfolio[0].name);
    }
  }, [portfolio]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!ticker || isNaN(val) || val <= 0 || !date) {
      alert("Пожалуйста, заполните все поля корректно");
      return;
    }
    onAdd(ticker, val, date, comment);
    setAmount("");
    setComment("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">Внести выплату (Див. / Купон)</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {portfolio.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">Купите акции или облигации, чтобы заносить выплаты</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold block">Инструмент</label>
                <select
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-2.5 rounded-lg"
                >
                  {portfolio.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({a.shortName || ""})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold block">Сумма выплаты (чистыми, в ₽)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="150.00"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                  min="0.01"
                  step="any"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold block">Дата выплаты</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold block">Комментарий (необязательно)</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Дивиденды за 2025 год"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg cursor-pointer"
                >
                  Внести
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. DIVIDEND FORECAST MODAL
// ==========================================
interface DividendForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  upcomingEvents: ForecastEvent[];
  historicalEst: SectorEst[];
  forecastTotal: number;
  totalDividendsReceived: number;
  portfolio: Asset[];
}

export function DividendForecastModal({
  isOpen,
  onClose,
  loading,
  upcomingEvents,
  historicalEst,
  forecastTotal,
  totalDividendsReceived,
  portfolio,
}: DividendForecastModalProps) {
  const [activeTab, setActiveTab] = useState<"calendar" | "companies" | "compounding">("calendar");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  
  // Compounding simulation states
  const [simYears, setSimYears] = useState<number>(5);
  const [annualTopUp, setAnnualTopUp] = useState<number>(50000);

  if (!isOpen) return null;

  // 1. Calculate general portfolio info
  const portfolioValue = portfolio.reduce(
    (sum, a) => sum + a.purchases.reduce((s, p) => s + p.qty, 0) * a.currentPrice,
    0
  );
  
  const annualYieldPct = portfolioValue > 0 ? (forecastTotal / portfolioValue) * 100 : 0;
  const avgMonthlyIncome = forecastTotal / 12;

  // 2. Nearest upcoming payout
  const upcomingSorted = [...upcomingEvents]
    .filter((e) => e.status === "confirmed")
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextPayout = upcomingSorted.length > 0 ? upcomingSorted[0] : null;

  // 3. Top contributor
  const topContributor = historicalEst.length > 0 ? historicalEst[0] : null;
  const topContributorAsset = topContributor ? portfolio.find((a) => a.name === topContributor.ticker) : null;

  // 4. Generate 12-Month Calendar buckets starting from current month
  const getNext12Months = () => {
    const list = [];
    const currentDate = new Date();
    const monthNamesRu = [
      "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
      "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
    ];
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const label = `${monthNamesRu[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // "YYYY-MM"
      list.push({ key, label, year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
  };

  const monthsList = getNext12Months();
  const monthlyData = monthsList.map((m) => {
    const monthEvents = upcomingEvents.filter((e) => e.date.slice(0, 7) === m.key);
    const confirmedSum = monthEvents.filter((e) => e.status === "confirmed").reduce((s, e) => s + e.sum, 0);
    const projectedSum = monthEvents.filter((e) => e.status === "projected" || !e.status).reduce((s, e) => s + e.sum, 0);
    const totalSum = confirmedSum + projectedSum;
    return {
      ...m,
      confirmedSum,
      projectedSum,
      totalSum,
      events: monthEvents,
    };
  });

  const maxMonthlyValue = Math.max(...monthlyData.map((x) => x.totalSum), 1);

  // 5. Calculate compounding simulation details
  const runCompoundingSimulation = () => {
    let currentVal = portfolioValue;
    let totalReinvested = 0;
    let totalInvestedNew = 0;
    const rate = portfolioValue > 0 ? (forecastTotal / portfolioValue) : 0;

    for (let i = 1; i <= simYears; i++) {
      const dividendsEarned = currentVal * rate;
      totalReinvested += dividendsEarned;
      currentVal += dividendsEarned;

      if (annualTopUp > 0) {
        totalInvestedNew += annualTopUp;
        currentVal += annualTopUp;
      }
    }

    return {
      finalValue: currentVal,
      dividendsReinvested: totalReinvested,
      additionalCapital: totalInvestedNew,
      endingYieldValue: currentVal * rate,
    };
  };

  const simResult = runCompoundingSimulation();

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">🔮 Продвинутый дивидендный анализ</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-medium">Синхронизируем дивидендный календарь с Мосбиржей...</span>
              <span className="text-[10px] text-slate-500">Запрашиваем данные по текущим позициям вашего портфеля</span>
            </div>
          ) : (
            <>
              {/* Tabs Navigation */}
              <div className="flex border-b border-slate-800 p-0.5 bg-slate-950/50 rounded-lg">
                <button
                  onClick={() => setActiveTab("calendar")}
                  className={`flex-1 py-2 rounded-md font-bold text-[11px] transition cursor-pointer text-center ${
                    activeTab === "calendar"
                      ? "bg-slate-800 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📅 Календарь выплат
                </button>
                <button
                  onClick={() => setActiveTab("companies")}
                  className={`flex-1 py-2 rounded-md font-bold text-[11px] transition cursor-pointer text-center ${
                    activeTab === "companies"
                      ? "bg-slate-800 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🏢 Анализ по эмитентам
                </button>
                <button
                  onClick={() => setActiveTab("compounding")}
                  className={`flex-1 py-2 rounded-md font-bold text-[11px] transition cursor-pointer text-center ${
                    activeTab === "compounding"
                      ? "bg-slate-800 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📈 Симулятор реинвестирования
                </button>
              </div>

              {/* TAB 1: CALENDAR */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  {/* Summary Metric Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Всего за 12 мес</span>
                      <strong className="text-sm text-white block mt-1 font-sans">~{forecastTotal.toLocaleString("ru-RU")} ₽</strong>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Включая прогнозы</span>
                    </div>

                    <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Див. доходность</span>
                      <strong className="text-sm text-emerald-400 block mt-1 font-sans">{annualYieldPct.toFixed(2)}%</strong>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Средневзвешенная</span>
                    </div>

                    <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider font-sans">Средний доход</span>
                      <strong className="text-sm text-blue-400 block mt-1 font-sans">~{avgMonthlyIncome.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽/мес</strong>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Пассивный поток</span>
                    </div>

                    <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Ближайшая выплата</span>
                      {nextPayout ? (
                        <>
                          <strong className="text-sm text-white block mt-1 font-sans">{nextPayout.ticker}</strong>
                          <span className="text-[9px] text-emerald-400 block mt-0.5 font-sans">{nextPayout.date.split("-").reverse().join(".")}</span>
                        </>
                      ) : (
                        <strong className="text-sm text-slate-500 block mt-1 font-sans">Нет дат</strong>
                      )}
                    </div>
                  </div>

                  {/* Monthly Histogram Chart */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="font-bold text-slate-300">Распределение выплат по месяцам</span>
                      <div className="flex items-center gap-3 text-[9px] font-bold">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/80" />Реестр закрыт (точные)</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500/80" />Прогноз (по истории)</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end h-32 pt-4 px-2.5 bg-slate-950/45 rounded-xl border border-slate-800">
                      {monthlyData.map((m) => {
                        const pct = (m.totalSum / maxMonthlyValue) * 100;
                        const confirmedPct = m.totalSum > 0 ? (m.confirmedSum / m.totalSum) * 100 : 0;
                        const projectedPct = m.totalSum > 0 ? (m.projectedSum / m.totalSum) * 100 : 0;

                        return (
                          <div
                            key={m.key}
                            onClick={() => setSelectedMonthKey(selectedMonthKey === m.key ? null : m.key)}
                            className={`flex flex-col items-center flex-1 cursor-pointer group transition pb-1 ${
                              selectedMonthKey === m.key ? "bg-slate-800/40 rounded-t" : "hover:bg-slate-800/10"
                            }`}
                          >
                            <div className="w-full flex flex-col justify-end h-20 px-1 relative">
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-950 border border-slate-800 text-slate-200 text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 font-mono">
                                {m.totalSum.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
                              </div>

                              {m.totalSum > 0 ? (
                                <div
                                  style={{ height: `${Math.max(pct, 5)}%` }}
                                  className={`w-full rounded-t overflow-hidden flex flex-col justify-end transition-all ${
                                    selectedMonthKey === m.key ? "ring-2 ring-blue-500" : ""
                                  }`}
                                >
                                  {m.projectedSum > 0 && (
                                    <div
                                      style={{ height: `${projectedPct}%` }}
                                      className="w-full bg-amber-500/80 group-hover:bg-amber-400 transition"
                                    />
                                  )}
                                  {m.confirmedSum > 0 && (
                                    <div
                                      style={{ height: `${confirmedPct}%` }}
                                      className="w-full bg-emerald-500/80 group-hover:bg-emerald-400 transition"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="h-1 w-full bg-slate-800 rounded" />
                              )}
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold mt-1.5 group-hover:text-slate-300">
                              {m.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Upcoming Payouts Table */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-300 font-sans">
                        {selectedMonthKey
                          ? `Выплаты за ${monthsList.find((m) => m.key === selectedMonthKey)?.label || ""}`
                          : "Все ожидаемые выплаты (12 месяцев)"}
                      </h4>
                      {selectedMonthKey && (
                        <button
                          onClick={() => setSelectedMonthKey(null)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer font-sans"
                        >
                          Сбросить фильтр месяцев
                        </button>
                      )}
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/60 text-slate-400 text-[10px] font-bold border-b border-slate-800">
                            <th className="p-2.5">Эмитент</th>
                            <th className="p-2.5">Дата закрытия реестра</th>
                            <th className="p-2.5">Тип</th>
                            <th className="p-2.5">Выплата / ед.</th>
                            <th className="p-2.5">Итого</th>
                            <th className="p-2.5">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {(() => {
                            const filtered = selectedMonthKey
                              ? upcomingEvents.filter((e) => e.date.slice(0, 7) === selectedMonthKey)
                              : upcomingEvents;

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                                    На выбранный период выплат не запланировано.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((evt, idx) => {
                              const assetObj = portfolio.find((a) => a.name === evt.ticker);
                              return (
                                <tr key={idx} className="hover:bg-slate-800/30 transition text-slate-300">
                                  <td className="p-2.5">
                                    <div className="font-bold text-white">{evt.ticker}</div>
                                    <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                      {assetObj?.shortName || ""}
                                    </div>
                                  </td>
                                  <td className="p-2.5 font-mono">
                                    {evt.date.split("-").reverse().join(".")}
                                  </td>
                                  <td className="p-2.5">
                                    <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                                      evt.type === "Купон" ? "bg-purple-950/40 text-purple-300 border border-purple-800/30" : "bg-blue-950/40 text-blue-300 border border-blue-800/30"
                                    }`}>
                                      {evt.type}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-mono">
                                    {evt.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-white">
                                    {evt.sum.toLocaleString("ru-RU", { minimumFractionDigits: 1 })} ₽
                                  </td>
                                  <td className="p-2.5">
                                    {evt.status === "confirmed" ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Утверждён
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 bg-amber-950/40 border border-amber-900/40 px-1.5 py-0.5 rounded font-bold">
                                        Прогноз
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANIES ANALYSIS */}
              {activeTab === "companies" && (
                <div className="space-y-4">
                  <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm font-sans">Самый щедрый плательщик портфеля</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Компания, приносящая наибольший дивидендный доход за год
                      </p>
                    </div>
                    {topContributor ? (
                      <div className="text-right">
                        <strong className="text-lg text-emerald-400 font-sans">{topContributor.ticker}</strong>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {topContributor.sum.toLocaleString("ru-RU")} ₽ ({((topContributor.sum / forecastTotal) * 100).toFixed(1)}% всех выплат)
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 font-sans">Нет данных</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="font-bold text-slate-300">Доля компаний в дивидендном потоке</span>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/60 text-slate-400 text-[10px] font-bold border-b border-slate-800">
                            <th className="p-2.5">Компания</th>
                            <th className="p-2.5">Количество</th>
                            <th className="p-2.5">Капитализация</th>
                            <th className="p-2.5">Ожидаемый годовой доход</th>
                            <th className="p-2.5">Доля в выплатах</th>
                            <th className="p-2.5 text-right">Див. доходность инструмента</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {historicalEst.map((est) => {
                            const assetObj = portfolio.find((a) => a.name === est.ticker);
                            const qty = assetObj ? assetObj.purchases.reduce((s, p) => s + p.qty, 0) : 0;
                            const assetValue = assetObj ? qty * assetObj.currentPrice : 0;
                            const companyYield = assetValue > 0 ? (est.sum / assetValue) * 100 : 0;
                            const share = (est.sum / forecastTotal) * 100;

                            return (
                              <tr key={est.ticker} className="hover:bg-slate-800/20 transition text-slate-300">
                                <td className="p-2.5">
                                  <div className="font-bold text-white">{est.ticker}</div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{assetObj?.shortName || ""}</div>
                                </td>
                                <td className="p-2.5 font-mono">{qty} шт.</td>
                                <td className="p-2.5 font-mono">{assetValue.toLocaleString("ru-RU")} ₽</td>
                                <td className="p-2.5 font-mono font-bold text-emerald-400">
                                  +{est.sum.toLocaleString("ru-RU", { minimumFractionDigits: 1 })} ₽
                                </td>
                                <td className="p-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                      <div style={{ width: `${share}%` }} className="bg-blue-400 h-full rounded-full" />
                                    </div>
                                    <span className="font-mono text-[10px]">{share.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-right font-mono text-white font-semibold">
                                  {companyYield.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COMPOUNDING SIMULATOR */}
              {activeTab === "compounding" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                      <TrendingUp className="w-4 h-4" />
                      <span>Калькулятор капитализации и сложного процента</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Узнайте силу сложного процента! Наш симулятор прогнозирует, как увеличится стоимость ваших активов и годовой пассивный поток, если вы будете 
                      автоматически докупать бумаги на все полученные дивиденды.
                    </p>
                  </div>

                  {/* Interactive Sliders */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/20 p-4 border border-slate-800 rounded-xl">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-300">Горизонт инвестирования</span>
                        <strong className="text-blue-400 font-bold font-sans">{simYears} лет / года</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={simYears}
                        onChange={(e) => setSimYears(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold font-mono">
                        <span>1 год</span>
                        <span>5 лет</span>
                        <span>10 лет</span>
                        <span>15 лет</span>
                        <span>20 лет</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-300">Ежегодное доп. пополнение</span>
                        <strong className="text-blue-400 font-bold font-sans">{annualTopUp.toLocaleString("ru-RU")} ₽/год</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="500000"
                        step="10000"
                        value={annualTopUp}
                        onChange={(e) => setAnnualTopUp(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold font-mono">
                        <span>0 ₽</span>
                        <span>100 000 ₽</span>
                        <span>250 000 ₽</span>
                        <span>500 000 ₽</span>
                      </div>
                    </div>
                  </div>

                  {/* Simulation outcomes */}
                  <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="font-bold text-white mb-2 font-sans">Прогноз результата через {simYears} лет:</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-center">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider font-sans">Капитал портфеля</span>
                        <strong className="text-sm text-emerald-400 block mt-1 font-mono">
                          {Math.round(simResult.finalValue).toLocaleString("ru-RU")} ₽
                        </strong>
                        <span className="text-[9px] text-slate-500 block mt-0.5 font-sans font-sans">
                          Начальный: {Math.round(portfolioValue).toLocaleString("ru-RU")} ₽
                        </span>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-center">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider font-sans">Вложено своих денег</span>
                        <strong className="text-sm text-blue-400 block mt-1 font-mono">
                          {Math.round(portfolioValue + simResult.additionalCapital).toLocaleString("ru-RU")} ₽
                        </strong>
                        <span className="text-[9px] text-slate-500 block mt-0.5 font-sans">
                          Доп. взносы: {Math.round(simResult.additionalCapital).toLocaleString("ru-RU")} ₽
                        </span>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-center">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider font-sans">Пассивный доход в год</span>
                        <strong className="text-sm text-white block mt-1 font-mono">
                          ~{Math.round(simResult.endingYieldValue).toLocaleString("ru-RU")} ₽
                        </strong>
                        <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold font-sans">
                          ~{Math.round(simResult.endingYieldValue / 12).toLocaleString("ru-RU")} ₽/мес
                        </span>
                      </div>
                    </div>

                    {/* Progress representation */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Структура будущего капитала:</span>
                      </div>
                      <div className="w-full bg-slate-900 h-4 rounded overflow-hidden flex font-mono text-[9px] font-bold text-center leading-4 text-white">
                        <div
                          style={{ width: `${(portfolioValue / simResult.finalValue) * 100}%` }}
                          className="bg-emerald-600 truncate"
                          title="Начальный капитал"
                        >
                          Старт
                        </div>
                        {simResult.additionalCapital > 0 && (
                          <div
                            style={{ width: `${(simResult.additionalCapital / simResult.finalValue) * 100}%` }}
                            className="bg-blue-600 truncate"
                            title="Взносы"
                          >
                            Взносы
                          </div>
                        )}
                        <div
                          style={{ width: `${(simResult.dividendsReinvested / simResult.finalValue) * 100}%` }}
                          className="bg-amber-600 truncate"
                          title="Реинвестировано дивидендов"
                        >
                          Дивиденды
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-[9px] text-slate-400 font-bold pt-1">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-600 rounded-sm" />Стартовый капитал ({Math.round((portfolioValue / simResult.finalValue) * 100)}%)</span>
                        {simResult.additionalCapital > 0 && (
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-sm" />Личные доп. взносы ({Math.round((simResult.additionalCapital / simResult.finalValue) * 100)}%)</span>
                        )}
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-600 rounded-sm" />Реинвестировано дивидендов ({Math.round((simResult.dividendsReinvested / simResult.finalValue) * 100)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Forecast box */}
              <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 flex-shrink-0">
                <div className="flex gap-2 items-center">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-slate-400 text-[11px] leading-snug font-sans font-sans">
                    Уже зафиксировано выплат на счете: <strong className="text-emerald-400">+{totalDividendsReceived.toLocaleString("ru-RU")} ₽</strong>.
                    Всего зафиксировано + ожидается: <strong className="text-white">{(forecastTotal + totalDividendsReceived).toLocaleString("ru-RU")} ₽</strong>.
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-bold font-mono">
                  Данные MOEX ISS API
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. REBALANCE MODAL
// ==========================================
interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolio: Asset[];
}

export function RebalanceModal({ isOpen, onClose, portfolio }: RebalanceModalProps) {
  if (!isOpen) return null;

  let totalValue = 0;
  const sectors: Record<string, number> = {};

  portfolio.forEach((a) => {
    const qty = a.purchases.reduce((sum, p) => sum + p.qty, 0);
    const val = qty * a.currentPrice;
    totalValue += val;
    sectors[a.sector] = (sectors[a.sector] || 0) + val;
  });

  const sectorKeys = Object.keys(sectors);
  const targetPct = sectorKeys.length > 0 ? 100 / sectorKeys.length : 100;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">⚖️ Ребалансировка секторов</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[350px] overflow-y-auto text-xs">
          {portfolio.length < 2 ? (
            <p className="text-slate-400 py-6 text-center">
              Добавьте хотя бы два актива из разных секторов, чтобы увидеть рекомендации по ребалансировке.
            </p>
          ) : (
            <>
              <p className="text-slate-400 leading-relaxed mb-1">
                Модель предлагает равновзвешенное распределение между задействованными секторами ({targetPct.toFixed(1)}% на каждый):
              </p>

              <div className="space-y-3">
                {sectorKeys
                  .sort((a, b) => sectors[b] - sectors[a])
                  .map((sec) => {
                    const currentPct = (sectors[sec] / totalValue) * 100;
                    const deviation = currentPct - targetPct;
                    const amountDev = (deviation / 100) * totalValue;

                    return (
                      <div
                        key={sec}
                        className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-lg flex justify-between items-center"
                      >
                        <div>
                          <strong className="text-slate-200 text-sm">{sec}</strong>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Текущий вес: {currentPct.toFixed(1)}% | Целевой: {targetPct.toFixed(1)}%
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-bold text-xs ${
                              deviation > 3
                                ? "text-rose-400"
                                : deviation < -3
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {deviation > 3
                              ? `Продать ~${Math.round(amountDev).toLocaleString("ru-RU")} ₽`
                              : deviation < -3
                              ? `Купить ~${Math.round(-amountDev).toLocaleString("ru-RU")} ₽`
                              : "В норме"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. WHAT-IF MODAL (SIMULATION)
// ==========================================
interface WhatIfModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolio: Asset[];
}

export function WhatIfModal({ isOpen, onClose, portfolio }: WhatIfModalProps) {
  const [targetTicker, setTargetTicker] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [resultText, setResultText] = useState("");

  useEffect(() => {
    if (portfolio.length > 0) {
      setTargetTicker(portfolio[0].name);
    }
  }, [portfolio]);

  if (!isOpen) return null;

  const calculateSimulation = () => {
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0 || !targetTicker) {
      alert("Укажите корректную сумму");
      return;
    }

    const asset = portfolio.find((a) => a.name === targetTicker);
    if (!asset) return;

    let totalVal = 0;
    let targetVal = 0;

    portfolio.forEach((a) => {
      const qty = a.purchases.reduce((s, p) => s + p.qty, 0);
      const val = qty * a.currentPrice;
      totalVal += val;
      if (a.name === targetTicker) {
        targetVal = val;
      }
    });

    const newTotal = totalVal + amt;
    const newTarget = targetVal + amt;
    const newPct = (newTarget / newTotal) * 100;

    setResultText(
      `Суммарная капитализация портфеля вырастет до **${Math.round(
        newTotal
      ).toLocaleString("ru-RU")} ₽**.\n\nДоля актива **${targetTicker}** увеличится до **${newPct.toFixed(
        1
      )}%** (сейчас: ${((targetVal / totalVal) * 100).toFixed(1)}%).`
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">🔮 Моделирование «Что если?»</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {portfolio.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">Добавьте хотя бы один актив, чтобы запустить симуляцию</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold block">Внести сумму (₽)</label>
                  <input
                    type="number"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="50000"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold block">В тикер</label>
                  <select
                    value={targetTicker}
                    onChange={(e) => setTargetTicker(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-2.5 rounded-lg"
                  >
                    {portfolio.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={calculateSimulation}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition cursor-pointer"
              >
                Рассчитать результат
              </button>

              {resultText && (
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-slate-300 leading-relaxed">
                  {resultText.split("\n\n").map((para, i) => {
                    // Quick bold text replacement
                    const formatted = para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
                    return (
                      <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: formatted }} />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. SELL MODAL (LOCK IN SALES)
// ==========================================
interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolio: Asset[];
  onSell: (ticker: string, qty: number, price: number, date: string) => void;
}

export function SellModal({ isOpen, onClose, portfolio, onSell }: SellModalProps) {
  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sellResult, setSellResult] = useState("");

  const activeAsset = portfolio.find((a) => a.name === ticker);
  const maxQty = activeAsset ? activeAsset.purchases.reduce((s, p) => s + p.qty, 0) : 0;

  useEffect(() => {
    if (portfolio.length > 0) {
      setTicker(portfolio[0].name);
    }
  }, [portfolio]);

  if (!isOpen) return null;

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    const p = parseFloat(price);

    if (!ticker || isNaN(q) || q <= 0 || q > maxQty || isNaN(p) || p <= 0 || !date) {
      alert("Укажите корректные параметры продажи (в пределах вашего баланса)");
      return;
    }

    onSell(ticker, q, p, date);
    setSellResult(`Продано ${q} шт. ${ticker} по цене ${p} ₽. Продажа успешно зафиксирована!`);
    setQty("");
    setPrice("");
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">💸 Зафиксировать продажу (Фиксация прибыли)</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSellSubmit} className="p-5 space-y-4 text-xs">
          {portfolio.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">У вас пока нет активов для продажи</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-slate-400 font-semibold block">Выберите тикер</label>
                  <select
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-2.5 rounded-lg"
                  >
                    {portfolio.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.purchases.reduce((s, p) => s + p.qty, 0)} шт. на балансе)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold block">Количество (макс: {maxQty})</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="10"
                    max={maxQty}
                    min="0.00001"
                    step="any"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold block">Цена продажи (₽)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="260.50"
                    min="0.01"
                    step="any"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-slate-400 font-semibold block">Дата фиксации</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-xs p-2.5 rounded-lg"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-lg transition cursor-pointer"
              >
                Продать в рынок
              </button>

              {sellResult && (
                <div className="bg-rose-950/20 p-3 border border-rose-900/60 rounded-lg text-rose-300 text-center leading-relaxed">
                  {sellResult}
                </div>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 9. REALIZED TRADES HISTORY MODAL
// ==========================================
interface RealizedTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: RealizedTrade[];
  onDeleteTrade: (id: number) => void;
}

export function RealizedTradesModal({ isOpen, onClose, trades, onDeleteTrade }: RealizedTradesModalProps) {
  if (!isOpen) return null;

  const totalProceeds = trades.reduce((sum, t) => sum + t.proceeds, 0);
  const totalCost = trades.reduce((sum, t) => sum + t.costBasis, 0);
  const totalPnl = totalProceeds - totalCost;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-800/85 p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">📋 История закрытых позиций</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[350px] overflow-y-auto space-y-2 text-xs">
          {trades.length === 0 ? (
            <p className="text-slate-500 py-12 text-center font-medium">Закрытых позиций не зафиксировано</p>
          ) : (
            [...trades]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-950/45 border border-slate-800 hover:border-slate-700 p-3.5 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-200">
                      {t.ticker} <span className="text-[10px] text-slate-500">({t.date})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Кол-во: {t.qty} шт. | Ср. покупка: {Math.round(t.costBasis / t.qty)} ₽ | Выручка:{" "}
                      {Math.round(t.proceeds)} ₽
                    </div>
                    <div className="mt-1.5">
                      <span className="text-[10px] text-slate-500">Результат:</span>{" "}
                      <strong className={t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {t.pnl >= 0 ? "+" : ""}
                        {t.pnl.toLocaleString("ru-RU", { minimumFractionDigits: 1 })} ₽
                      </strong>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTrade(t.id)}
                    className="p-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/40 text-rose-400 rounded cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
          )}
        </div>

        {/* Totals read-out */}
        {trades.length > 0 && (
          <div className="bg-slate-950/80 p-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Общая выручка от продаж:</span>
              <span className="text-white font-bold">{Math.round(totalProceeds).toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between">
              <span>Себестоимость выбывших активов:</span>
              <span className="text-white font-bold">{Math.round(totalCost).toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/60 pt-2 mt-1">
              <span className="font-semibold text-slate-300">Реализованный финансовый результат:</span>
              <strong className={totalPnl >= 0 ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"}>
                {totalPnl >= 0 ? "+" : ""}
                {totalPnl.toLocaleString("ru-RU")} ₽
              </strong>
            </div>
          </div>
        )}

        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
