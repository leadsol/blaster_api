# לוגיקת מערכת הקמפיינים - LeadSol

## סקירה כללית

מערכת הקמפיינים מאפשרת שליחת הודעות WhatsApp בצורה אוטומטית לרשימת נמענים, עם תמיכה בוריאציות, השהיות, שעות פעילות, מכסות יומיות ועוד.

---

## 1. מבנה הקמפיין (Campaign Structure)

### שדות עיקריים בטבלת `campaigns`:

```sql
- id: UUID (מזהה ייחודי)
- user_id: UUID (בעל הקמפיין)
- name: string (שם הקמפיין)
- status: enum ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed')
- is_active: boolean (מתג פעיל/לא פעיל - ברירת מחדל: true)

-- הודעה
- message_template: text (תבנית ההודעה עם משתנים)
- message_variations: text[] (מערך וריאציות)
- media_url: string (קישור למדיה)
- media_type: enum ('image', 'video', 'audio', 'document')

-- סקר (Poll)
- poll_question: string (שאלת הסקר)
- poll_options: string[] (אפשרויות)
- poll_multiple_answers: boolean (אפשר בחירה מרובה)

-- מכשירים
- connection_id: UUID (מכשיר ראשי)
- device_ids: UUID[] (מערך מכשירים למצב מרובה)
- multi_device: boolean (האם מצב ריבוי מכשירים)

-- תזמון
- scheduled_at: timestamp (זמן שיגור מתוזמן)
- started_at: timestamp (זמן התחלה בפועל)
- paused_at: timestamp (זמן השהייה)
- estimated_duration: integer (משך משוער בשניות)

-- השהיות
- delay_min: integer (השהייה מינימלית בין הודעות - ברירת מחדל: 10 שניות)
- delay_max: integer (השהייה מקסימלית בין הודעות - ברירת מחדל: 60 שניות)
- pause_after_messages: integer (השהה אחרי X הודעות)
- pause_seconds: integer (משך ההשהיה)

-- שעות פעילות
- respect_active_hours: boolean (האם לכבד שעות פעילות)
- active_hours_start: time (שעת התחלה, למשל "09:00")
- active_hours_end: time (שעת סיום, למשל "18:00")

-- מכסה יומית
- daily_limit: integer (מכסת הודעות ליום, 0 = ללא הגבלה)
- daily_message_count: integer (מונה הודעות יומי)
- last_daily_reset: date (תאריך איפוס אחרון)

-- סטטיסטיקות
- total_recipients: integer (סה"כ נמענים)
- sent_count: integer (נשלחו)
- failed_count: integer (נכשלו)
```

### שדות בטבלת `campaign_messages`:

```sql
- id: UUID
- campaign_id: UUID
- phone: string (מספר טלפון מנורמל)
- name: string (שם הנמען)
- message_content: text (תוכן ההודעה לאחר החלפת משתנים)
- variables: jsonb (משתנים נוספים)
- status: enum ('pending', 'sent', 'failed', 'cancelled')
- scheduled_delay_seconds: integer (עיכוב מתוכנן מתחילת הקמפיין)
- sent_at: timestamp
- failed_at: timestamp
- error_message: text
```

---

## 2. סטטוסים של קמפיין (Campaign Statuses)

| סטטוס | תיאור | פעולות אפשריות |
|-------|-------|----------------|
| `draft` | טיוטה - לא שוגר | עריכה, מחיקה, שיגור |
| `scheduled` | מתוזמן לשיגור | עריכה, ביטול |
| `running` | פעיל ושולח הודעות | השהייה, ביטול, מתג פעיל/לא פעיל |
| `paused` | מושהה | המשך, ביטול, מתג פעיל/לא פעיל |
| `completed` | הושלם בהצלחה | צפייה, ייצוא, שכפול |
| `cancelled` | בוטל ידנית | צפייה, מחיקה |
| `failed` | נכשל | צפייה, מחיקה |

---

## 3. מתג פעיל/לא פעיל (is_active Toggle)

