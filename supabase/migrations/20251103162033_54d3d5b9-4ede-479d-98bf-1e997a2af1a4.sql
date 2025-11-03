-- Drop existing RLS policies for shipments
DROP POLICY IF EXISTS "Users can view their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can insert their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can update their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can delete their own shipments" ON public.shipments;

-- Create new policies for shipments - allow all authenticated users to access all rows
CREATE POLICY "Authenticated users can view all shipments" 
ON public.shipments 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert shipments" 
ON public.shipments 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update shipments" 
ON public.shipments 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shipments" 
ON public.shipments 
FOR DELETE 
TO authenticated
USING (true);

-- Drop existing RLS policies for print_jobs
DROP POLICY IF EXISTS "Users can view their own print jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Users can insert their own print jobs" ON public.print_jobs;

-- Create new policies for print_jobs - allow all authenticated users to access all rows
CREATE POLICY "Authenticated users can view all print jobs" 
ON public.print_jobs 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert print jobs" 
ON public.print_jobs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update print jobs" 
ON public.print_jobs 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete print jobs" 
ON public.print_jobs 
FOR DELETE 
TO authenticated
USING (true);