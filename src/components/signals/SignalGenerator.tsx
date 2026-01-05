import React, { useState } from 'react';
import { BarChart3, Upload, Loader2, Target, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SignalAnalysis } from '@/lib/types';
import { toast } from 'sonner';

type AnalysisType = 'intraday' | 'swing' | 'positional';

const timeframeInfo = {
  intraday: { label: 'Intraday', timeframes: ['15min', '5min'], description: 'Short-term scalping and day trading' },
  swing: { label: 'Swing', timeframes: ['1H', '30min'], description: 'Multi-day position holding' },
  positional: { label: 'Positional', timeframes: ['4H', '1D'], description: 'Long-term investment positions' },
};

export const SignalGenerator: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth();
  const [analysisType, setAnalysisType] = useState<AnalysisType>('intraday');
  const [uploadedImages, setUploadedImages] = useState<{ tf1: File | null; tf2: File | null }>({ tf1: null, tf2: null });
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);

  const handleImageUpload = (timeframe: 'tf1' | 'tf2', e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const file = e.target.files?.[0];
    if (file) {
      setUploadedImages(prev => ({ ...prev, [timeframe]: file }));
    }
  };

  const handleAnalyze = async () => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    if (!uploadedImages.tf1 || !uploadedImages.tf2) {
      toast.error('Please upload both chart images');
      return;
    }

    setLoading(true);
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock analysis result
    const mockAnalysis: SignalAnalysis = {
      type: analysisType,
      entry: 1.0850,
      takeProfit: 1.0920,
      stopLoss: 1.0810,
      bias: Math.random() > 0.5 ? 'bullish' : 'bearish',
      confidence: Math.floor(Math.random() * 30) + 70,
      analysis: `Based on Price Action, ICT concepts, and SMC analysis:
      
• **Market Structure**: The market shows a clear ${Math.random() > 0.5 ? 'bullish' : 'bearish'} structure with higher highs and higher lows.
• **Order Blocks**: Identified a strong ${Math.random() > 0.5 ? 'bullish' : 'bearish'} order block at the current level.
• **Fair Value Gap**: Price is approaching a significant FVG that could act as a magnet.
• **Liquidity**: Multiple liquidity pools identified above/below current price.

**Recommendation**: ${analysisType === 'intraday' ? 'Quick scalp opportunity' : analysisType === 'swing' ? 'Hold for 2-5 days' : 'Long-term position recommended'}.`,
    };
    
    setAnalysis(mockAnalysis);
    setLoading(false);
    toast.success('Analysis complete!');
  };

  const resetAnalysis = () => {
    setAnalysis(null);
    setUploadedImages({ tf1: null, tf2: null });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold">
          <span className="gradient-text">AI Signal</span> Generator
        </h1>
        <p className="text-muted-foreground text-lg">
          Upload your chart images and let AI analyze using Price Action, ICT & SMC concepts
        </p>
      </div>

      {/* Analysis Type Selection */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in">
        {(Object.keys(timeframeInfo) as AnalysisType[]).map((type) => {
          const info = timeframeInfo[type];
          const isActive = analysisType === type;
          return (
            <button
              key={type}
              onClick={() => {
                setAnalysisType(type);
                resetAnalysis();
              }}
              className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                isActive
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-card border-border/50 hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{info.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{info.description}</p>
              <div className="flex gap-2 mt-2">
                {info.timeframes.map(tf => (
                  <span key={tf} className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                    {tf}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Image Upload */}
      {!analysis && (
        <div className="grid grid-cols-2 gap-6 animate-fade-in">
          {['tf1', 'tf2'].map((tf, idx) => {
            const timeframe = timeframeInfo[analysisType].timeframes[idx];
            const file = uploadedImages[tf as 'tf1' | 'tf2'];
            return (
              <label
                key={tf}
                className={`relative p-8 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center ${
                  file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleImageUpload(tf as 'tf1' | 'tf2', e)}
                />
                <Upload className={`w-10 h-10 mx-auto mb-4 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-semibold mb-1">{timeframe} Chart</p>
                <p className="text-sm text-muted-foreground">
                  {file ? file.name : 'Click or drag to upload'}
                </p>
              </label>
            );
          })}
        </div>
      )}

      {/* Analyze Button */}
      {!analysis && (
        <div className="text-center animate-fade-in">
          <Button
            variant="gradient"
            size="xl"
            onClick={handleAnalyze}
            disabled={loading || !uploadedImages.tf1 || !uploadedImages.tf2}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Charts...
              </>
            ) : (
              <>
                <BarChart3 className="w-5 h-5" />
                Generate Signal
              </>
            )}
          </Button>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6 animate-fade-in">
          {/* Trade Bias */}
          <div className={`p-6 rounded-xl border ${
            analysis.bias === 'bullish' ? 'bg-bullish/10 border-bullish/30' : 'bg-bearish/10 border-bearish/30'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {analysis.bias === 'bullish' ? (
                  <TrendingUp className="w-8 h-8 text-bullish" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-bearish" />
                )}
                <div>
                  <h3 className="text-2xl font-bold capitalize">{analysis.bias} Bias</h3>
                  <p className="text-muted-foreground">{timeframeInfo[analysis.type].label} Analysis</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Confidence</p>
                <p className={`text-3xl font-mono font-bold ${
                  analysis.bias === 'bullish' ? 'text-bullish' : 'text-bearish'
                }`}>
                  {analysis.confidence}%
                </p>
              </div>
            </div>
          </div>

          {/* Trade Levels */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground mb-1">Entry Price</p>
              <p className="text-2xl font-mono font-bold">{analysis.entry.toFixed(4)}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-bullish/30 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-bullish" />
              <p className="text-sm text-muted-foreground mb-1">Take Profit</p>
              <p className="text-2xl font-mono font-bold text-bullish">{analysis.takeProfit.toFixed(4)}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-bearish/30 text-center">
              <TrendingDown className="w-6 h-6 mx-auto mb-2 text-bearish" />
              <p className="text-sm text-muted-foreground mb-1">Stop Loss</p>
              <p className="text-2xl font-mono font-bold text-bearish">{analysis.stopLoss.toFixed(4)}</p>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="p-6 rounded-xl bg-card border border-border/50">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Detailed Analysis
            </h4>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-transparent p-0 font-sans">
                {analysis.analysis}
              </pre>
            </div>
          </div>

          <div className="text-center">
            <Button variant="outline" onClick={resetAnalysis}>
              Analyze New Charts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
