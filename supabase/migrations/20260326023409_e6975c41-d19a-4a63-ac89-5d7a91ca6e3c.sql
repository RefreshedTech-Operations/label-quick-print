CREATE INDEX IF NOT EXISTS idx_shipments_unit_id ON public.shipments USING btree (unit_id);
CREATE INDEX IF NOT EXISTS idx_shipments_unit_id_upper ON public.shipments USING btree (upper(unit_id));

CREATE OR REPLACE FUNCTION public.find_shipment_by_uid(p_uid text)
RETURNS SETOF public.shipments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.shipments%ROWTYPE;
  trimmed_uid text;
  upper_uid text;
BEGIN
  trimmed_uid := TRIM(COALESCE(p_uid, ''));
  IF trimmed_uid = '' THEN
    RETURN;
  END IF;

  upper_uid := UPPER(trimmed_uid);

  -- Strict UID match (trimmed input, exact value)
  SELECT * INTO result
  FROM public.shipments
  WHERE uid = trimmed_uid
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Strict UID case-insensitive match
  SELECT * INTO result
  FROM public.shipments
  WHERE UPPER(uid) = upper_uid
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Strict Unit ID match (trimmed input, exact value)
  SELECT * INTO result
  FROM public.shipments
  WHERE unit_id = trimmed_uid
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Strict Unit ID case-insensitive match
  SELECT * INTO result
  FROM public.shipments
  WHERE UPPER(unit_id) = upper_uid
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  RETURN;
END;
$$;