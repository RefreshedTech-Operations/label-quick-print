
CREATE OR REPLACE FUNCTION public.find_shipment_by_uid(p_uid text)
RETURNS SETOF shipments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result shipments%ROWTYPE;
  trimmed_uid text;
BEGIN
  trimmed_uid := UPPER(TRIM(p_uid));

  -- Exact match on uid
  SELECT * INTO result FROM shipments WHERE UPPER(TRIM(uid)) = trimmed_uid LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Exact match on unit_id
  SELECT * INTO result FROM shipments WHERE UPPER(TRIM(unit_id)) = trimmed_uid LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  RETURN;
END;
$$;
