

## Fix: Station Picker Shows Empty List

**Root cause**: `loadStations()` runs on component mount before Supabase restores the auth session from localStorage. The `pack_stations` table has an RLS policy requiring `auth.uid() IS NOT NULL`, so the query returns zero rows when auth isn't ready yet.

### Changes to `src/pages/Pack.tsx`

1. **Wait for auth before loading stations**: Replace the bare `useEffect(loadStations, [])` with one that listens to `supabase.auth.onAuthStateChange`. When a `SIGNED_IN` or `INITIAL_SESSION` event fires, call `loadStations()`. This guarantees the query runs with a valid session.

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      loadStations();
      loadUser();
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

2. **Add a loading state** (optional): Show a "Loading..." placeholder in the station picker dropdown while stations array is empty and still loading, to distinguish from genuinely having no stations.

No backend or database changes needed.

