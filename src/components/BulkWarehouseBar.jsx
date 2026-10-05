import { useState } from 'react'

// แถบ แสดง/ไม่แสดง สินค้าที่เลือกไว้ในคลังย่อย (admin) แสดงคู่กับแถบตั้งหมวดหมู่ ไม่แตะจำนวน (จำนวนใช้โอนเข้า)
// ไม่แสดงไม่แตะยอด: สินค้าที่ยังมีของค้างในคลังนั้นยังแสดงอยู่จนกว่าจะโอนกลับคลังใหญ่
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
        setError(`บันทึกได้ ${saved} จาก ${ids.length} รายการ: ${saveError}`)
        if (saved > 0) onSaved(null)
        return
      }
      onSaved(`ให้ ${ids.length} รายการแสดงในคลัง "${warehouse.name}" แล้ว (ใส่จำนวนด้วยปุ่มโอนเข้าในหน้าคลังนั้น)`)
      return
    }
    const { removed, error: removeError } = await repository.removeProductsFromWarehouse(ids, warehouse.id)
    setSaving(false)
    if (removeError) {
      setError(`บันทึกได้ ${removed} รายการ: ${removeError}`)
      if (removed > 0) onSaved(null)
      return
    }
    onSaved(`ไม่แสดง ${removed} รายการในคลัง "${warehouse.name}" แล้ว`)
  }

  return (
    <div className="bulk-bar">
      <b>แสดงในคลังย่อย</b>
      <select aria-label="คลังย่อย" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={saving}>
        <option value="">เลือกคลัง…</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn primary" onClick={() => run('add')} disabled={saving}>
        {saving ? 'กำลังบันทึก…' : 'แสดงในคลัง'}
      </button>
      <button type="button" className="btn" onClick={() => run('remove')} disabled={saving}>
        ไม่แสดงในคลัง
      </button>
      {error && (
        <p className="alert bulk-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
