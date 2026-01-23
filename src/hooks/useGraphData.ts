/**
 * Hook for fetching and caching codebase graph data
 */

import { useState, useEffect } from 'react';
import type { GraphData } from '../types/graph';

interface UseGraphDataResult {
  data: GraphData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGraphData(): UseGraphDataResult {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from public directory (served by Vite in dev, static in prod)
      const response = await fetch('/graph-data.json');

      if (!response.ok) {
        throw new Error(`Failed to load graph data: ${response.status}`);
      }

      const graphData: GraphData = await response.json();
      setData(graphData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading graph';
      setError(message);
      console.error('Failed to load graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchGraph,
  };
}
