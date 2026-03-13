
CREATE OR REPLACE FUNCTION public.find_shipment_by_uid(p_uid text)
RETURNS SETOF shipments
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  upper_uid text := UPPER(p_uid);
  result shipments%ROWTYPE;
BEGIN
  -- Step 1: Exact match (uses btree index, fastest)
  SELECT * INTO result FROM shipments WHERE uid = upper_uid LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Step 2: Prefix match (uses text_pattern_ops index)
  SELECT * INTO result FROM shipments WHERE uid ILIKE upper_uid || '%' LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Step 3: Suffix match (uses trigram index)
  SELECT * INTO result FROM shipments WHERE uid ILIKE '%' || upper_uid LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- No match found
  RETURN;
END;
$$;