### מטרה:
מתג מאסטר שקובע האם הקמפיין ישלח הודעות בכלל, גם אם הוא בסטטוס `running`.

### לוגיקה:

```
אם is_active = false:
  - הקמפיין לא ישלח שום הודעה
  - אם הקמפיין היה running, הוא יעבור אוטומטית ל-paused
  - כפתורי "המשך" ו"השהה" יהיו מושבתים (באפור)
  - הטיימר יעצור

אם is_active = true:
  - הקמפיין יכול לשלוח הודעות (בכפוף לשעות פעילות ומכסה)
  - כפתורי "המשך" ו"השהה" יהיו פעילים
```

### קוד (toggle-active/route.ts):

```typescript
// כאשר מכבים את המתג
if (!is_active && campaign.status === 'running') {
  updateData.status = 'paused'
  updateData.paused_at = new Date().toISOString()
}
```

### בדיקה לפני שליחה (send-message/route.ts):

```typescript
if (campaign.is_active === false) {
  return { success: true, skipped: true, reason: 'Campaign is deactivated' }
}
```

---

## 4. השהיות בין הודעות (Message Delays)

### סוגי השהיות:

#### א. השהייה אקראית בין הודעות
- `delay_min` עד `delay_max` שניות בין כל הודעה
- ברירת מחדל: 10-60 שניות
- מחושב אקראית לכל הודעה

```typescript
const messageDelay = Math.floor(Math.random() * (delay_max - delay_min + 1)) + delay_min
```

#### ב. השהיות Bulk (מובנות במערכת)
כל 30 הודעות יש השהייה אוטומטית:

| אחרי הודעה | השהייה |
|------------|--------|
| 30 | 30 דקות (1,800 שניות) |
| 60 | 60 דקות (3,600 שניות) |
| 90+ | 90 דקות (5,400 שניות) - חוזר על עצמו |

```typescript
const MESSAGES_PER_BULK = 30
const BULK_PAUSE_SECONDS = [
  30 * 60,    // אחרי 30 הודעות: 30 דקות
  60 * 60,    // אחרי 60 הודעות: שעה
  90 * 60,    // אחרי 90+ הודעות: שעה וחצי (חוזר)
]

if (!isLastMessage && messageNumber % MESSAGES_PER_BULK === 0) {
  const bulkIndex = Math.floor(messageNumber / MESSAGES_PER_BULK) - 1
  const pauseIndex = Math.min(bulkIndex, BULK_PAUSE_SECONDS.length - 1)
  cumulativeDelaySeconds += BULK_PAUSE_SECONDS[pauseIndex]
}
```

#### ג. השהייה מותאמת אישית (לא פעיל כרגע)
- `pause_after_messages`: השהה אחרי X הודעות
- `pause_seconds`: משך ההשהייה

---

## 5. וריאציות הודעה (Message Variations)

### מטרה:
שליחת גרסאות שונות של ההודעה כדי להימנע מזיהוי כספאם.

### מבנה:
```typescript
message_variations: string[] = [
  "היי {שם}, מה שלומך?",
  "שלום {שם}! איך הולך?",
  "הי {שם}, מה קורה?"
]
```

### לוגיקה בעת שליחה:
```typescript
let messageText = message.message_content
const messageVariations: string[] = campaign.message_variations || []

if (messageVariations.length > 0) {
  const validVariations = messageVariations.filter(v => v && v.trim().length > 0)
  if (validVariations.length > 0) {
    // בחירה אקראית של וריאציה
    messageText = validVariations[Math.floor(Math.random() * validVariations.length)]

    // החלפת משתנים
    messageText = messageText.replace(/\{שם\}/g, message.name || '')
    messageText = messageText.replace(/\{טלפון\}/g, message.phone)

    // משתנים נוספים
    if (message.variables) {
      Object.entries(message.variables).forEach(([key, value]) => {
        messageText = messageText.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      })
    }
  }
}
```

### משתנים נתמכים:
- `{שם}` - שם הנמען
- `{טלפון}` - מספר הטלפון
- משתנים מותאמים מקובץ Excel

