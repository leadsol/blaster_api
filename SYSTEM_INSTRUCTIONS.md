# LeadSol - מדריך מערכת מקיף

> ⚠️ **עדכון חשוב - 14.01.2026**: תוקנו 4 באגים קריטיים! ראה [FIXES_APPLIED.md](FIXES_APPLIED.md) לפרטים מלאים ו-migration חובה.

## תיאור כללי
**LeadSol** היא פלטפורמת אוטומציה לשיווק בוואטסאפ עם ממשק בעברית (RTL). המערכת מאפשרת ניהול קמפיינים, ניהול אנשי קשר, צ'אט בזמן אמת, וחיבור למספר מכשירי וואטסאפ.

---

## סטאק טכנולוגי

### Frontend
- **Next.js 16.1.1** (App Router) + **React 19.2.3**
- **TypeScript 5** - קוד מוקלד במלואו
- **Tailwind CSS 4** - עיצוב עם מערכת עיצוב מותאמת אישית
- **Rubik Font** - תמיכה בעברית ולטינית
- **Lucide React** - ספריית אייקונים
- **Date-fns** - טיפול בתאריכים עם תמיכה בעברית

### State Management
- **Zustand 5.0.9** - ניהול מצב קל משקל
- **React Context API** - ThemeContext, SidebarContext, NavigationGuardContext
- **React Hook Form 7.70.0** + **Zod 4.3.5** - טפסים וולידציה

### Backend & Database
- **Supabase** - PostgreSQL + Authentication + Realtime
  - `@supabase/ssr 0.8.0`
  - `@supabase/supabase-js 2.90.1`
  - Row Level Security (RLS) להפרדת משתמשים

### WhatsApp Integration
- **WAHA (WhatsApp HTTP API)** - קליינט מקיף עם תמיכה ב:
  - Sessions management
  - שליחת הודעות (טקסט, תמונה, וידאו, אודיו, מסמכים, סקרים)
  - ניהול אנשי קשר וקבוצות
  - ערוצים (Channels/Newsletters)
  - סטטוסים/סטוריז
  - נוכחות והקלדה
  - תוויות (WhatsApp Business)
  - טיפול במדיה

### Queue & Scheduling
- **Upstash QStash 2.8.4** - תזמון שליחת הודעות
- **Upstash Redis 1.36.1** - קאשינג ואחסון סשנים
- **Upstash Ratelimit 2.0.8** - הגבלת קצב API

### Data & Analytics
- **@tanstack/react-table 8.21.3** - טבלאות מתקדמות
- **XLSX 0.18.5** - ייבוא/ייצוא אקסל
- **Recharts 3.6.0** - גרפים לאנליטיקס

### Media Processing
- **@ffmpeg/ffmpeg 0.12.15** - עיבוד וידאו בדפדפן
- **Emoji Mart** - בורר אימוג'י להודעות

---

## מבנה פרויקט

