import { useState } from 'react'

// แถบเพิ่ม/เอาสินค้าที่เลือกไว้ออกจากคลังย่อย (admin) แสดงคู่กับแถบตั้งหมวดหมู่
// เอาออกไม่แตะยอด: สินค้าที่ยังมีของค้างในคลังนั้นยังแสดงอยู่จนกว่าจะโอนกลับคลังใหญ่
export default function BulkWarehouseBar({ ids, warehouses, repository, onSaved }) {
  const [warehouseId, setWarehouseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const warehouse = warehouses.find((w) => w.id === warehouseId)

  const run = async (action) => {
    if (!warehouse) {
      setError('กรุณาเลือกคลังย่อย')
      return
    }
    setError(null)
    setSaving(true)
    if (action === 'add') {
      const { saved, error: saveError } = await repository.addProductsToWarehouse(ids, warehouse.id)
      setSaving(false)
      if (saveError) {
        setError(`เพิ่มได้ ${saved} จาก ${ids.length} รายการ: ${saveError}`)
        if (saved > 0) onSaved(null)
        return
      }
      onSaved(`เพิ่ม ${ids.length} รายการเข้าคลัง "${warehouse.name}" แล้ว`)
      return
    }
    const { removed, error: removeError } = await repository.removeProductsFromWarehouse(ids, warehouse.id)
    setSaving(false)
    if (removeError) {
      setError(`เอาออกได้ ${removed} รายการ: ${removeError}`)
      if (removed > 0) onSaved(null)
      return
    }
    onSaved(`เอา ${removed} รายการออกจากคลัง "${warehouse.name}" แล้ว`)
  }

  return (
    <div className="bulk-bar">
      <b>คลังย่อย</b>
      <select aria-label="คลังย่อย" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={saving}>
        <option value="">เลือกคลัง…</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn primary" onClick={() => run('add')} disabled={saving}>
        {saving ? 'กำลังบันทึก…' : 'เพิ่มเข้าคลัง'}
      </button>
      <button type="button" className="btn" onClick={() => run('remove')} disabled={saving}>
        เอาออกจากคลัง
      </button>
      {error && (
        <p className="alert bulk-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
