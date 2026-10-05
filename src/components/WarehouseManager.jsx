import { useState } from 'react'
import { nextSortOrder, validateWarehouseName } from '../lib/warehouses.js'

// แถวคลังเดิม: แก้ชื่อ / ปิด-เปิดใช้งาน (ไม่มีการลบคลัง ประวัติยังอ้างถึงอยู่)
function WarehouseRow({ warehouse, warehouses, productCount, repository, onSaved }) {
  const [name, setName] = useState(warehouse.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (changes, message) => {
    setError(null)
    setSaving(true)
    const { error: saveError } = await repository.saveWarehouse({ ...warehouse, ...changes })
    setSaving(false)
    if (saveError) setError(saveError)
    else onSaved(message)
  }

  const rename = () => {
    const problem = validateWarehouseName(name, warehouses, warehouse.id)
    if (problem) {
      setError(problem)
      return
    }
    save({ name: name.trim() }, `เปลี่ยนชื่อคลังเป็น "${name.trim()}" แล้ว`)
  }

  const changed = name.trim() !== warehouse.name
  return (
    <li className="wh-row">
      <input
        aria-label={`ชื่อคลัง ${warehouse.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={saving}
        className={warehouse.active ? undefined : 'dim'}
      />
      <span className="dim">{productCount} รายการ</span>
      {changed && (
        <button type="button" className="btn sm primary" onClick={rename} disabled={saving}>
          บันทึกชื่อ
        </button>
      )}
      <button
        type="button"
        className={warehouse.active ? 'btn sm btn-cancel' : 'btn sm'}
        onClick={() =>
          save(
            { active: !warehouse.active },
            warehouse.active ? `ปิดใช้งานคลัง "${warehouse.name}" แล้ว` : `เปิดใช้งานคลัง "${warehouse.name}" แล้ว`,
          )
        }
        disabled={saving}
        title={warehouse.active ? 'ซ่อนจากเมนู ของที่เหลือยังโอนกลับคลังใหญ่ได้' : undefined}
      >
        {warehouse.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
      </button>
      {error && (
        <p className="alert bulk-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

// จัดการคลังย่อย (admin): เพิ่ม, เปลี่ยนชื่อ, ปิด-เปิดใช้งาน
// allProducts ใช้นับจำนวนสินค้าในแต่ละคลัง
export default function WarehouseManager({ warehouses, allProducts, repository, onSaved, onClose }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const add = async (e) => {
    e.preventDefault()
    const problem = validateWarehouseName(newName, warehouses)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setAdding(true)
    const { error: saveError } = await repository.saveWarehouse({
      name: newName.trim(),
      sortOrder: nextSortOrder(warehouses),
      active: true,
    })
    setAdding(false)
    if (saveError) {
      setError(saveError)
      return
    }
    onSaved(`เพิ่มคลัง "${newName.trim()}" แล้ว`)
    setNewName('')
  }

  const countIn = (id) => allProducts.filter((p) => p.warehouseIds?.includes(id)).length

  return (
    <div className="panel wh-manager">
      <div className="panel-head spread">
        <span>คลังย่อย</span>
        <button type="button" className="btn sm" onClick={onClose}>
          ปิด
        </button>
      </div>
      <div className="panel-body">
        <p className="hint">
          คลังใหญ่ (สินค้าคงคลัง) มีสินค้าทุกรายการ คลังย่อยแสดงเฉพาะสินค้าที่เพิ่มเข้าคลัง (ติ๊กเลือกในตารางด้านล่าง) หรือที่โอนเข้าไป
        </p>
        <ul className="wh-list">
          {warehouses.map((w) => (
            <WarehouseRow
              key={`${w.id}-${w.name}-${w.active}`}
              warehouse={w}
              warehouses={warehouses}
              productCount={countIn(w.id)}
              repository={repository}
              onSaved={onSaved}
            />
          ))}
        </ul>
        <form className="wh-add" onSubmit={add}>
          <input
            aria-label="ชื่อคลังใหม่"
            placeholder="ชื่อคลังใหม่ เช่น หน้าร้าน"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={adding}
          />
          <button type="submit" className="btn primary" disabled={adding}>
            {adding ? 'กำลังเพิ่ม…' : '+ เพิ่มคลัง'}
          </button>
        </form>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
