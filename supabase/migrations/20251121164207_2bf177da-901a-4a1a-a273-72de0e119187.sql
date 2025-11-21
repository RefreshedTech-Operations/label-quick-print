-- Fix security warning: Add search_path to generate_shipment_search_vector function
CREATE OR REPLACE FUNCTION generate_shipment_search_vector()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.uid, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.order_id, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.buyer, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.tracking, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.product_name, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_id, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.address_full, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.order_group_id::text, '')), 'A');
  RETURN NEW;
END;
$$;