# Database Migrations

## הוראות הרצה

### Migration: add_missing_campaign_columns.sql

**תיאור**: הוספת עמודות חסרות לטבלת campaigns

**חובה להריץ**: ✅ כן! המערכת לא תעבוד ללא העמודות האלו

**מתי להריץ**: מיד אחרי pull של הקוד החדש

---

### איך להריץ:

1. **פתח Supabase Dashboard**
   - https://supabase.com/dashboard
   - בחר את הפרויקט שלך

2. **פתח SQL Editor**
   - לחץ על "SQL Editor" בתפריט צד
   - לחץ על "+ New query"

3. **העתק והדבק**
   - פתח את הקובץ `add_missing_campaign_columns.sql`
   - העתק את כל התוכן
   - הדבק ב-SQL Editor

4. **הרץ**
   - לחץ על "Run" (או Ctrl/Cmd + Enter)
   - המתן לסיום

5. **וודא הצלחה**
   - בדוק שהתוצאה מציגה 12 עמודות
   - אם יש שגיאה - צור קשר

---

### מה קורה אם לא הרצתי?

אם לא תריץ את ה-migration, תקבל שגיאות:

- ❌ `column "paused_at" does not exist`
- ❌ `column "estimated_duration" does not exist`
- ❌ `column "multi_device" does not exist`
- ❌ וכו'

---

### איך לבדוק שה-migration רץ?

הרץ את ה-SQL הזה ב-Supabase:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name IN (
  'paused_at',
  'estimated_duration',
  'multi_device'
)
ORDER BY column_name;
```

אמור להחזיר 3 שורות (או 12 אם בדקת את כולן).

---

---

### Migration: add_timestamps_to_messages.sql

**תיאור**: הוספת עמודת failed_at לטבלת campaign_messages

**חובה להריץ**: ✅ כן! בלי זה אין תיעוד של זמני כישלון

**מתי להריץ**: מיד אחרי pull של הקוד החדש

**מה זה מוסיף**:
- `failed_at` - זמן שבו הודעה נכשלה
- אינדקסים למיון מהיר לפי זמן פעילות

---

### Migration: add_error_message_to_campaigns.sql

**תיאור**: הוספת עמודת error_message לטבלת campaigns

**חובה להריץ**: ✅ כן! בלי זה לא ניתן לראות שגיאות של קמפיינים שנכשלו

**מתי להריץ**: מיד אחרי pull של הקוד החדש

**מה זה מוסיף**:
- `error_message` - הודעת שגיאה כאשר קמפיין נכשל (למשל: "המכשיר X עסוק בקמפיין Y")
- אינדקס למציאת מהירה של קמפיינים כושלים עם הודעות שגיאה

**לבדוק שרץ**:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name = 'error_message';
```

אמור להחזיר שורה אחת עם `error_message`.

---

### Migration: add_active_hours_to_campaigns.sql

**תיאור**: הוספת עמודות שעות פעילות לטבלת campaigns

**חובה להריץ**: ✅ כן! בלי זה לא ניתן לשלוט בשעות שליחת ההודעות

**מתי להריץ**: מיד אחרי pull של הקוד החדש

**מה זה מוסיף**:
- `active_hours_start` - שעת התחלה לשליחת הודעות (ברירת מחדל: 09:00)
- `active_hours_end` - שעת סיום לשליחת הודעות (ברירת מחדל: 18:00)
- `respect_active_hours` - האם לכבד את שעות הפעילות (ברירת מחדל: true)

**לבדוק שרץ**:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name IN ('active_hours_start', 'active_hours_end', 'respect_active_hours');
```

אמור להחזיר 3 שורות.

---

### תאריך: 14.01.2026