---

## 6. שעות פעילות (Active Hours)

### הגדרות:
- `respect_active_hours`: האם לכבד שעות פעילות
- `active_hours_start`: שעת התחלה (למשל "09:00")
- `active_hours_end`: שעת סיום (למשל "18:00")

### לוגיקה:

```typescript
function isWithinActiveHours(campaign): boolean {
  if (!campaign.respect_active_hours) return true
  if (!campaign.active_hours_start || !campaign.active_hours_end) return true

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  return currentTime >= campaign.active_hours_start &&
         currentTime < campaign.active_hours_end
}
```

### התנהגות מחוץ לשעות פעילות:

1. **בעת שליחת הודעה**: ההודעה נדחית לשעת ההתחלה הבאה
   ```typescript
   if (!isWithinActiveHours(campaign)) {
     // חשב זמן עד שעת ההתחלה הבאה
     const resumeTime = calculateNextActiveHoursStart(campaign)
     // תזמן מחדש
     scheduleMessage(messageId, resumeTime)
   }
   ```

2. **כפתור "המשך"**: מושבת (באפור) כאשר מחוץ לשעות פעילות
   ```typescript
   const isOutsideActiveHours = selectedCampaign.respect_active_hours &&
     (currentTime < active_hours_start || currentTime > active_hours_end)

   const isPauseResumeDisabled = isOutsideActiveHours || isDailyLimitReached || isInactive
   ```

3. **תצוגת "ימשיך בשעה"**: מציג מתי הקמפיין יחודש
   ```typescript
   if (isOutsideActiveHours) {
     const resumeDate = new Date()
     if (currentMinutes >= endMinutes) {
       resumeDate.setDate(resumeDate.getDate() + 1)
     }
     resumeDate.setHours(startH, startM, 0, 0)
     setResumeAt(resumeDate.toISOString())
   }
   ```

### עריכת שעות פעילות:
- אפשר לערוך בכל עת (גם כשהקמפיין פעיל)
- אפשר להסיר שעות פעילות (הקמפיין ישלח 24/7)
- אפשר להוסיף שעות פעילות לקמפיין שלא הוגדרו לו

---

## 7. מכסה יומית (Daily Limit)

### הגדרות:
- `daily_limit`: מכסת הודעות ליום (0 = ללא הגבלה)
- `daily_message_count`: מונה הודעות שנשלחו היום
- `last_daily_reset`: תאריך האיפוס האחרון

### לוגיקה:

#### איפוס יומי:
```typescript
const today = new Date().toISOString().split('T')[0]
if (campaign.last_daily_reset !== today) {
  await supabase
    .from('campaigns')
    .update({
      daily_message_count: 0,
      last_daily_reset: today
    })
    .eq('id', campaignId)
}
```

#### בדיקה לפני שליחה:
```typescript
if (campaign.daily_limit > 0 && campaign.daily_message_count >= campaign.daily_limit) {
  // הגענו למכסה - השהה עד חצות
  const midnight = new Date()
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)

  await pauseCampaign(campaignId)
  scheduleResume(campaignId, midnight)

  return { skipped: true, reason: 'Daily limit reached' }
}
```

#### עדכון מונה אחרי שליחה מוצלחת:
```typescript
await supabase
  .from('campaigns')
  .update({
    daily_message_count: campaign.daily_message_count + 1,
    sent_count: campaign.sent_count + 1
  })
  .eq('id', campaignId)
```

### תצוגה ב-UI:
- מציג "נשלחו X מתוך Y היום" כשיש מכסה
- כפתור "המשך" מושבת כשהגיעו למכסה
- מציג "ימשיך בחצות" כשהמכסה הושגה

---

## 8. התנגשות מכשירים (Device Conflict)

### בעיה:
מכשיר WhatsApp יכול לשלוח רק קמפיין אחד בכל רגע נתון.

### בדיקה ביצירת קמפיין חדש:

```typescript
// בודק אם המכשיר עסוק בקמפיין אחר
for (const device of connectedDevices) {
  const { data: busyCampaign } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .in('status', ['running', 'paused'])
    .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)
    .limit(1)
    .single()

  if (busyCampaign) {
    return NextResponse.json({
      error: `המכשיר "${device.display_name}" עסוק בקמפיין "${busyCampaign.name}"...`,
      canSaveAsDraft: true  // מאפשר לשמור כטיוטה
    }, { status: 409 })
  }
}
```

### בדיקה בעריכת טיוטה (PUT):
אותה בדיקה, עם הוספת `.neq('id', campaignId)` כדי לא לכלול את הקמפיין הנערך עצמו.

### תגובה ב-UI:
כשמתקבלת שגיאה 409 עם `canSaveAsDraft: true`:
```typescript
if (response.status === 409 && data.canSaveAsDraft) {
  setConfirmPopup({
    show: true,
    message: data.error + '\n\nהאם לשמור כטיוטה?',
    confirmText: 'שמור כטיוטה',
    onConfirm: () => handleSaveDraft()
  })
}
```

---

## 9. תהליך שליחת הודעות (Message Sending Flow)

### שלב 1: שיגור קמפיין
```
1. משתמש לוחץ "שגר קמפיין"
2. בדיקת תקינות (שם, הודעה, נמענים, מכשיר)
3. בדיקת התנגשות מכשירים
4. יצירת רשומת קמפיין בסטטוס 'scheduled'
5. יצירת רשומות הודעות עם scheduled_delay_seconds מחושב
6. קריאה ל-process endpoint להתחיל את העיבוד
```

### שלב 2: עיבוד (process)
```
1. שינוי סטטוס ל-'running'
2. שמירת started_at ו-estimated_duration
3. קריאה ל-process-batch לתזמון ההודעות
```

### שלב 3: עיבוד באצ'ים (process-batch)
```
1. בדיקת is_active (אם false - עצור)
2. בדיקת status (אם לא running - עצור)
3. בדיקת שעות פעילות
4. בדיקת מכסה יומית
5. שליפת 5 הודעות הבאות בסטטוס 'pending'
6. תזמון כל הודעה עם ה-delay המתאים
7. תזמון הבאצ' הבא (אחרי ההודעה האחרונה בבאצ' + 10 שניות)
```

### שלב 4: שליחת הודעה בודדת (send-message)
```
1. שליפת פרטי ההודעה והקמפיין
2. בדיקת is_active
3. בדיקת status = 'running'
4. בדיקת שעות פעילות
5. בדיקת מכסה יומית
6. בחירת וריאציה (אם יש)
7. החלפת משתנים
8. שליחה דרך WAHA API
9. עדכון סטטוס ההודעה (sent/failed)
10. עדכון מונים בקמפיין
11. בדיקה אם זו ההודעה האחרונה → סיום קמפיין
```

### תרשים זרימה:
```
┌─────────────┐
│  שיגור     │
└──────┬──────┘
       ▼
┌─────────────┐
│  process    │
└──────┬──────┘
       ▼
┌─────────────────┐
│  process-batch  │◄─────────────────────┐
└──────┬──────────┘                      │
       │                                 │
       ▼                                 │
┌─────────────────┐    ┌────────────┐    │
│ תזמון 5 הודעות │───►│ send-msg 1 │    │
└─────────────────┘    ├────────────┤    │
                       │ send-msg 2 │    │
                       ├────────────┤    │
                       │ send-msg 3 │    │
                       ├────────────┤    │
                       │ send-msg 4 │    │
                       ├────────────┤    │
                       │ send-msg 5 │    │
                       └──────┬─────┘    │
                              │          │
                              ▼          │
                       ┌────────────┐    │
                       │ עוד הודעות?│────┘
                       │    כן      │
                       └──────┬─────┘
                              │ לא
                              ▼
                       ┌────────────┐
                       │  הושלם    │
                       └────────────┘
```

---

## 10. מצבי כישלון וטיפול בשגיאות

