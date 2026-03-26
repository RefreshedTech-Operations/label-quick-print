CREATE OR REPLACE FUNCTION public.find_shipment_by_uid(p_uid text)
 RETURNS SETOF shipments
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Strict UID match (trimmed input, exact value) - unprinted only
  SELECT * INTO result
  FROM public.shipments
  WHERE uid = trimmed_uid
    AND (printed = false OR printed IS NULL)
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Strict UID case-insensitive match - unprinted only
  SELECT * INTO result
  FROM public.shipments
  WHERE UPPER(uid) = upper_uid
    AND (printed = false OR printed IS NULL)
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Strict Unit ID match (trimmed input, exact value) - unprinted only
  SELECT * INTO result
  FROM public.shipments
  WHERE unit_id = trimmed_uid
    AND (printed = false OR printed IS NULL)
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Strict Unit ID case-insensitive match - unprinted only
  SELECT * INTO result
  FROM public.shipments
  WHERE UPPER(unit_id) = upper_uid
    AND (printed = false OR printed IS NULL)
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  RETURN;
END;
$function$;