```
leadsol/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # מסלולי אימות
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   ├── verify-email/
│   │   │   ├── onboarding/           # תהליך הטמעה רב-שלבי
│   │   │   │   ├── workspace/        # הגדרת workspace
│   │   │   │   ├── business/         # פרטי עסק
│   │   │   │   ├── goal/             # בחירת מטרה
│   │   │   │   ├── source/           # מקור לידים
│   │   │   │   └── leads/            # ייבוא לידים ראשוני
│   │   │   └── auth/callback/        # Supabase callback
│   │   │
│   │   ├── (dashboard)/              # מסלולים מוגנים
│   │   │   ├── chat/                 # ממשק צ'אט בזמן אמת
│   │   │   ├── analytics/            # אנליטיקס קמפיינים
│   │   │   ├── campaigns/            # ניהול קמפיינים
│   │   │   │   ├── new/              # אשף יצירת קמפיין
│   │   │   │   └── [id]/summary/     # סיכום והפעלת קמפיין
│   │   │   ├── contacts/             # ניהול אנשי קשר
│   │   │   ├── connections/          # חיבורי מכשירי וואטסאפ
│   │   │   ├── notifications/        # התראות
│   │   │   ├── profile/              # הגדרות פרופיל
│   │   │   ├── pricing/              # מנויים
│   │   │   ├── resources/            # עזרה ומשאבים
│   │   │   └── affiliate/            # שותפים
│   │   │
│   │   ├── api/                      # API Routes
│   │   │   ├── campaigns/
│   │   │   │   ├── route.ts          # רשימה/יצירה
│   │   │   │   ├── draft/            # שמירת טיוטה
│   │   │   │   ├── scheduler/        # Cron לקמפיינים מתוזמנים
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # קבלה/עדכון/מחיקה
│   │   │   │       ├── process-batch/# עיבוד אצווה (QStash)
│   │   │   │       ├── process/      # התחלת עיבוד קמפיין
│   │   │   │       └── send-message/ # שליחת הודעה בודדת (QStash)
│   │   │   ├── chat/
│   │   │   │   ├── send/             # שליחת הודעת צ'אט
│   │   │   │   ├── conversations/    # רשימת שיחות
│   │   │   │   └── history/          # היסטוריית צ'אט
│   │   │   ├── waha/
│   │   │   │   ├── webhook/          # קבלת webhooks מ-WAHA
│   │   │   │   └── sessions/         # ניהול סשנים
│   │   │   ├── sheets/               # אקסל ייבוא/ייצוא
│   │   │   ├── notifications/        # API התראות
│   │   │   └── support/              # יצירת פניית תמיכה
│   │   │
│   │   ├── globals.css               # סגנונות גלובליים + מערכת עיצוב
│   │   ├── layout.tsx                # Layout שורש עם Providers
│   │   └── page.tsx                  # ניתוב מחדש ל-/chat
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx        # Layout Dashboard עם sidebar
│   │   │   └── Sidebar.tsx           # תפריט ניווט צד
│   │   ├── modals/
│   │   │   ├── Modal.tsx             # קומפוננטת modal בסיס
│   │   │   ├── ConfirmModal.tsx      # דיאלוג אישור
│   │   │   ├── AlertModal.tsx        # הודעות התראה
│   │   │   └── SupportModal.tsx      # טופס תמיכה
│   │   ├── providers/
│   │   │   └── Providers.tsx         # עטיפת Context providers
│   │   ├── ui/
│   │   │   ├── MessageInput.tsx      # שדה קלט הודעות צ'אט
│   │   │   └── Skeleton.tsx          # שלדים לטעינה
│   │   └── ErrorBoundary.tsx         # תפיסת שגיאות
│   │
│   ├── contexts/
│   │   ├── ThemeContext.tsx          # מצב כהה/בהיר
│   │   ├── SidebarContext.tsx        # מצב פתוח/סגור sidebar
│   │   └── NavigationGuardContext.tsx# אזהרה על שינויים לא שמורים
│   │
│   ├── hooks/
│   │   ├── useRealtimeChat.ts        # הודעות צ'אט בזמן אמת
│   │   └── useRealtimeNotifications.ts# התראות בזמן אמת
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Supabase קליינט דפדפן
│   │   │   ├── server.ts             # Supabase קליינט שרת + Admin
│   │   │   └── middleware.ts         # Middleware אימות
│   │   ├── waha.ts                   # WAHA API קליינט מקיף
│   │   ├── qstash.ts                 # כלי תזמון QStash
│   │   ├── redis.ts                  # Redis client
│   │   ├── rate-limit.ts             # הגבלות קצב
│   │   ├── api-utils.ts              # כלי עזר API
│   │   ├── text-spinner.ts           # מנוע וריאציות טקסט
│   │   └── utils.ts                  # כלי עזר כלליים
│   │
│   ├── types/
│   │   └── database.ts               # טיפוסי TypeScript למסד נתונים
│   │
│   └── middleware.ts                 # Next.js middleware (auth)
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── .env.local                        # משתני סביבה
```

---

## סכמת מסד נתונים (Supabase PostgreSQL)

### טבלאות ליבה:

#### **profiles**
פרופילי משתמשים (מקושר ל-auth.users)
```sql
- id (UUID, PK, FK → auth.users)
- email (TEXT)
- full_name (TEXT)
- avatar_url (TEXT)
- company_name (TEXT)
- phone (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### **connections**
חיבורי מכשירי וואטסאפ
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- session_name (TEXT, UNIQUE) - שם ייחודי למכשיר
- phone_number (TEXT)
- display_name (TEXT)
- status (TEXT) - connected, disconnected, connecting, qr_pending
- qr_code (TEXT) - QR code בטענה
- pairing_code (TEXT) - קוד צימוד 8 ספרות
- first_connected_at (TIMESTAMP)
- last_seen_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### **contact_lists**
רשימות אנשי קשר
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- name (TEXT)
- description (TEXT)
- contact_count (INTEGER) - מספר אנשי קשר ברשימה
- created_at (TIMESTAMP)
```

