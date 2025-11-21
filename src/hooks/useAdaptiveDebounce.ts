import { useDebounce } from './useDebounce';

export function useAdaptiveDebounce(value: string, baseDelay: number = 600): string {
  // Shorter debounce for longer searches (more specific = less results = faster query)
  const debounceTime = value.length > 10 ? 300 : baseDelay;
  return useDebounce(value, debounceTime);
}
