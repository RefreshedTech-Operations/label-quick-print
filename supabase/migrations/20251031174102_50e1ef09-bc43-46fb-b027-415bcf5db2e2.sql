-- Add DELETE policy for shipments table
CREATE POLICY "Users can delete their own shipments"
ON public.shipments
FOR DELETE
USING (auth.uid() = user_id);