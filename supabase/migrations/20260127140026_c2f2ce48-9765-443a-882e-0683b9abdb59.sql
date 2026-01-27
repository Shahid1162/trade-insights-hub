-- Create table to track signal analysis usage
CREATE TABLE public.signal_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analysis_type TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.signal_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON public.signal_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage (controlled by edge function)
CREATE POLICY "Users can insert their own usage"
ON public.signal_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient daily queries
CREATE INDEX idx_signal_usage_user_date ON public.signal_usage (user_id, used_at);