
-- Create customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_number text,
  email text,
  notes text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_phone_number ON public.customers (phone_number) WHERE phone_number IS NOT NULL;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messaging users can view customers" ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Messaging users can insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Messaging users can update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'messaging'));

-- Create sms_conversations table
CREATE TABLE public.sms_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone_number text NOT NULL UNIQUE,
  contact_name text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messaging users can view conversations" ON public.sms_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Messaging users can insert conversations" ON public.sms_conversations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Messaging users can update conversations" ON public.sms_conversations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Service role can insert conversations" ON public.sms_conversations FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update conversations" ON public.sms_conversations FOR UPDATE TO service_role
  USING (true);
CREATE POLICY "Service role can select conversations" ON public.sms_conversations FOR SELECT TO service_role
  USING (true);

-- Create sms_messages table
CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.sms_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL,
  twilio_sid text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  sent_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messaging users can view messages" ON public.sms_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Messaging users can insert messages" ON public.sms_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'messaging'));
CREATE POLICY "Service role can insert messages" ON public.sms_messages FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can select messages" ON public.sms_messages FOR SELECT TO service_role
  USING (true);

-- Enable realtime for sms_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;

-- Indexes
CREATE INDEX idx_sms_messages_conversation_id ON public.sms_messages(conversation_id);
CREATE INDEX idx_sms_messages_created_at ON public.sms_messages(created_at);
CREATE INDEX idx_sms_conversations_last_message ON public.sms_conversations(last_message_at DESC);
