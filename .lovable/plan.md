

## SMS Messaging + Customer Profiles

This plan extends the previously approved SMS messaging plan by adding a **customers** concept -- allowing conversations to be linked to customer profiles, and a dedicated customer profile page showing full history.

### What You'll See

1. **Messages page** (`/messages`) -- Two-way SMS via Twilio with conversation list and message thread (as previously planned)
2. **Customers page** (`/customers`) -- Searchable list of all customers with name, phone, order count, and last contact date
3. **Customer Profile page** (`/customers/:id`) -- Shows customer details, their SMS conversation history, and their order history (pulled from shipments by matching buyer name)
4. **Link conversation to customer** -- Each SMS conversation can be attached to a customer record. When starting a new conversation you can pick an existing customer or create one.

### Twilio Setup
You'll need to provide three secrets:
- **TWILIO_ACCOUNT_SID** -- from your Twilio Console
- **TWILIO_AUTH_TOKEN** -- from your Twilio Console
- **TWILIO_PHONE_NUMBER** -- your Twilio number in E.164 format (e.g. +1234567890)

After deployment, a webhook URL will be provided to paste into Twilio Console for incoming messages.

---

### Technical Details

**1. Database changes (migration)**

Add `messaging` to the `app_role` enum:
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'messaging';
```

Create `customers` table:
- `id` (uuid PK)
- `name` (text, not null)
- `phone_number` (text, nullable, unique when not null)
- `email` (text, nullable)
- `notes` (text, nullable)
- `created_at` (timestamptz)
- `created_by_user_id` (uuid, nullable)
- RLS: messaging role users can SELECT/INSERT/UPDATE

Create `sms_conversations` table:
- `id` (uuid PK)
- `customer_id` (uuid, nullable FK to customers)
- `phone_number` (text, not null, unique)
- `last_message_at` (timestamptz)
- `created_at` (timestamptz)
- RLS: messaging role can SELECT/INSERT/UPDATE

Create `sms_messages` table:
- `id` (uuid PK)
- `conversation_id` (uuid FK to sms_conversations)
- `direction` (text: 'inbound'/'outbound')
- `body` (text)
- `twilio_sid` (text, nullable)
- `status` (text: 'queued'/'sent'/'delivered'/'failed'/'received')
- `sent_by_user_id` (uuid, nullable)
- `created_at` (timestamptz)
- RLS: messaging role can SELECT/INSERT
- Enable realtime for live updates

**2. Edge functions**

`send-sms/index.ts`:
- POST with `{ to, body, customer_id? }`
- Validates auth + messaging role
- Calls Twilio API to send SMS
- Upserts conversation (linking to customer if provided), inserts message
- Returns message SID

`twilio-webhook/index.ts`:
- Public endpoint for incoming SMS from Twilio
- Validates Twilio signature
- Upserts conversation by phone number, inserts inbound message
- Uses service role key

**3. New frontend pages and components**

`src/pages/Messages.tsx`:
- Split layout: conversation list (left) + message thread (right)
- New conversation dialog with phone number input and optional customer picker
- Realtime subscription on `sms_messages` for live incoming messages
- Role check on mount (messaging role required)

`src/pages/Customers.tsx`:
- Searchable/filterable list of all customers
- Shows name, phone, order count (from shipments by buyer match), last SMS date
- "Add Customer" button
- Click row to navigate to customer profile

`src/pages/CustomerProfile.tsx` (`/customers/:id`):
- Customer info card (name, phone, email, notes) with edit capability
- SMS conversation tab -- shows linked conversation thread, or button to start one
- Orders tab -- queries shipments where `buyer ILIKE customer.name` to show order history
- Ability to link/unlink a conversation to this customer

`src/components/ConversationList.tsx`:
- Lists conversations sorted by last message time
- Shows customer name (if linked) or phone number
- Unread indicator (stretch)

`src/components/MessageThread.tsx`:
- Chat bubble layout (outbound right-aligned, inbound left-aligned)
- Text input + send button
- Auto-scroll to bottom

**4. Navigation updates**

`src/components/Layout.tsx`:
- Add "Messages" nav link (MessageSquare icon) -- visible only to users with messaging role
- Add "Customers" nav link (Users icon) -- visible only to users with messaging role
- Role check via `supabase.rpc('has_role', { _user_id, _role: 'messaging' })` on mount

`src/App.tsx`:
- Add routes: `/messages`, `/customers`, `/customers/:id`

`src/pages/AdminTools.tsx`:
- Add `messaging` to the role dropdown options

**5. Secrets**
Three secrets will be requested: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

