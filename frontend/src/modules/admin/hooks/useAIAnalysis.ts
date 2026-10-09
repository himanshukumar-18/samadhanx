import { useState, useEffect, useCallback } from 'react';
import { AIAnalysisData, adminApi } from '../../../api/admin';

interface UseAIAnalysisOptions {
  problemId: string;
  initialAnalysis?: AIAnalysisData | null;
  onAnalysisUpdated?: (updated: AIAnalysisData) => void;
}

export function useAIAnalysis({
  problemId,
  initialAnalysis,
  onAnalysisUpdated,
}: UseAIAnalysisOptions) {
  const [analysis, setAnalysis] = useState<AIAnalysisData | null>(initialAnalysis || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  // Auto-fetch existing analysis if initialAnalysis is not provided
  useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis);
      return;
    }

    let isMounted = true;
    const fetchLatest = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await adminApi.getProblemAIAnalysis(problemId);
        if (isMounted && res.success && res.data.latest) {
          setAnalysis(res.data.latest);
          if (onAnalysisUpdated) {
            onAnalysisUpdated(res.data.latest);
          }
        }
      } catch (err: unknown) {
        // Failing to read cached analysis silently keeps state as null (ready to generate)
        console.warn('Could not fetch cached AI analysis:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLatest();

    return () => {
      isMounted = false;
    };
  }, [problemId, initialAnalysis, onAnalysisUpdated]);

  const mapErrorMessage = (err: unknown): { code: string; message: string } => {
    const errorObj = err as { response?: { data?: { detail?: { code?: string; message?: string } | string } } };
    const detail = errorObj?.response?.data?.detail;
    if (detail && typeof detail === 'object') {
      const code = detail.code || 'AI_ANALYSIS_FAILED';
      let message = detail.message || 'AI analysis could not be completed.';
      if (code === 'AI_ANALYSIS_TIMEOUT') {
        message = 'AI inference took longer than expected. Please retry.';
      } else if (code === 'AI_REANALYSIS_COOLDOWN') {
        message = detail.message || 'Please wait a moment before re-analyzing.';
      } else if (code === 'AI_SERVICE_UNAVAILABLE') {
        message = 'AI service is temporarily unavailable.';
      } else if (code === 'INVALID_API_KEY' || code === 'AI_CONFIG_ERROR') {
        message = 'Groq API Key is invalid or expired. Please update GROQ_API_KEY in your environment configuration.';
      }
      return { code, message };
    } else if (typeof detail === 'string') {
      return { code: 'AI_ANALYSIS_FAILED', message: detail };
    }
    const msg = err instanceof Error ? err.message : 'Failed to generate AI insights';
    return { code: 'AI_ANALYSIS_FAILED', message: msg };
  };

  const generate = useCallback(
    async (force = false) => {
      try {
        setIsGenerating(true);
        setError(null);
        const res = await adminApi.generateProblemAIAnalysis(problemId, { force });
        if (res.success && res.data) {
          setAnalysis(res.data);
          if (onAnalysisUpdated) {
            onAnalysisUpdated(res.data);
          }
        }
      } catch (err: unknown) {
        const parsed = mapErrorMessage(err);
        setError(parsed);
      } finally {
        setIsGenerating(false);
      }
    },
    [problemId, onAnalysisUpdated]
  );

  const regenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      setError(null);
      const res = await adminApi.reanalyzeProblemAI(problemId, {
        force: true,
        reason: 'Admin UI manual refresh',
      });
      if (res.success && res.data) {
        setAnalysis(res.data);
        if (onAnalysisUpdated) {
          onAnalysisUpdated(res.data);
        }
      }
    } catch (err: unknown) {
      const parsed = mapErrorMessage(err);
      setError(parsed);
    } finally {
      setIsGenerating(false);
    }
  }, [problemId, onAnalysisUpdated]);

  return {
    analysis,
    isLoading,
    isGenerating,
    error,
    generate,
    regenerate,
  };
}
