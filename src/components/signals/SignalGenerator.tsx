import React, { useState, useEffect } from 'react';
import { BarChart3, Upload, Loader2, Target, TrendingUp, TrendingDown, Clock, AlertCircle, ShieldAlert, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SignalAnalysis } from '@/lib/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type AnalysisType = 'intraday' | 'swing' | 'positional';

const timeframeInfo = {
  intraday: { label: 'Intraday', timeframes: ['15min', '5min'], description: 'Short-term scalping and day trading' },
  swing: { label: 'Swing', timeframes: ['4H', '1H'], description: 'Multi-day position holding' },
  positional: { label: 'Positional', timeframes: ['1D', '4H'], description: 'Long-term investment positions' },
};

const DAILY_LIMIT = 3;

export const SignalGenerator: React.FC = () => {
  const { isAuthenticated, setShowAuthModal, setAuthMode, user } = useAuth();
  const [analysisType, setAnalysisType] = useState<AnalysisType>('intraday');
  const [uploadedImages, setUploadedImages] = useState<{ tf1: File | null; tf2: File | null }>({ tf1: null, tf2: null });
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [remaining, setRemaining] = useState<number>(DAILY_LIMIT);
  const [isOwner, setIsOwner] = useState(false);
  const [checkingUsage, setCheckingUsage] = useState(false);

  // Check usage on mount and when user changes
  useEffect(() => {
    const checkUsage = async () => {
      if (!user) {
        setRemaining(DAILY_LIMIT);
        setIsOwner(false);
        return;
      }

      setCheckingUsage(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count, error } = await supabase
          .from('signal_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('used_at', today.toISOString());

        if (!error) {
          setRemaining(Math.max(0, DAILY_LIMIT - (count ?? 0)));
        }

        // Check if owner
        setIsOwner(user.email === 'shaikshahid25476@gmail.com');
      } catch (err) {
        console.error('Failed to check usage:', err);
      } finally {
        setCheckingUsage(false);
      }
    };

    checkUsage();
  }, [user]);

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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
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
    
    try {
      // Check limit before proceeding (client-side check for better UX)
      if (!isOwner && remaining <= 0) {
        toast.error(`Daily limit reached! You've used all ${DAILY_LIMIT} analyses for today.`);
        setLoading(false);
        return;
      }

      // Convert images to base64
      const [image1Base64, image2Base64] = await Promise.all([
        fileToBase64(uploadedImages.tf1),
        fileToBase64(uploadedImages.tf2)
      ]);

      const timeframes = timeframeInfo[analysisType].timeframes;

      // Call the analysis edge function
      const { data, error } = await supabase.functions.invoke('analyze-chart', {
        body: {
          analysisType,
          image1Base64,
          image2Base64,
          timeframe1: timeframes[0],
          timeframe2: timeframes[1]
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to analyze charts');
      }

      if (data.error) {
        if (data.limitReached) {
          setRemaining(0);
          toast.error(data.message || 'Daily limit reached!');
          return;
        }
        throw new Error(data.error);
      }

      // Update remaining from response
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining);
      }
      if (typeof data.isOwner === 'boolean') {
        setIsOwner(data.isOwner);
      }

      const analysisResult: SignalAnalysis = {
        type: analysisType,
        entry: data.entry,
        takeProfit: data.takeProfit,
        stopLoss: data.stopLoss,
        bias: data.bias,
        confidence: data.confidence,
        analysis: data.analysis,
      };
      
      setAnalysis(analysisResult);
      toast.success('Analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze charts. Please try again.');
    } finally {
      setLoading(false);
    }
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
          Upload your chart images and let AI analyze for trading signals
        </p>
        
        {/* Usage indicator */}
        {isAuthenticated && !checkingUsage && (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            isOwner 
              ? 'bg-primary/10 text-primary border border-primary/30'
              : remaining > 0 
                ? 'bg-muted text-muted-foreground' 
                : 'bg-destructive/10 text-destructive border border-destructive/30'
          }`}>
            {isOwner ? (
              <>
                <BarChart3 className="w-4 h-4" />
                Unlimited Access
              </>
            ) : remaining > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                {remaining} of {DAILY_LIMIT} analyses remaining today
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                Daily limit reached - resets at midnight
              </>
            )}
          </div>
        )}
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
            disabled={loading || !uploadedImages.tf1 || !uploadedImages.tf2 || (!isOwner && remaining <= 0)}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Charts...
              </>
            ) : !isOwner && remaining <= 0 ? (
              <>
                <AlertCircle className="w-5 h-5" />
                Limit Reached
              </>
            ) : (
              <>
                <BarChart3 className="w-5 h-5" />
                Generate Signal {!isOwner && `(${remaining} left)`}
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

          {/* Risk Warning */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-1">⚠️ Risk Management Warning</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Always trade as per your own risk tolerance. Never risk more than you can afford to lose. 
                If you're unsure about proper position sizing, use the <button onClick={(e) => { e.stopPropagation(); const calcNav = document.querySelector('[data-section="calculator"]') as HTMLElement; if (calcNav) calcNav.click(); }} className="text-primary underline underline-offset-2 hover:text-primary/80 font-semibold inline-flex items-center gap-1"><Calculator className="w-3 h-3" />Lot Size Calculator</button> to manage your risk properly before entering any trade.
              </p>
            </div>
          </div>


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
