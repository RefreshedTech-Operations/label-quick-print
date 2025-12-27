-- Drop the old 5-param version that doesn't have p_filter or printed_by_email
DROP FUNCTION IF EXISTS public.search_shipments(text, date, boolean, integer, integer);