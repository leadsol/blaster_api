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

### תאריך: 14.01.2026
