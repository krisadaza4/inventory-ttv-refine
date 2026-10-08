import { useCallback, useEffect, useState } from 'react'
import { ACTIVE_VIEW, countByActive, filterByActive, readActiveView, saveActiveView } from '../lib/activeView.js'
import { backupReminder, readLastBackup, saveLastBackup } from '../lib/backupReminder.js'
import { toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { filterByCategory, listCategories, searchProducts } from '../lib/stockRules.js'
import BackupButton from './BackupButton.jsx'
import BulkCategoryBar from './BulkCategoryBar.jsx'
import BulkWarehouseBar from './BulkWarehouseBar.jsx'
import PageHead from './PageHead.jsx'
import ProductDialog from './ProductDialog.jsx'
import ProductForm from './ProductForm.jsx'
import ProductImport from './ProductImport.jsx'
import ProductThumb from './ProductThumb.jsx'
import ReorderPlanner from './ReorderPlanner.jsx'
import StockSheetImport from './StockSheetImport.jsx'
import WarehouseManager from './WarehouseManager.jsx'

// ตัวกรองคลัง: สินค้าที่ยังไม่อยู่คลังย่อยไหนเลย
const NO_WAREHOUSE = '__none__'

const ACTIVE_TABS = [
  { view: ACTIVE_VIEW.ACTIVE, label: 'ใช้งาน' },
  { view: ACTIVE_VIEW.INACTIVE, label: 'ปิดใช้งาน' },
  { view: ACTIVE_VIEW.ALL, label: 'ทั้งหมด' },
]
const tabLabel = Object.fromEntries(ACTIVE_TABS.map((t) => [t.view, t.label]))

// หน้าจัดการสินค้า (admin): ตารางสินค้าเต็มความกว้าง ฟอร์มเพิ่ม/แก้ไขเปิดเป็นหน้าต่างกลางจอ
// allProducts รวมสินค้าที่ปิดใช้งานแล้ว warehouses = คลังย่อยทั้งหมด รวมที่ปิดใช้งาน
export default function ManagePage({
  allProducts,
  warehouses = [],
  imageUrls,
  loadState,
  loadError,
  onRetry,
  repository,
  onChanged,
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  // '' = ทุกคลัง, NO_WAREHOUSE = ยังไม่อยู่คลังย่อย, id = อยู่ในคลังนั้น
  const [warehouseFilter, setWarehouseFilter] = useState('')
  // แท็บ ใช้งาน / ปิดใช้งาน / ทั้งหมด จำค่าล่าสุดของเครื่องนี้
  const [activeView, setActiveView] = useState(() => readActiveView())
  // id สินค้าที่กำลังเปิดใช้งานจากปุ่มในแถว
  const [activating, setActivating] = useState(null)
  const [bulkActivating, setBulkActivating] = useState(false)
  const [bulkActiveError, setBulkActiveError] = useState(null)
  // หน้าต่างฟอร์ม: null = ปิด, { mode: 'new' } หรือ { mode: 'edit', id }
  const [dialog, setDialog] = useState(null)
  // ใช้เป็น key ให้ฟอร์มเริ่มใหม่ทุกครั้งที่เปิดหรือเพิ่มรายการถัดไป
  const [formSeq, setFormSeq] = useState(0)
  const [formDirty, setFormDirty] = useState(false)
  // ข้อความในหน้าต่าง: { text, addedId } addedId = สินค้าที่เพิ่งเพิ่ม (ปุ่มเพิ่มรูปต่อ)
  const [dialogNotice, setDialogNotice] = useState(null)
  // แถวที่เพิ่งแก้: ไฮไลต์สั้น ๆ หลังปิดหน้าต่าง
  const [flashId, setFlashId] = useState(null)
  const [notice, setNotice] = useState(null)
  // null | 'express' (รายการจาก Express) | 'stock' (ไฟล์สต็อก รูป + ยอด) | 'reorder' (ตั้งจุดสั่งซื้อ) | 'warehouses' (คลังย่อย)
  const [importing, setImporting] = useState(null)
  // วันที่สำรองข้อมูลล่าสุดของเครื่องนี้ เกิน 7 วัน (หรือไม่เคย) แสดงแถบเตือน
  const [lastBackup, setLastBackup] = useState(() => readLastBackup())
  const reminder = backupReminder(lastBackup, toIsoDate(new Date()))
  // id สินค้าที่เลือกไว้ตั้งหมวดหมู่ทีละหลายรายการ
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => {
    if (!flashId) return undefined
    const timer = setTimeout(() => setFlashId(null), 2500)
    return () => clearTimeout(timer)
  }, [flashId])

  const editingId = dialog?.mode === 'edit' ? dialog.id : null
  const editing = allProducts.find((p) => p.id === editingId) ?? null
  // ตัวกรองอื่นก่อน แล้วนับแต่ละแท็บจากผลนั้น (ค้นหาแล้วเห็นทันทีว่าเจอในแท็บไหน)
  const matching = filterByCategory(searchProducts(allProducts, query), category).filter((p) => {
    if (!warehouseFilter) return true
    const ids = p.warehouseIds ?? []
    return warehouseFilter === NO_WAREHOUSE ? ids.length === 0 : ids.includes(warehouseFilter)
  })
  const tabCounts = countByActive(matching)
  const visible = filterByActive(matching, activeView).toSorted((a, b) => a.sku.localeCompare(b.sku, 'th'))
  // แท็บนี้ไม่พบ แต่อีกแท็บมี: ชี้ไปแท็บนั้น
  const otherView = activeView === ACTIVE_VIEW.ACTIVE ? ACTIVE_VIEW.INACTIVE : ACTIVE_VIEW.ACTIVE
  const foundElsewhere = activeView !== ACTIVE_VIEW.ALL && visible.length === 0 ? tabCounts[otherView] : 0
  const selectedInactive = allProducts.filter((p) => selected.has(p.id) && !p.active).map((p) => p.id)
  const selectedActive = allProducts.filter((p) => selected.has(p.id) && p.active)
  const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]))
  const activeOnes = warehouses.filter((w) => w.active)

  const openDialog = (next) => {
    setDialog(next)
    setFormSeq((n) => n + 1)
    setFormDirty(false)
    setDialogNotice(null)
    setNotice(null)
  }
  const startNew = () => openDialog({ mode: 'new' })
  const startEdit = (id) => openDialog({ mode: 'edit', id })

  // ✕ / Esc / คลิกนอกกล่อง / ยกเลิก: มีช่องที่แก้ค้างอยู่ถามก่อน
  const closeDialog = () => {
    if (formDirty && !window.confirm('ข้อมูลที่แก้ไขยังไม่ได้บันทึก ปิดหน้าต่างนี้หรือไม่?')) return
    setDialog(null)
    setFormDirty(false)
    setDialogNotice(null)
  }
  const handleDirtyChange = useCallback((dirty) => setFormDirty(dirty), [])

  const changeActiveView = (view) => {
    setActiveView(view)
    saveActiveView(view)
  }

  const activateOne = async (product) => {
    setActivating(product.id)
    const { error } = await repository.setProductActive(product.id, true)
    setActivating(null)
    setNotice(error ? `เปิดใช้งาน ${product.sku} ไม่สำเร็จ: ${error}` : `เปิดใช้งาน ${product.sku} แล้ว`)
    if (!error) onChanged()
  }

  // เปิด/ปิดใช้งานสินค้าที่เลือกไว้ทีเดียว ปิดใช้งานถามยืนยันก่อน (บอกจำนวนที่ยังมียอดคงเหลือ)
  const setSelectedActive = async (active) => {
    const ids = active ? selectedInactive : selectedActive.map((p) => p.id)
    const verb = active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
    if (!active) {
      const withStock = selectedActive.filter((p) => p.onHand > 0 || (p.repairQty ?? 0) > 0)
      const stockNote =
        withStock.length > 0
          ? `\n\nมี ${withStock.length} รายการที่ยังมียอดคงเหลือ (รวม ${formatQuantity(
              withStock.reduce((sum, p) => sum + p.onHand + (p.repairQty ?? 0), 0),
            )}) ยอดยังอยู่ในระบบตามเดิม`
          : ''
      const ok = window.confirm(
        `ปิดใช้งาน ${ids.length} รายการ?\nสินค้าจะไม่แสดงในหน้าสินค้าคงคลังและหน้ารับ/เบิก เปิดกลับได้ในแท็บ "ปิดใช้งาน"${stockNote}`,
      )
      if (!ok) return
    }
    setBulkActiveError(null)
    setBulkActivating(true)
    const { updated, error } = await repository.setProductsActive(ids, active)
    setBulkActivating(false)
    if (error) {
      setBulkActiveError(`${verb}ได้ ${updated} จาก ${ids.length} รายการ: ${error}`)
      if (updated > 0) onChanged()
      return
    }
    setSelected(new Set())
    handleBulkSaved(`${verb} ${updated} รายการแล้ว`)
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
    onChanged()
  }

  // เปลี่ยน/ลบรูป (stay): แก้ต่อในหน้าต่างเดิม
  // เพิ่มใหม่: ฟอร์มว่างสำหรับรายการถัดไป พร้อมปุ่มเพิ่มรูปให้รายการที่เพิ่งเพิ่ม
  // แก้ไข/เปิด-ปิดใช้งาน: ปิดหน้าต่าง แล้วไฮไลต์แถวนั้น
  const handleSaved = (id, message, { stay = false } = {}) => {
    if (stay) {
      setDialogNotice({ text: message })
    } else if (dialog?.mode === 'new') {
      setDialogNotice({ text: message, addedId: id })
      setFormSeq((n) => n + 1)
      setFormDirty(false)
    } else {
      setDialog(null)
      setFormDirty(false)
      setDialogNotice(null)
      setNotice(message)
      setFlashId(id)
    }
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
            <button type="button" className="btn btn-warehouse" onClick={() => setImporting('warehouses')} disabled={importing !== null}>
              คลังย่อย
            </button>
            <BackupButton
              repository={repository}
              onBackedUp={(date) => {
                saveLastBackup(date)
                setLastBackup(date)
              }}
            />
            <button type="button" className="btn primary" onClick={startNew}>
              + เพิ่มสินค้าใหม่
            </button>
          </div>
        }
      />

      {reminder && (
        <p className="notice backup-reminder" role="status">
          {reminder}
        </p>
      )}

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

      {importing === 'warehouses' && (
        <WarehouseManager
          warehouses={warehouses}
          allProducts={allProducts}
          repository={repository}
          onSaved={(message) => {
            setNotice(message)
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

      <div className="manage-list">
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
            {warehouses.length > 0 && (
              <select aria-label="กรองคลังย่อย" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="">ทุกคลัง</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    อยู่ในคลัง {w.name}
                    {w.active ? '' : ' (ปิดใช้งาน)'}
                  </option>
                ))}
                <option value={NO_WAREHOUSE}>ยังไม่อยู่คลังย่อย</option>
              </select>
            )}
            <div className="view-tabs toolbar-tabs" role="group" aria-label="สถานะการใช้งาน">
              {ACTIVE_TABS.map((t) => (
                <button
                  key={t.view}
                  type="button"
                  className="btn sm"
                  aria-pressed={activeView === t.view}
                  onClick={() => changeActiveView(t.view)}
                >
                  {t.label} <span className="tab-count">{tabCounts[t.view]}</span>
                </button>
              ))}
            </div>
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
          {selected.size > 0 && (
            <div className="bulk-bar">
              <b>การใช้งาน</b>
              {selectedInactive.length > 0 && (
                <button
                  type="button"
                  className="btn btn-activate"
                  onClick={() => setSelectedActive(true)}
                  disabled={bulkActivating}
                >
                  เปิดใช้งาน {selectedInactive.length} รายการ
                </button>
              )}
              {selectedActive.length > 0 && (
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => setSelectedActive(false)}
                  disabled={bulkActivating}
                >
                  ปิดใช้งาน {selectedActive.length} รายการ
                </button>
              )}
              {bulkActivating && <span className="dim">กำลังบันทึก…</span>}
              {bulkActiveError && (
                <p className="alert bulk-error" role="alert">
                  {bulkActiveError}
                </p>
              )}
            </div>
          )}
          {selected.size > 0 && activeOnes.length > 0 && (
            <BulkWarehouseBar
              ids={[...selected]}
              warehouses={activeOnes}
              repository={repository}
              onSaved={(message) => {
                handleBulkSaved(message)
                if (message) setSelected(new Set())
              }}
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
          {loadState === 'ready' && allProducts.length === 0 && (
            <div className="empty">
              <p className="dim">ยังไม่มีสินค้า</p>
              <button type="button" className="btn primary" onClick={startNew}>
                + เพิ่มสินค้าแรก
              </button>
            </div>
          )}
          {loadState === 'ready' && allProducts.length > 0 && visible.length === 0 && foundElsewhere === 0 && (
            <p className="empty dim">
              {activeView === ACTIVE_VIEW.INACTIVE && !query && !category && !warehouseFilter
                ? 'ไม่มีสินค้าที่ปิดใช้งาน'
                : 'ไม่พบสินค้า'}
            </p>
          )}
          {loadState === 'ready' && foundElsewhere > 0 && (
            <div className="empty found-elsewhere" role="status">
              <p className="dim">
                ไม่พบในแท็บ "{tabLabel[activeView]}" · พบ {foundElsewhere} รายการในแท็บ "{tabLabel[otherView]}"
              </p>
              <button type="button" className="btn sm" onClick={() => changeActiveView(otherView)}>
                แสดง
              </button>
            </div>
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
                    <th className="hide-sm">คลังย่อย</th>
                    <th>สถานะ</th>
                    <th>
                      <span className="sr-only">แก้ไข</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        [p.id === editingId && 'selected', p.id === flashId && 'flash', !p.active && 'row-off']
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    >
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
                      <td className="hide-sm">
                        {(p.warehouseIds ?? []).length === 0 ? (
                          <span className="dim">–</span>
                        ) : (
                          <span className="wh-chips">
                            {p.warehouseIds.map((id) => (
                              <span key={id} className="badge wh-chip">
                                {warehouseName.get(id) ?? 'คลัง'}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={p.active ? 'badge ok' : 'badge off'}>{p.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>
                      </td>
                      <td className="num row-actions">
                        {!p.active && (
                          <button
                            type="button"
                            className="btn sm btn-activate"
                            onClick={() => activateOne(p)}
                            disabled={activating === p.id}
                          >
                            {activating === p.id ? 'กำลังเปิด…' : 'เปิดใช้งาน'}
                          </button>
                        )}
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

      </div>

      <ProductDialog
        open={dialog !== null}
        label={dialog?.mode === 'edit' ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
        onRequestClose={closeDialog}
      >
        {dialog?.mode === 'edit' && !editing ? (
          <div className="panel">
            <p className="empty dim" role="status">
              กำลังโหลดข้อมูลสินค้า…
            </p>
          </div>
        ) : (
          <ProductForm
            key={`${editing?.id ?? 'new'}-${formSeq}`}
            product={editing}
            imageUrl={editing ? imageUrls[editing.imagePath] : null}
            categories={listCategories(allProducts)}
            warehouses={activeOnes}
            repository={repository}
            onSaved={handleSaved}
            onCancel={closeDialog}
            onDirtyChange={handleDirtyChange}
            notice={
              dialogNotice && (
                <>
                  ✓ {dialogNotice.text}
                  {dialogNotice.addedId && (
                    <>
                      {' '}
                      · กรอกรายการถัดไปได้เลย{' '}
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => openDialog({ mode: 'edit', id: dialogNotice.addedId })}
                      >
                        เพิ่มรูปให้สินค้านี้
                      </button>
                    </>
                  )}
                </>
              )
            }
          />
        )}
      </ProductDialog>
    </>
  )
}
