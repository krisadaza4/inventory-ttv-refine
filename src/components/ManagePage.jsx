import { useState } from 'react'
import { PAGE } from '../lib/menu.js'
import { listCategories, searchProducts } from '../lib/stockRules.js'
import PageHead from './PageHead.jsx'
import ProductForm from './ProductForm.jsx'
import ProductImport from './ProductImport.jsx'

// หน้าจัดการสินค้า (admin): ซ้ายตารางสินค้า ขวาฟอร์มเพิ่ม/แก้ไข (design.md ข้อ 7)
// allProducts รวมสินค้าที่ปิดใช้งานแล้ว
export default function ManagePage({ allProducts, loadState, loadError, onRetry, repository, onChanged }) {
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  // null = เพิ่มใหม่
  const [editingId, setEditingId] = useState(null)
  // ใช้เป็น key ให้ฟอร์มเริ่มใหม่หลังบันทึกหรือกดเพิ่มใหม่
  const [formSeq, setFormSeq] = useState(0)
  const [notice, setNotice] = useState(null)
  const [importing, setImporting] = useState(false)

  const editing = allProducts.find((p) => p.id === editingId) ?? null
  const visible = searchProducts(
    allProducts.filter((p) => showInactive || p.active),
    query,
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
            <button type="button" className="btn" onClick={() => setImporting(true)} disabled={importing}>
              นำเข้าจาก Excel
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

      {importing && (
        <ProductImport
          allProducts={allProducts}
          repository={repository}
          onImported={(message) => {
            if (message) {
              setNotice(message)
              setImporting(false)
            }
            onChanged()
          }}
          onClose={() => setImporting(false)}
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
            <label className="check">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />{' '}
              แสดงที่ปิดใช้งาน
            </label>
          </div>

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
                      <td className="mono">{p.sku}</td>
                      <td className={p.active ? undefined : 'dim'}>{p.name}</td>
                      <td className="hide-sm dim">{p.category}</td>
                      <td>
                        <span className={p.active ? 'badge ok' : 'badge off'}>{p.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>
                      </td>
                      <td className="num">
                        <button type="button" className="btn sm" onClick={() => startEdit(p.id)}>
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ProductForm
          key={`${editing?.id ?? 'new'}-${formSeq}`}
          product={editing}
          categories={listCategories(allProducts)}
          repository={repository}
          onSaved={handleSaved}
          onCancel={startNew}
        />
      </div>
    </>
  )
}
