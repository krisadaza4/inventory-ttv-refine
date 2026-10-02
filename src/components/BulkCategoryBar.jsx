import { useState } from 'react'

// ตัวเลือกที่เปิดช่องพิมพ์หมวดหมู่ใหม่
const NEW_CATEGORY = '__new__'

// แถบตั้งหมวดหมู่ให้สินค้าที่เลือกไว้ (admin) แสดงเมื่อเลือกอย่างน้อย 1 รายการ
export default function BulkCategoryBar({ ids, categories, repository, onSaved, onClear }) {
  const [choice, setChoice] = useState('')
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const category = (choice === NEW_CATEGORY ? typed : choice).trim()

  const handleSave = async () => {
    if (!category) {
      setError('กรุณาเลือกหรือพิมพ์หมวดหมู่')
      return
    }
    setError(null)
    setSaving(true)
    const { updated, error: saveError } = await repository.setProductsCategory(ids, category)
    setSaving(false)
    if (saveError) {
      setError(`บันทึกได้ ${updated} จาก ${ids.length} รายการ: ${saveError}`)
      if (updated > 0) onSaved(null)
      return
    }
    onSaved(`ตั้งหมวดหมู่ "${category}" ให้ ${updated} รายการแล้ว`)
  }

  return (
    <div className="bulk-bar">
      <b>เลือก {ids.length} รายการ</b>
      <select aria-label="หมวดหมู่ที่จะตั้ง" value={choice} onChange={(e) => setChoice(e.target.value)} disabled={saving}>
        <option value="">เลือกหมวดหมู่…</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ เพิ่มหมวดหมู่ใหม่…</option>
      </select>
      {choice === NEW_CATEGORY && (
        <input
          aria-label="หมวดหมู่ใหม่"
          placeholder="พิมพ์หมวดหมู่ใหม่"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={saving}
        />
      )}
      <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
        {saving ? 'กำลังบันทึก…' : 'ตั้งหมวดหมู่'}
      </button>
      <button type="button" className="btn btn-cancel" onClick={onClear} disabled={saving}>
        ยกเลิกที่เลือก
      </button>
      {error && (
        <p className="alert bulk-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
