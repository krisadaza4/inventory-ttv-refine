import { useEffect, useRef, useState } from 'react'
import { PAGE } from '../lib/menu.js'
import { filterByCategory, listCategories, searchProducts } from '../lib/stockRules.js'
import BulkCategoryBar from './BulkCategoryBar.jsx'
import PageHead from './PageHead.jsx'
import ProductForm from './ProductForm.jsx'
import ProductImport from './ProductImport.jsx'
import ProductThumb from './ProductThumb.jsx'
import ReorderPlanner from './ReorderPlanner.jsx'
import StockSheetImport from './StockSheetImport.jsx'

// หน้าจัดการสินค้า (admin): ซ้ายตารางสินค้า ขวาฟอร์มเพิ่ม/แก้ไข (design.md ข้อ 7)
// allProducts รวมสินค้าที่ปิดใช้งานแล้ว
export default function ManagePage({ allProducts, imageUrls, loadState, loadError, onRetry, repository, onChanged }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  // null = เพิ่มใหม่
  const [editingId, setEditingId] = useState(null)
  // ใช้เป็น key ให้ฟอร์มเริ่มใหม่หลังบันทึกหรือกดเพิ่มใหม่
  const [formSeq, setFormSeq] = useState(0)
  const [notice, setNotice] = useState(null)
  // null | 'express' (รายการจาก Express) | 'stock' (ไฟล์สต็อก รูป + ยอด) | 'reorder' (ตั้งจุดสั่งซื้อ)
  const [importing, setImporting] = useState(null)
  const formRef = useRef(null)
  // id สินค้าที่เลือกไว้ตั้งหมวดหมู่ทีละหลายรายการ
  const [selected, setSelected] = useState(() => new Set())

  // มือถือ: ฟอร์มอยู่ใต้รายการสินค้า กดแก้ไข/เพิ่มใหม่แล้วเลื่อนลงไปที่ฟอร์มให้เห็นทันที
  useEffect(() => {
    if (formSeq === 0 || !window.matchMedia('(max-width: 760px)').matches) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [formSeq])

  const editing = allProducts.find((p) => p.id === editingId) ?? null
  const visible = filterByCategory(
    searchProducts(
      allProducts.filter((p) => showInactive || p.active),
      query,
    ),
    category,
  ).toSorted((a, b) => a.sku.localeCompare(b.sku, 'th'))

  const startNew = () => {
    setEditingId(null)
    setFormSeq((n) => n + 1)
    setNotice(null)
  }

  const startEdit = (id) => {
    setEditingId(id)
    setFormSeq((n) => n + 1)
    setNotice(null)
  }

  const toggleSelected = (id) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id))
  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current)
      for (const p of visible) {
        if (allVisibleSelected) next.delete(p.id)
        else next.add(p.id)
      }
      return next
    })

  // แก้ทีละหลายรายการเสร็จ: ฟอร์มที่เปิดค้างอาจมีค่าเก่า จึงกลับเป็นฟอร์มเพิ่มใหม่ (ไม่เลื่อนจอ) แล้วโหลดใหม่
  // message = null คือบันทึกได้บางส่วน (ข้อความผิดพลาดแสดงในแถบนั้นเอง)
  const handleBulkSaved = (message) => {
    if (message) setNotice(message)
    setEditingId(null)
    onChanged()
  }

  // ไม่เริ่มฟอร์มใหม่ที่นี่: สินค้ายังเป็นค่าเก่าจนกว่าโหลดใหม่เสร็จ ฟอร์มจะแสดงค่าเก่าแล้วบันทึกทับได้
  // ฟอร์มแก้ไขคงค่าที่เพิ่งบันทึกไว้ ส่วนสินค้าใหม่ key เปลี่ยนเองเมื่อสินค้าโผล่ในรายการ
  const handleSaved = (id, message) => {
    setNotice(message)
    setEditingId(id)
    onChanged()
  }

  return (
    <>
      <PageHead
        page={PAGE.MANAGE}
        actions={
          <div className="head-actions">
            <button type="button" className="btn btn-stock" onClick={() => setImporting('stock')} disabled={importing !== null}>
              นำเข้าไฟล์สต็อก
            </button>
            <button type="button" className="btn btn-express" onClick={() => setImporting('express')} disabled={importing !== null}>
              นำเข้าจาก Express
            </button>
            <button type="button" className="btn btn-reorder" onClick={() => setImporting('reorder')} disabled={importing !== null}>
              ตั้งจุดสั่งซื้อ
            </button>
            <button type="button" className="btn primary" onClick={startNew}>
              + เพิ่มสินค้าใหม่
            </button>
          </div>
        }
      />

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {importing === 'stock' && (
        <StockSheetImport
          allProducts={allProducts}
          repository={repository}
          onImported={(message) => {
            if (message) {
              setNotice(message)
              setImporting(null)
            }
            onChanged()
          }}
          onClose={() => setImporting(null)}
        />
      )}

      {importing === 'reorder' && (
        <ReorderPlanner
          allProducts={allProducts}
          repository={repository}
          onSaved={(message) => {
            handleBulkSaved(message)
            if (message) setImporting(null)
          }}
          onClose={() => setImporting(null)}
        />
      )}

      {importing === 'express' && (
        <ProductImport
          allProducts={allProducts}
          repository={repository}
          onImported={(message) => {
            if (message) {
              setNotice(message)
              setImporting(null)
            }
            onChanged()
          }}
          onClose={() => setImporting(null)}
        />
      )}

      <div className="split">
        <div className="panel">
          <div className="toolbar">
            <input
              type="search"
              className="grow"
              placeholder="ค้นหาสินค้า"
              aria-label="ค้นหาสินค้า"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select aria-label="กรองหมวดหมู่" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">ทุกหมวดหมู่</option>
              {listCategories(allProducts).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />{' '}
              แสดงที่ปิดใช้งาน
            </label>
          </div>

          {selected.size > 0 && (
            <BulkCategoryBar
              ids={[...selected]}
              categories={listCategories(allProducts)}
              repository={repository}
              onSaved={(message) => {
                handleBulkSaved(message)
                if (message) setSelected(new Set())
              }}
              onClear={() => setSelected(new Set())}
            />
          )}

          {loadState === 'loading' && (
            <p className="empty" role="status">
              กำลังโหลดรายการสินค้า…
            </p>
          )}
          {loadState === 'error' && (
            <div className="empty">
              <p className="alert" role="alert">
                โหลดรายการสินค้าไม่สำเร็จ: {loadError}
              </p>
              <button type="button" className="btn primary" onClick={onRetry}>
                ลองใหม่
              </button>
            </div>
          )}
          {loadState === 'ready' && visible.length === 0 && (
            <p className="empty dim">{allProducts.length === 0 ? 'ยังไม่มีสินค้า เพิ่มสินค้าแรกจากฟอร์มด้านขวา' : 'ไม่พบสินค้า'}</p>
          )}
          {loadState === 'ready' && visible.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="pick-col">
                      <input
                        type="checkbox"
                        aria-label="เลือกทั้งหมดที่แสดง"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                      />
                    </th>
                    <th className="thumb-col">รูป</th>
                    <th>รหัส</th>
                    <th>ชื่อสินค้า</th>
                    <th className="hide-sm">หมวดหมู่</th>
                    <th>สถานะ</th>
                    <th>
                      <span className="sr-only">แก้ไข</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id} className={p.id === editingId ? 'selected' : undefined}>
                      <td className="pick-col">
                        <input
                          type="checkbox"
                          aria-label={`เลือก ${p.sku}`}
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                        />
                      </td>
                      <td className="thumb-col">
                        <ProductThumb url={imageUrls[p.imagePath]} name={p.name} size="row" />
                      </td>
                      <td className="mono">{p.sku}</td>
                      <td className={p.active ? undefined : 'dim'}>{p.name}</td>
                      <td className="hide-sm dim">{p.category}</td>
                      <td>
                        <span className={p.active ? 'badge ok' : 'badge off'}>{p.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>
                      </td>
                      <td className="num">
                        <button type="button" className="btn sm btn-edit" onClick={() => startEdit(p.id)}>
                          <span aria-hidden="true">✎</span> แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div ref={formRef} className="form-anchor">
          <ProductForm
            key={`${editing?.id ?? 'new'}-${formSeq}`}
            product={editing}
            imageUrl={editing ? imageUrls[editing.imagePath] : null}
            categories={listCategories(allProducts)}
            repository={repository}
            onSaved={handleSaved}
            onCancel={startNew}
          />
        </div>
      </div>
    </>
  )
}
