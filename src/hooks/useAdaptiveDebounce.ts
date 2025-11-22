import { useDebounce } from './useDebounce';

export function useAdaptiveDebounce(value: string, baseDelay: number = 600): string {
  // PHASE 2 OPTIMIZATION: Smart debounce thresholds
  // - Empty: 0ms (instant clear)
  // - Long (>10 chars): 200ms (specific searches are fast)
  // - Short (1-10 chars): 800ms (ambiguous, wait for more input)
  let debounceTime: number;
  
  if (value.length === 0) {
    debounceTime = 0; // Instant when clearing search
  } else if (value.length > 10) {
    debounceTime = 200; // Fast for specific searches
  } else {
    debounceTime = 800; // Slower for short searches (wait for more input)
  }
  
  return useDebounce(value, debounceTime);
}
