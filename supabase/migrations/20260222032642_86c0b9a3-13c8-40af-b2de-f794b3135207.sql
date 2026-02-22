
-- sms_conversations: replace messaging role policies with authenticated
DROP POLICY IF EXISTS "Messaging users can insert conversations" ON public.sms_conversations;
DROP POLICY IF EXISTS "Messaging users can update conversations" ON public.sms_conversations;
DROP POLICY IF EXISTS "Messaging users can view conversations" ON public.sms_conversations;

CREATE POLICY "Authenticated users can insert conversations" ON public.sms_conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update conversations" ON public.sms_conversations FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view conversations" ON public.sms_conversations FOR SELECT USING (auth.uid() IS NOT NULL);

-- sms_messages: replace messaging role policies with authenticated
DROP POLICY IF EXISTS "Messaging users can insert messages" ON public.sms_messages;
DROP POLICY IF EXISTS "Messaging users can view messages" ON public.sms_messages;

CREATE POLICY "Authenticated users can insert messages" ON public.sms_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view messages" ON public.sms_messages FOR SELECT USING (auth.uid() IS NOT NULL);

-- customers: replace messaging role policies with authenticated
DROP POLICY IF EXISTS "Messaging users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Messaging users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Messaging users can view customers" ON public.customers;

CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