### כישלון שליחת הודעה:
```typescript
try {
  await waha.messages.sendText(...)
} catch (error) {
  // עדכון ההודעה כנכשלה
  await supabase
    .from('campaign_messages')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      error_message: error.message
    })
    .eq('id', messageId)

  // עדכון מונה הקמפיין
  await supabase
    .from('campaigns')
    .update({ failed_count: campaign.failed_count + 1 })
    .eq('id', campaignId)

  // תזמון מיידי של ההודעה הבאה (לא נעצרים בגלל כישלון)
  await scheduleNextMessageImmediately(campaignId)
}
```

### סוגי שגיאות WAHA:
| קוד | משמעות | טיפול |
|-----|---------|--------|
| 401 | לא מורשה | בדוק API key |
| 404 | סשן לא קיים | התחבר מחדש |
| 500 | שגיאת WAHA פנימית | נסה שוב / התחבר מחדש |

### כישלון מכשיר:
```typescript
if (connection.status !== 'connected') {
  // מכשיר לא מחובר - מדלג להודעה הבאה
  await scheduleNextMessageImmediately(campaignId)
  return { error: 'No connected device' }
}
```

---

## 11. תזמון (Scheduling Systems)

### QStash (Production):
משמש בסביבת production לתזמון אמין:
```typescript
await qstash.publishJSON({
  url: `${appUrl}/api/campaigns/${campaignId}/send-message`,
  body: { messageId },
  delay: delaySeconds,
  retries: 3
})
```

### setTimeout Fallback (Localhost):
משמש בפיתוח מקומי:
```typescript
if (!isQStashConfigured()) {
  setTimeout(async () => {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-internal-secret': CRON_SECRET },
      body: JSON.stringify({ messageId })
    })
  }, delaySeconds * 1000)
}
```

### בדיקת QStash:
```typescript
export const isQStashConfigured = (): boolean => {
  const appUrl = getAppUrl()
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')

  if (isLocalhost) return false  // QStash לא יכול לקרוא ל-localhost

  return qstashClient !== null
}
```

---

## 12. פעולות משתמש (User Actions)

### השהייה (Pause):
```typescript
// PATCH /api/campaigns/[id] { action: 'pause' }
if (campaign.status !== 'running') {
  return { error: 'ניתן להשהות רק קמפיינים פעילים' }
}

await supabase.from('campaigns').update({
  status: 'paused',
  paused_at: new Date().toISOString()
}).eq('id', campaignId)
```

### המשך (Resume):
```typescript
// PATCH /api/campaigns/[id] { action: 'resume' }
if (campaign.status !== 'paused') {
  return { error: 'ניתן להמשיך רק קמפיינים מושהים' }
}

// חישוב זמן נותר
const remainingDuration = lastPendingDelay - lastSentDelay

await supabase.from('campaigns').update({
  status: 'running',
  started_at: new Date().toISOString(),
  estimated_duration: remainingDuration,
  paused_at: null
}).eq('id', campaignId)

// הפעלה מחדש
await fetch(`/api/campaigns/${campaignId}/process`, { method: 'POST' })
```

### ביטול (Cancel):
```typescript
// PATCH /api/campaigns/[id] { action: 'cancel' }
await supabase.from('campaigns').update({
  status: 'cancelled'
}).eq('id', campaignId)

// ביטול כל ההודעות הממתינות
await supabase.from('campaign_messages').update({
  status: 'cancelled'
}).eq('campaign_id', campaignId).eq('status', 'pending')
```

### מחיקה (Delete):
```typescript
// DELETE /api/campaigns/[id]
if (campaign.status === 'running') {
  return { error: 'Cannot delete running campaign' }
}

await supabase.from('campaigns').delete().eq('id', campaignId)
// ההודעות נמחקות אוטומטית (CASCADE)
```

### שכפול (Duplicate):
יוצר העתק של הקמפיין בסטטוס 'draft' עם אותם הגדרות ונמענים.

---

## 13. ממשק משתמש (UI Components)

