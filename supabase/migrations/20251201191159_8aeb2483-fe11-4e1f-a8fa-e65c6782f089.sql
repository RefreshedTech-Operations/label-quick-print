-- Fix existing bundle data integrity by consolidating items with same tracking number

-- Step 1: Update all items with duplicate tracking to use consistent order_group_id
WITH tracking_groups AS (
  SELECT 
    tracking,
    COALESCE(
      (array_agg(order_group_id ORDER BY created_at) FILTER (WHERE order_group_id IS NOT NULL))[1],
      gen_random_uuid()
    ) as group_id
  FROM shipments
  WHERE tracking IS NOT NULL 
    AND tracking != ''
  GROUP BY tracking
  HAVING COUNT(*) > 1
)
UPDATE shipments s
SET 
  order_group_id = tg.group_id,
  bundle = true
FROM tracking_groups tg
WHERE s.tracking = tg.tracking;

-- Step 2: Create trigger function to auto-bundle items on insert
CREATE OR REPLACE FUNCTION auto_bundle_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  existing_group_id UUID;
BEGIN
  IF NEW.tracking IS NOT NULL AND NEW.tracking != '' THEN
    SELECT order_group_id INTO existing_group_id
    FROM shipments
    WHERE tracking = NEW.tracking
    AND id != NEW.id
    LIMIT 1;
    
    IF existing_group_id IS NOT NULL THEN
      NEW.order_group_id := existing_group_id;
      NEW.bundle := true;
      
      UPDATE shipments
      SET bundle = true
      WHERE tracking = NEW.tracking
      AND id != NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Create trigger
DROP TRIGGER IF EXISTS trigger_auto_bundle ON shipments;
CREATE TRIGGER trigger_auto_bundle
  BEFORE INSERT ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION auto_bundle_on_insert();