#### **contacts**
אנשי קשר עם משתנים מותאמים אישית
```sql
- id (UUID, PK)
- contact_list_id (UUID, FK → contact_lists)
- phone (TEXT) - מספר טלפון
- name (TEXT)
- email (TEXT)
- variables (JSONB) - משתנים מותאמים אישית
- is_blacklisted (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### **campaigns**
קמפיינים שיווקיים
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- name (TEXT)
- status (TEXT) - draft, scheduled, running, paused, completed, failed
- message_template (TEXT) - תבנית הודעה עם משתנים
- media_url (TEXT) - קישור למדיה
- media_type (TEXT) - image, video, audio, document
- poll_question (TEXT) - שאלת סקר
- poll_options (TEXT[]) - אפשרויות סקר
- message_variations (TEXT[]) - וריאציות של ההודעה
- multi_device (BOOLEAN) - שימוש במספר מכשירים
- device_ids (TEXT[]) - IDs של המכשירים לשימוש
- delay_min (INTEGER) - עיכוב מינימלי בין הודעות (שניות)
- delay_max (INTEGER) - עיכוב מקסימלי בין הודעות (שניות)
- scheduled_at (TIMESTAMP) - מועד תזמון
- total_contacts (INTEGER)
- sent_count (INTEGER)
- delivered_count (INTEGER)
- read_count (INTEGER)
- failed_count (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

#### **campaign_messages**
הודעות בודדות בתוך קמפיינים
```sql
- id (UUID, PK)
- campaign_id (UUID, FK → campaigns)
- phone (TEXT)
- message_content (TEXT) - תוכן ההודעה הסופי אחרי משתנים
- status (TEXT) - pending, sent, delivered, read, failed
- waha_message_id (TEXT) - ID ההודעה ב-WhatsApp
- sent_at (TIMESTAMP)
- delivered_at (TIMESTAMP)
- read_at (TIMESTAMP)
- scheduled_delay_seconds (INTEGER) - עיכוב מתוכנן מתחילת הקמפיין
- error_message (TEXT)
- created_at (TIMESTAMP)
```

#### **chat_messages**
הודעות צ'אט בזמן אמת
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- chat_id (TEXT) - מזהה שיחה (מספר טלפון)
- waha_message_id (TEXT) - ID ההודעה ב-WhatsApp
- content (TEXT)
- media_url (TEXT)
- media_type (TEXT)
- from_me (BOOLEAN) - האם ההודעה נשלחה ממני
- timestamp (BIGINT) - Unix timestamp
- ack (INTEGER) - 0-4 (0=שגיאה, 1=ממתין, 2=נשלח, 3=נמסר, 4=נקרא)
- created_at (TIMESTAMP)
```

#### **scheduled_messages**
הודעות מתוזמנות לשליחה עתידית
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- phone (TEXT)
- message (TEXT)
- media_url (TEXT)
- media_type (TEXT)
- scheduled_at (TIMESTAMP)
- status (TEXT) - pending, sent, failed, cancelled
- sent_at (TIMESTAMP)
- error_message (TEXT)
- created_at (TIMESTAMP)
```

#### **blacklist**
מספרי טלפון חסומים לפי משתמש
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- phone (TEXT)
- reason (TEXT)
- created_at (TIMESTAMP)
```

#### **notifications**
התראות משתמש
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- type (TEXT) - message, campaign, connection, system, alert
- title (TEXT)
- description (TEXT)
- action_url (TEXT)
- is_read (BOOLEAN)
- created_at (TIMESTAMP)
```

#### **support_tickets**
פניות תמיכה
```sql
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- category (TEXT) - technical, billing, feature, other
- priority (TEXT) - low, medium, high, urgent
- subject (TEXT)
- description (TEXT)
- status (TEXT) - open, in_progress, resolved, closed
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### טבלאות נוספות (Webhook Data):
- **message_reactions** - תגובות להודעות
- **contact_presence** - סטטוס נוכחות
- **labels** - תוויות WhatsApp Business
- **chat_labels** - קישור תוויות לצ'אטים
- **group_events** - אירועי קבוצות
- **poll_votes** - תשובות לסקרים
- **call_logs** - היסטוריית שיחות

---

## תהליכי עבודה מרכזיים

### 1. תהליך אימות (Authentication Flow)

**הרשמה והתחברות:**
1. הרשמה עם אימייל/סיסמה דרך Supabase Auth
2. אימות אימייל נדרש
3. תהליך הטמעה רב-שלבי (onboarding):
   - **Workspace**: הגדרת שם workspace
   - **Business**: פרטי עסק (שם, תעשייה, גודל)
   - **Goal**: בחירת מטרה (יצירת לידים, שירות לקוחות, מכירות)
   - **Source**: מקור לידים (אתר, רשתות חברתיות, ממליצים)
   - **Leads**: ייבוא לידים ראשוני
4. מסלולים מוגנים עם middleware
5. פונקציונליות "זכור אותי"

**אבטחה:**
- JWT tokens מ-Supabase
- Cookies מאובטחים
- Row Level Security (RLS) במסד הנתונים
- Middleware בודק כל בקשה

---

### 2. ניהול חיבורי וואטסאפ

