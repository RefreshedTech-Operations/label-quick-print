-- Enable realtime for shipments table to detect location changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;