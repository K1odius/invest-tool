import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Calendar, Landmark } from "lucide-react";
import { fetchMoexSearch, autoDetectSector, MoexSearchResult } from "../lib/moex";

interface PurchaseFormProps {
  onAddPurchase: (
    name: string,
    sector: string,
    date: string,
    qty: number,
    price: number
  ) => Promise<boolean>;
}

export default function PurchaseForm({ onAddPurchase }: PurchaseFormProps) {
  const [ticker, setTicker] = useState("");
  const [sector, setSector] = useState("Нефтегаз");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  const [suggestions, setSuggestions] = useState<MoexSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Suggested Ticker Fetch Handler
  useEffect(() => {
    const q = ticker.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      const results = await fetchMoexSearch(q);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setLoadingSuggestions(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [ticker]);

  // Click outside listener for suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (item: MoexSearchResult) => {
    setTicker(item.ticker);
    setShowDropdown(false);
    const detected = autoDetectSector(item.ticker);
    setSector(detected);
  };

  const handleTickerChange = (val: string) => {
    const cleanVal = val.toUpperCase().trim();
    setTicker(cleanVal);
    // Also run quick auto sector detect just in case
    if (cleanVal) {
      const detected = autoDetectSector(cleanVal);
      setSector(detected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const t = ticker.toUpperCase().trim();
    const qNum = parseFloat(qty);
    const pNum = parseFloat(price);

    if (!t) {
      setErrorMsg("Укажите тикер инструмента (например, SBER)");
      return;
    }
    if (!qty || isNaN(qNum) || qNum <= 0) {
      setErrorMsg("Укажите корректное количество (> 0)");
      return;
    }
    if (!price || isNaN(pNum) || pNum < 0) {
      setErrorMsg("Укажите корректную цену покупки (>= 0)");
      return;
    }

    setSubmitting(true);
    try {
      const success = await onAddPurchase(t, sector, date, qNum, pNum);
      if (success) {
        setTicker("");
        setQty("");
        setPrice("");
        setDate(new Date().toISOString().split("T")[0]);
      } else {
        setErrorMsg(`Инструмент с тикером "${t}" не найден на Московской бирже.`);
      }
    } catch (err) {
      setErrorMsg("Ошибка при добавлении актива. Проверьте интернет-соединение.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-emerald-400" />
        <h3 className="text-base font-bold text-slate-100">Добавить покупку</h3>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Ticker Input */}
        <div className="md:col-span-3 relative" ref={dropdownRef}>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Тикер
          </label>
          <div className="relative">
            <input
              type="text"
              value={ticker}
              onChange={(e) => handleTickerChange(e.target.value)}
              placeholder="SBER, LKOH, GAZP..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-sm px-3.5 py-2 rounded-lg pl-9"
              autoComplete="off"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          </div>

          {/* Autocomplete suggestions */}
          {showDropdown && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
              <ul>
                {suggestions.map((item) => (
                  <li
                    key={item.ticker}
                    onClick={() => handleSuggestionClick(item)}
                    className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                  >
                    <div>
                      <span className="font-bold text-blue-400">{item.ticker}</span>
                      <span className="text-slate-400 text-xs ml-2 truncate inline-block max-w-[150px]">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                      {item.type === "bond" ? "обл" : "акц"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sector Selection */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Сектор активов
          </label>
          <div className="relative">
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-sm px-3.5 py-2 rounded-lg pr-8"
            >
              <option value="Нефтегаз">Нефтегаз</option>
              <option value="Финансы">Финансы</option>
              <option value="IT и Телеком">IT и Телеком</option>
              <option value="Металлургия">Металлургия</option>
              <option value="Потреб. сектор">Потреб. сектор</option>
              <option value="Энергетика">Энергетика</option>
              <option value="Строительство">Строительство</option>
              <option value="Транспорт">Транспорт</option>
              <option value="ОФЗ / Гособлигации">ОФЗ / Гособлигации</option>
              <option value="Корп. облигации">Корп. облигации</option>
              <option value="Фонды (ETF)">Фонды (ETF)</option>
              <option value="Другое">Другое</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Date Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Дата сделки
          </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-sm px-3.5 py-2 rounded-lg"
            />
          </div>
        </div>

        {/* Quantity Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Количество
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="10"
            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-sm px-3.5 py-2 rounded-lg"
            min="0.000001"
            step="any"
          />
        </div>

        {/* Price Input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Цена за шт. (₽)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="245.50"
            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:outline-none text-white text-sm px-3.5 py-2 rounded-lg"
            min="0"
            step="any"
          />
        </div>

        {/* Submit button */}
        <div className="md:col-span-12 flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/20"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Поиск котировок...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Зафиксировать покупку</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Output */}
      {errorMsg && (
        <div className="mt-3 bg-red-950/40 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-xs leading-relaxed animate-fade-in">
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
}