**יצירת חיבור חדש:**
1. יצירת session בשם ייחודי (LEADSOL1, LEADSOL2, וכו')
2. שלוש שיטות חיבור:
   - **QR Code Scan**: הצגת QR לסריקה באפליקציית וואטסאפ
   - **Send to Phone**: SMS עם קישור ל-QR
   - **Pairing Code**: קוד בן 8 ספרות ל-WhatsApp > Linked Devices
3. עדכוני סטטוס בזמן אמת דרך webhook
4. יכולות: הפעלה מחדש, התנתקות, מחיקת session
5. תמיכה במספר מכשירים למשתמש אחד

**סטטוסים:**
- `qr_pending` - ממתין לסריקת QR / הזנת קוד
- `connecting` - מתחבר...
- `connected` - מחובר
- `disconnected` - מנותק

**API Endpoints:**
- `POST /api/waha/sessions/create` - יצירת session
- `GET /api/waha/sessions/status` - בדיקת סטטוס
- `POST /api/waha/sessions/restart` - הפעלה מחדש
- `POST /api/waha/sessions/logout` - התנתקות
- `DELETE /api/waha/sessions/delete` - מחיקה

---

### 3. יצירה והפעלת קמפיינים

#### **שלב 1: בחירת נמענים**

**3 אפשרויות:**
1. **ייבוא מאקסל**:
   - פורמטים נתמכים: .xlsx, .xls, .csv
   - עמודות נדרשות: `phone` (חובה), `name` (אופציונלי)
   - עמודות מותאמות אישית נהפכות למשתנים
   - דוגמה: `{name}`, `{company}`, `{product}`

2. **שימוש ברשימה קיימת**:
   - בחירה מרשימות contact_lists
   - שימוש באנשי קשר שכבר קיימים

3. **הזנה ידנית**:
   - טופס להזנת מספרי טלפון
   - אפשרות להוסיף שם וערכים נוספים

**משתנים נתמכים:**
- `{name}` - שם איש הקשר
- `{phone}` - מספר טלפון
- כל עמודה נוספת מהאקסל הופכת למשתנה

#### **שלב 2: תוכן ההודעה**

**תכונות:**
1. **הודעת טקסט עם משתנים**:
   ```
   שלום {name},
   אני רוצה להציע לך מוצר מעולה ב{company}!
   ```

2. **Text Spinning (וריאציות טקסט)**:
   תחביר: `{אפשרות1|אפשרות2|אפשרות3}`

   דוגמה:
   ```
   {היי|שלום|מה נשמע} {name},
   {רציתי|רוצה} {להציע לך|לשתף אותך עם} {מבצע|הצעה} {מעולה|מדהימה}!
   ```

   לכל נמען נבחרת וריאציה אקראית → מגוון הודעות → פחות דיווחי ספאם

3. **קבצי מדיה**:
   - תמונה (image/jpeg, image/png)
   - וידאו (video/mp4)
   - אודיו (audio/mpeg, audio/ogg)
   - מסמך (application/pdf, וכו')
   - העלאה לשרת או קישור חיצוני

4. **סקרים (Polls)**:
   - שאלה + עד 12 אפשרויות
   - WhatsApp מציג כ-poll אינטראקטיבי

5. **וריאציות הודעות**:
   - מספר תבניות שונות של אותה הודעה
   - כל הודעה נשלחת עם וריאציה אחרת
   - מאפשר 200 הודעות נוספות מעבר למגבלת היומית הבסיסית

#### **שלב 3: הגדרות קמפיין**

**עיכובים (Delays):**
- **עיכוב בין הודעות**: 10-60 שניות (אקראי)
- **הפסקות אוטומטיות (Bulk Pauses)**:
  - אחרי 30 הודעות → 30 דקות הפסקה
  - אחרי 60 הודעות → 1 שעה הפסקה
  - אחרי 90 הודעות → 1.5 שעות הפסקה (חוזר)

**מכשירים מרובים (Multi-Device):**
- אם מופעל: הודעות מסתובבות בין כל המכשירים המחוברים
- העלאת throughput - כל מכשיר יכול לשלוח 90-100 הודעות/יום
- בחירה אקראית של מכשיר לכל הודעה

**רשימת הדרה (Blacklist):**
- אפשרות להדיר מספרי טלפון ספציפיים
- שימוש ברשימת blacklist גלובלית של המשתמש

**תזמון (Scheduling):**
- שליחה מיידית או תזמון לתאריך ושעה עתידית
- שמירה כ-`draft` עם `scheduled_at`
- Cron job בודק כל דקה קמפיינים מתוזמנים

#### **הפעלת קמפיין (Execution)**

**תהליך:**

1. **יצירה (Creation)**:
   - סטטוס: `draft`
   - יצירת רשומת campaign
   - יצירת campaign_messages לכל נמען
   - **החלפת משתנים**: `{name}` → ערך אמיתי
   - **יצירת וריאציות**: text spinning מחושב פעם אחת
   - **חישוב עיכובים**: `scheduled_delay_seconds` לכל הודעה

2. **השקה (Launch)** - מעמוד Summary:
   - שינוי סטטוס ל-`running`
   - קריאה ל-`/api/campaigns/[id]/process`
   - תזמון האצווה הראשונה

3. **מעבד אצוות (Batch Processor)** - `/api/campaigns/[id]/process-batch`:
   - מביא 5 הודעות `pending` הבאות (ממוינות לפי `scheduled_delay_seconds`)
   - לכל הודעה:
     - מחשב מתי לשלוח (עיכוב אקראי 10-60 שניות מההודעה הקודמת)
     - תזמון ב-QStash ל-`/api/campaigns/[id]/send-message`
   - תזמון האצווה הבאה אחרי שהאצווה הנוכחית נשלחת

4. **שולח הודעות בודדות (Message Sender)** - `/api/campaigns/[id]/send-message`:
   - בדיקה שהקמפיין עדיין `running`
   - בחירת מכשיר:
     - אם multi-device: בחירה אקראית
     - אם לא: המכשיר היחיד של המשתמש
   - שליחת ההודעה דרך WAHA API
   - עדכון סטטוס ל-`sent` + `waha_message_id`
   - עדכון מונה `sent_count` בקמפיין
   - ניסיון חוזר (3 פעמים) במקרה של כשל

5. **עדכוני סטטוס (Status Updates)** - דרך webhook:
   - `message.ack` מ-WAHA:
     - ack=2 → `sent`
     - ack=3 → `delivered` + עדכון `delivered_count`
     - ack=4 → `read` + עדכון `read_count`
   - עדכונים בזמן אמת דרך Supabase Realtime

6. **השלמה (Completion)**:
   - כאשר כל ההודעות נשלחו (או נכשלו)
   - סטטוס → `completed`
   - `completed_at` → timestamp נוכחי

**מגבלות יומיות (Daily Limits):**
- **בסיס**: 90-100 הודעות למכשיר ליום
- **בונוס וריאציות**: +200 הודעות אם יש וריאציות הודעה
- **מכשירים מרובים**: כפל המגבלה בכמות המכשירים

**טיפול בשגיאות:**
- 3 ניסיונות חוזרים אוטומטיים (QStash retries)
- שמירת `error_message` בהודעה
- אם כל הניסיונות נכשלו → סטטוס `failed`

---

### 4. צ'אט בזמן אמת

**תכונות:**
1. **רשימת שיחות**:
   - טעינה מ-`chat_messages`
   - קיבוץ לפי `chat_id` (מספר טלפון)
   - מונה הודעות שלא נקראו
   - מיון לפי הודעה אחרונה

2. **תצוגת צ'אט**:
   - הודעות נכנסות ויוצאות
   - בועות שיחה מותאמות RTL
   - אינדיקטורים לסטטוס:
     - ✓ (אפור) - נשלח
     - ✓✓ (אפור) - נמסר
     - ✓✓ (כחול) - נקרא
   - תמיכה במדיה: תמונות, וידאו, אודיו, מסמכים
   - תצוגת emoji picker

3. **שליחת הודעות**:
   - טקסט פשוט
   - קבצי מדיה
   - הודעות מתוזמנות (`scheduled_messages`)
   - הקלדה בזמן אמת (typing indicator)

4. **Realtime Updates**:
   - הוק `useRealtimeChat`:
     - מאזין ל-INSERT/UPDATE ב-`chat_messages`
     - מעדכן state אוטומטית
   - ללא רענון דף

5. **תוויות (Labels)**:
   - VIP, Lead, Hot, Cold, וכו'
   - צבעים מותאמים אישית
   - סינון לפי תווית

6. **טאבים**:
   - **Live Chats**: שיחות רגילות
   - **Campaign Replies**: תשובות לקמפיינים

---

### 5. Webhooks מ-WAHA

**Endpoint**: `/api/waha/webhook`

**אבטחה:**
- HMAC-SHA512 signature verification
- Secret: `WAHA_WEBHOOK_SECRET`
- Header: `x-webhook-hmac-sha512`

**סוגי אירועים:**

1. **message** - הודעה חדשה התקבלה:
   - שמירה ב-`chat_messages`
   - יצירת notification למשתמש
   - עדכון unread count

2. **message.ack** - עדכון סטטוס הודעה:
   - ack=0 → שגיאה
   - ack=1 → ממתין
   - ack=2 → נשלח לשרת
   - ack=3 → נמסר למכשיר
   - ack=4 → נקרא
   - עדכון ב-`chat_messages` וב-`campaign_messages`

3. **session.status** - שינוי סטטוס חיבור:
   - עדכון ב-`connections`
   - יצירת notification

4. **message.reaction** - תגובה להודעה:
   - שמירה ב-`message_reactions`

5. **message.revoked** - הודעה נמחקה:
   - עדכון content ל-"הודעה נמחקה"

6. **presence.update** - עדכון נוכחות:
   - שמירה ב-`contact_presence`
   - הצגת "מקליד..." / "אונליין"

7. **group.join / group.leave** - אירועי קבוצה:
   - שמירה ב-`group_events`

8. **poll.vote** - הצבעה בסקר:
   - שמירה ב-`poll_votes`
   - עדכון אנליטיקס סקר

9. **call.received / call.accepted / call.rejected** - שיחות:
   - שמירה ב-`call_logs`

---

### 6. מנוע Text Spinning

**תחביר:**
```
{אפשרות1|אפשרות2|אפשרות3}
```

**דוגמאות:**
```
{היי|שלום|מה קורה} {name},
{רציתי|אני רוצה} להציע לך {מבצע|הצעה} {מעולה|מדהימה}!
```

**לוגיקה:**
1. **ולידציה** (`validateTextSpinner`):
   - בדיקת סוגריים מאוזנים
   - בדיקת תחביר תקין
   - החזרת שגיאות בעברית

2. **יצירת וריאציה** (`processTextSpinner`):
   - זיהוי כל `{...}` בטקסט
   - בחירה אקראית של אפשרות מתוך `|`
   - החלפה בטקסט הסופי

3. **החלפת משתנים** (`replaceVariables`):
   - החלפת `{name}`, `{phone}`, משתנים מותאמים
   - ערכים מ-object של איש הקשר

**קובץ**: `src/lib/text-spinner.ts`

---

## משתני סביבה נדרשים

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WAHA (WhatsApp HTTP API)
WAHA_API_URL=https://waha.litbe.co.il
WAHA_API_KEY=your-waha-api-key
WAHA_WEBHOOK_SECRET=your-webhook-secret

# Upstash (QStash & Redis)
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=random-secret-for-cron-jobs
```

---

## הגבלות קצב (Rate Limits)

**מוגדרות ב-`src/lib/rate-limit.ts`:**

```typescript
- API כללי: 100 req/min
- Campaign API: 10 req/min
- Auth API: 5 req/min
- Webhook: 1000 req/min
- Message sending: 30 req/min
```

**מנגנון:**
- Sliding window עם Upstash Redis
- כותרות בתשובה:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

## מערכת עיצוב (Design System)

### צבעים

```css
/* Primary */
--color-primary: #030733;           /* כחול כהה */
--color-primary-hover: #04094a;

/* Accent */
--color-accent: #0043E0;            /* כחול */
--color-accent-hover: #0039b8;

/* Success */
--color-success: #187C55;           /* ירוק */
--color-whatsapp: #25D366;          /* ירוק וואטסאפ */

/* Error */
--color-error: #CD1B1B;             /* אדום */
--color-error-hover: #a31616;

/* Background */
--color-bg-primary: #F2F3F8;        /* אפור בהיר */
--color-bg-dark: #0a1628;           /* רקע כהה */

/* Text */
--color-text-primary: #030733;
--color-text-secondary: #6B7280;
--color-text-light: #9CA3AF;
```

### טייפוגרפיה

```css
/* Font Family */
font-family: 'Rubik', sans-serif;   /* תמיכה בעברית + לטינית */

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Spacing

```css
/* Padding & Margin */
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
```

### Borders & Radius

```css
/* Border Radius */
--radius-sm: 0.5rem;   /* 8px */
--radius-md: 0.75rem;  /* 12px */
--radius-lg: 1rem;     /* 16px */
--radius-xl: 1.5rem;   /* 24px */
--radius-full: 9999px; /* עיגול מלא */

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

### Responsive Breakpoints

```css
/* Mobile First */
sm: 640px   /* טאבלט קטן */
md: 768px   /* טאבלט */
lg: 1024px  /* לפטופ */
xl: 1280px  /* מסך גדול */
2xl: 1536px /* מסך ענק */
```

### RTL Support

```css
/* כיווניות */
direction: rtl;
text-align: right;

/* Flexbox RTL */
flex-direction: row-reverse;

/* Grid RTL */
/* אוטומטי ב-CSS Grid */
```

### אפקטים מיוחדים

**Blue Blur Circles** (רקע דקורטיבי):
```css
/* עיגולים מטושטשים כחולים ברקע */
- מיקום: פינות שונות של המסך
- gradient: radial-gradient(circle, rgba(0, 67, 224, 0.3), transparent)
- filter: blur(100px)
- מוסתר במובייל לביצועים
```

---

## ארכיטקטורת API

### דפוס (Pattern)

```
GET    /api/{resource}              → רשימה
POST   /api/{resource}              → יצירה
GET    /api/{resource}/[id]         → קבלה
PUT    /api/{resource}/[id]         → עדכון
DELETE /api/{resource}/[id]         → מחיקה
POST   /api/{resource}/[id]/{action}→ פעולה
```

### Authentication

כל ה-API routes מאומתים דרך:
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()

if (error || !user) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}
```

**למעט:**
- `/api/waha/webhook` - מאומת דרך HMAC signature
- `/api/campaigns/scheduler` - מאומת דרך `CRON_SECRET`
- `/api/campaigns/[id]/process-batch` - מאומת דרך QStash signature
- `/api/campaigns/[id]/send-message` - מאומת דרך QStash signature

### תבנית תשובה סטנדרטית

**הצלחה:**
```json
{
  "data": {...},
  "message": "הודעה בעברית"
}
```

**שגיאה:**
```json
{
  "error": "תיאור השגיאה בעברית",
  "code": "ERROR_CODE"
}
```

### טיפול בשגיאות

```typescript
try {
  // לוגיקה...
} catch (error) {
  console.error('Error:', error)
  return NextResponse.json(
    { error: 'שגיאה בעיבוד הבקשה' },
    { status: 500 }
  )
}
```

---

## ניהול State

### Context Providers

1. **ThemeContext** - מצב כהה/בהיר:
```typescript
const { theme, setTheme, toggleTheme } = useTheme()
// theme: 'light' | 'dark'
// שמירה ב-localStorage
```

2. **SidebarContext** - מצב sidebar:
```typescript
const {
  isCollapsed,
  setIsCollapsed,
  isMobileMenuOpen,
  toggleMobileMenu
} = useSidebar()
```

3. **NavigationGuardContext** - אזהרה על שינויים לא שמורים:
```typescript
const { setHasUnsavedChanges } = useNavigationGuard()
// מציג אזהרה לפני ניווט אם יש שינויים
```

### Zustand (Prepared, not yet used)

```typescript
import { create } from 'zustand'

// דוגמה למבנה עתידי:
const useCampaignStore = create((set) => ({
  campaigns: [],
  currentCampaign: null,
  setCampaigns: (campaigns) => set({ campaigns }),
  setCurrentCampaign: (campaign) => set({ currentCampaign: campaign })
}))
```

### Realtime Hooks

**useRealtimeChat**:
```typescript
const messages = useRealtimeChat(chatId)
// מאזין ל-INSERT/UPDATE ב-chat_messages
// מעדכן state אוטומטית
```

**useRealtimeNotifications**:
```typescript
const notifications = useRealtimeNotifications()
// מאזין ל-INSERT ב-notifications
// מעדכן מונה unread
```

---

## אבטחה (Security)

### 1. אימות (Authentication)
- **Supabase Auth** עם JWT tokens
- Tokens נשמרים ב-cookies מאובטחים
- Middleware בודק כל בקשה
- Refresh tokens אוטומטי

### 2. הרשאות (Authorization)
- **Row Level Security (RLS)** ב-Supabase
- כל שורה מקושרת ל-`user_id`
- Policies מונעות גישה לא מורשית
- Service role key רק בשרת (לעולם לא בקליינט!)

### 3. ולידציה (Validation)
- **Zod schemas** לכל טופס
- ולידציה בצד שרת וקליינט
- סניטציה של קלט משתמש
- Parameterized queries (הגנה מפני SQL injection)

### 4. Rate Limiting
- הגבלות קצב על כל ה-endpoints
- Sliding window algorithm
- Upstash Redis לאחסון מצב
- Headers מתאימים בתשובה

### 5. Webhook Security
- **HMAC-SHA512** signature verification
- Secret משותף בין WAHA לשרת
- ולידציה של כל webhook
- דחיית בקשות לא חתומות

### 6. QStash Security
- Signature verification בפרודקשן
- שני signing keys (current + next)
- רוטציה אוטומטית של keys

### 7. Environment Variables
- **לעולם לא** להדליף service role key
- משתנים רגישים רק בשרת
- `NEXT_PUBLIC_*` נחשף לקליינט - זהירות!

### 8. XSS Protection
- React escapes content אוטומטית
- שימוש ב-`dangerouslySetInnerHTML` רק כשצריך
- סניטציה של HTML מ-webhooks

---

## ביצועים (Performance)

### 1. Server-Side Rendering (SSR)
- Next.js 16 App Router
- קומפוננטות שרת כברירת מחדל
- קומפוננטות קליינט רק כשצריך (`'use client'`)

### 2. Code Splitting
- Lazy loading של routes
- Dynamic imports לקומפוננטות כבדות
```typescript
const HeavyComponent = dynamic(() => import('./Heavy'), {
  loading: () => <Skeleton />
})
```

### 3. Image Optimization
- Next.js `<Image>` component
- Lazy loading אוטומטי
- WebP format
- Responsive sizes

### 4. Caching
- **Redis** לקאשינג session data
- **Supabase** query caching
- Browser caching של assets סטטיים

### 5. Database Optimization
- Indexes על עמודות חיפוש תכופות
- Pagination לטבלאות גדולות
- Select רק עמודות נחוצות

### 6. Realtime Optimization
- פילטרים על subscriptions
- Unsubscribe כשעוזבים דף
- Debouncing של עדכונים תכופים

### 7. Bundle Optimization
- Tree shaking אוטומטי
- Minification בפרודקשן
- Tailwind CSS purging

---

## Deployment

### Vercel (מומלץ)

1. **התקנה**:
```bash
npm install -g vercel
vercel login
```

2. **Deploy**:
```bash
vercel
```

3. **משתני סביבה**:
   - הוסף כל המשתנים מ-`.env.local` ב-Vercel Dashboard
   - Settings → Environment Variables

4. **Domains**:
   - הוסף דומיין מותאם אישית
   - SSL אוטומטי

### Docker (אופציונלי)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### CI/CD

**GitHub Actions** (דוגמה):
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
```

---

## פיצ'רים לא מושלמים / מתוכננים

### סטטוס נוכחי:

✅ **מושלם:**
- אימות והרשמה
- ניהול חיבורי וואטסאפ
- יצירת קמפיינים
- שליחת הודעות בזמן אמת
- צ'אט בזמן אמת
- webhooks מ-WAHA
- text spinning
- multi-device support
- scheduled messages
- analytics בסיסיים
- תמיכת RTL מלאה

🚧 **בפיתוח / מתוכנן:**

1. **בוט (Bot)** - מסומן כ-"בקרוב" ב-sidebar:
   - תשובות אוטומטיות
   - AI-powered responses
   - תבניות תשובה

2. **אנליטיקס מתקדמים**:
   - גרפים מפורטים יותר
   - דוחות ייצוא
   - A/B testing של וריאציות

3. **שילובים (Integrations)**:
   - CRM systems (Salesforce, HubSpot)
   - Zapier
   - Google Sheets sync

4. **Affiliate Program**:
   - עמוד קיים אך לא מיושם
   - מערכת הפניות ותשלומים

5. **Pricing Plans**:
   - תשלומים (Stripe/PayPal)
   - מנויים שונים
   - גבילות לפי תוכנית

6. **תבניות הודעות (Message Templates)**:
   - ספריית תבניות מוכנות
   - שמירת תבניות אישיות
   - קטגוריות (מכירות, תמיכה, שיווק)

7. **גיבוי וייצוא נתונים**:
   - ייצוא קמפיינים
   - ייצוא אנשי קשר
   - גיבוי היסטוריית צ'אט

---

## פקודות שימושיות

### פיתוח
```bash
# התקנת dependencies
npm install

# הרצה במצב פיתוח
npm run dev

# בנייה לפרודקשן
npm run build

# הרצה בפרודקשן
npm start

# Lint
npm run lint
```

### Database
```bash
# Supabase CLI
npx supabase init
npx supabase start
npx supabase db push
npx supabase db pull
npx supabase gen types typescript --local > src/types/database.ts
```

### Deployment
```bash
# Vercel
vercel
vercel --prod

# Docker
docker build -t leadsol .
docker run -p 3000:3000 leadsol
```

---

## משאבים ודוקומנטציה

### תיעוד טכנולוגיות:
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [WAHA API](https://waha.devlike.pro/)
- [QStash Docs](https://upstash.com/docs/qstash)
- [Zustand](https://docs.pmnd.rs/zustand)

### קבצים חשובים:
- `src/lib/waha.ts` - WAHA API client המקיף
- `src/lib/text-spinner.ts` - מנוע text spinning
- `src/lib/qstash.ts` - תזמון הודעות
- `src/types/database.ts` - טיפוסי מסד נתונים
- `src/app/globals.css` - מערכת עיצוב

---

## טיפים לפיתוח

### הוספת API endpoint חדש:
1. צור קובץ `src/app/api/{resource}/route.ts`
2. הוסף אימות משתמש
3. הוסף rate limiting
4. הוסף ולידציה עם Zod
5. עדכן `src/types/database.ts` אם צריך

### הוספת קומפוננטה חדשה:
1. צור ב-`src/components/{category}/`
2. השתמש ב-TypeScript
3. עקוב אחר design system
4. תמיכה ב-RTL
5. Responsive design

### הוספת טבלה במסד נתונים:
1. צור migration ב-Supabase
2. הוסף RLS policies
3. עדכן טיפוסים: `npx supabase gen types`
4. צור queries/mutations
5. הוסף realtime subscription אם צריך

### דיבוג:
```typescript
// בקליינט
console.log('Debug:', data)

// בשרת
console.error('Error:', error)

// Supabase logs
const { data, error } = await supabase.from('table').select()
if (error) console.error('Supabase error:', error)
```

---

## סיכום

**LeadSol** היא מערכת שלמה ומורכבת לשיווק בוואטסאפ עם:
- ✅ ארכיטקטורה מודרנית (Next.js 16 + Supabase)
- ✅ קמפיינים מתקדמים עם text spinning ו-multi-device
- ✅ צ'אט בזמן אמת עם realtime updates
- ✅ תזמון הודעות עם QStash
- ✅ ממשק בעברית RTL מלא
- ✅ אבטחה מקיפה (RLS, rate limiting, webhooks verification)
- ✅ תמיכה במדיה מלאה (תמונות, וידאו, אודיו, מסמכים, סקרים)

המערכת מוכנה לפרודקשן ומסוגלת לטפל בקמפיינים גדולים עם מגבלות יומיות ואסטרטגיות שליחה חכמות.

---

**גרסה**: 1.0.0
**עדכון אחרון**: 2026-01-14
**מחבר**: LeadSol Team
