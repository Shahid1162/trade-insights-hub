import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, Percent, Target, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LotSizeResult } from '@/lib/types';

// Pip values for common forex pairs (value per pip for 1 standard lot)
const pipValues: Record<string, number> = {
  // Major pairs
  'EUR/USD': 10,
  'GBP/USD': 10,
  'USD/JPY': 9.09,
  'USD/CHF': 10.75,
  'AUD/USD': 10,
  'NZD/USD': 10,
  'USD/CAD': 7.58,
  // Cross pairs
  'EUR/GBP': 12.74,
  'EUR/JPY': 9.09,
  'GBP/JPY': 9.09,
  'EUR/CHF': 10.75,
  'GBP/CHF': 10.75,
  'AUD/JPY': 9.09,
  'CHF/JPY': 9.09,
  // Exotic pairs
  'EUR/AUD': 6.37,
  'GBP/AUD': 6.37,
  'USD/SGD': 7.38,
  'USD/HKD': 1.28,
  // Crypto
  'BTC/USD': 10,
  'ETH/USD': 10,
  // Commodities
  'XAU/USD': 10,
  'XAG/USD': 10,
};

const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

export const LotSizeCalculator: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth();
  const [pair, setPair] = useState('EUR/USD');
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [accountBalance, setAccountBalance] = useState<string>('10000');
  const [riskPercentage, setRiskPercentage] = useState<string>('1');
  const [stopLossPips, setStopLossPips] = useState<string>('50');
  const [result, setResult] = useState<LotSizeResult | null>(null);
  const [pairSearch, setPairSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const allPairs = useMemo(() => Object.keys(pipValues), []);
  const filteredPairs = useMemo(() => {
    if (!pairSearch) return allPairs;
    const q = pairSearch.toUpperCase();
    return allPairs.filter(p => p.includes(q));
  }, [allPairs, pairSearch]);

  const handleSelectPair = (p: string) => {
    setPair(p);
    setPairSearch('');
    setShowDropdown(false);
  };

  const calculateLotSize = () => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const balance = parseFloat(accountBalance);
    const risk = parseFloat(riskPercentage) / 100;
    const slPips = parseFloat(stopLossPips);
    const pipValue = pipValues[pair] || 10;

    if (isNaN(balance) || isNaN(risk) || isNaN(slPips) || slPips === 0) {
      return;
    }

    // Lot size formula: (Account Balance * Risk %) / (Stop Loss in Pips * Pip Value)
    const riskAmount = balance * risk;
    const lotSize = riskAmount / (slPips * pipValue);

    setResult({
      lotSize: Math.round(lotSize * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      pipValue,
    });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">Lot Size</span> Calculator
        </h1>
        <p className="text-muted-foreground text-lg">
          Calculate the optimal lot size based on your risk management strategy
        </p>
      </div>

      {/* Calculator Form */}
      <div className="p-6 rounded-xl bg-card border border-border/50 space-y-6 animate-fade-in">
        {/* Pair Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Trading Pair
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={pairSearch}
              onChange={(e) => {
                setPairSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full trading-input pl-9"
              placeholder={`Selected: ${pair} — Type to search...`}
            />
            {showDropdown && filteredPairs.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {filteredPairs.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPair(p)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex justify-between items-center ${p === pair ? 'bg-accent/50 font-medium' : ''}`}
                  >
                    <span>{p}</span>
                    <span className="text-xs text-muted-foreground">Pip: ${pipValues[p]}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && pairSearch && filteredPairs.length === 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg p-3 text-sm text-muted-foreground text-center">
                No pairs found
              </div>
            )}
          </div>
          {/* Click outside to close */}
          {showDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          )}
        </div>

        {/* Account Currency */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Account Currency
          </label>
          <select
            value={accountCurrency}
            onChange={(e) => setAccountCurrency(e.target.value)}
            className="w-full trading-input"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Account Balance */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Account Balance
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              {accountCurrency}
            </span>
            <input
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(e.target.value)}
              className="w-full trading-input pl-14"
              placeholder="10000"
            />
          </div>
        </div>

        {/* Risk Percentage */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            Risk Percentage
          </label>
          <div className="relative">
            <input
              type="number"
              value={riskPercentage}
              onChange={(e) => setRiskPercentage(e.target.value)}
              className="w-full trading-input pr-10"
              placeholder="1"
              step="0.1"
              min="0.1"
              max="100"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Recommended: 1-2% per trade</p>
        </div>

        {/* Stop Loss in Pips */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-bearish" />
            Stop Loss (Pips)
          </label>
          <input
            type="number"
            value={stopLossPips}
            onChange={(e) => setStopLossPips(e.target.value)}
            className="w-full trading-input"
            placeholder="50"
          />
        </div>

        {/* Calculate Button */}
        <Button variant="gradient" size="lg" className="w-full" onClick={calculateLotSize}>
          <Calculator className="w-5 h-5" />
          Calculate Lot Size
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="p-6 rounded-xl bg-primary/5 border border-primary/30 space-y-4 animate-fade-in">
          <h3 className="text-xl font-semibold text-center mb-4">Calculation Results</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-card border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Lot Size</p>
              <p className="text-3xl font-mono font-bold text-primary">{result.lotSize}</p>
              <p className="text-xs text-muted-foreground">Standard Lots</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-card border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Risk Amount</p>
              <p className="text-3xl font-mono font-bold text-bearish">${result.riskAmount}</p>
              <p className="text-xs text-muted-foreground">{accountCurrency}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-card border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Pip Value</p>
              <p className="text-3xl font-mono font-bold">${result.pipValue}</p>
              <p className="text-xs text-muted-foreground">Per Standard Lot</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