### כרטיס קמפיין פעיל:
```
┌─────────────────────────────────────┐
│  שם הקמפיין                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  נשלחו: 45/120 (37%)                │
│  ⏱️ 12:34 נותרו                     │
│                                     │
│  [פעיל/לא פעיל] [השהה] [בטל] [⏰]   │
└─────────────────────────────────────┘
```

### כפתורים ומצביהם:
| כפתור | פעיל כאשר | מושבת כאשר |
|--------|----------|------------|
| מתג פעיל | תמיד | - |
| השהה | status=running, is_active=true | is_active=false, מחוץ לשעות |
| המשך | status=paused, is_active=true | is_active=false, מחוץ לשעות, מכסה הושגה |
| בטל | status=running/paused | - |
| שעות פעילות | תמיד | - |

---

## 14. טבלאות נתונים

### campaigns
| שדה | סוג | ברירת מחדל | תיאור |
|-----|-----|------------|-------|
| id | uuid | gen_random_uuid() | מזהה ייחודי |
| user_id | uuid | | בעל הקמפיין |
| name | text | | שם הקמפיין |
| status | text | 'draft' | סטטוס |
| is_active | boolean | true | מתג פעיל |
| message_template | text | | תבנית הודעה |
| message_variations | text[] | '{}' | וריאציות |
| delay_min | integer | 10 | השהייה מינימלית |
| delay_max | integer | 60 | השהייה מקסימלית |
| respect_active_hours | boolean | true | שעות פעילות |
| active_hours_start | time | '09:00' | שעת התחלה |
| active_hours_end | time | '18:00' | שעת סיום |
| daily_limit | integer | 0 | מכסה יומית |
| daily_message_count | integer | 0 | מונה יומי |

### campaign_messages
| שדה | סוג | תיאור |
|-----|-----|-------|
| id | uuid | מזהה ייחודי |
| campaign_id | uuid | קמפיין הורה |
| phone | text | מספר טלפון |
| name | text | שם נמען |
| message_content | text | תוכן מחושב |
| variables | jsonb | משתנים נוספים |
| status | text | pending/sent/failed/cancelled |
| scheduled_delay_seconds | integer | עיכוב מתוכנן |
| sent_at | timestamp | זמן שליחה |
| failed_at | timestamp | זמן כישלון |

---

## 15. API Endpoints

### קמפיינים
| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | /api/campaigns | רשימת קמפיינים |
| POST | /api/campaigns | יצירת קמפיין חדש |
| GET | /api/campaigns/[id] | פרטי קמפיין |
| PUT | /api/campaigns/[id] | עדכון קמפיין (טיוטה) |
| PATCH | /api/campaigns/[id] | פעולות (pause/resume/cancel) |
| DELETE | /api/campaigns/[id] | מחיקת קמפיין |

### פעולות מיוחדות
| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | /api/campaigns/[id]/process | התחלת עיבוד |
| POST | /api/campaigns/[id]/process-batch | עיבוד באצ' |
| POST | /api/campaigns/[id]/send-message | שליחת הודעה בודדת |
| PATCH | /api/campaigns/[id]/toggle-active | מתג פעיל/לא פעיל |
| PATCH | /api/campaigns/[id]/active-hours | עדכון שעות פעילות |

### טיוטות
| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | /api/campaigns/draft | שמירת טיוטה |

---

## 16. Migration SQL

```sql
-- הוספת שדה is_active
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- הוספת שדות מכסה יומית
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS daily_message_count INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS last_daily_reset DATE;
```

---

## סיכום

מערכת הקמפיינים מספקת:
- ✅ שליחת הודעות אוטומטית עם השהיות אקראיות
- ✅ וריאציות הודעה למניעת זיהוי כספאם
- ✅ שעות פעילות מוגדרות
- ✅ מכסה יומית
- ✅ מתג פעיל/לא פעיל
- ✅ השהייה וחידוש
- ✅ מניעת התנגשות מכשירים
- ✅ טיפול בשגיאות ונסיונות חוזרים
- ✅ תמיכה ב-localhost (setTimeout) ו-production (QStash)
