import { useState } from "react";
import { formatQuantity } from "../lib/numberFormat.js";
import { checkImageFile, resizeImage } from "../lib/productImages.js";
import { validateProduct } from "../lib/stockRules.js";
import ProductThumb from "./ProductThumb.jsx";

const EMPTY = {
  sku: "",
  barcode: "",
  name: "",
  category: "",
  unit: "",
  location: "",
  reorderPoint: "0",
};

const FIELDS = [
  {
    key: "sku",
    label: "รหัสสินค้า",
    required: true,
    placeholder: "เช่น DR-001",
    className: "mono",
  },
  {
    key: "barcode",
    label: "บาร์โค้ด",
    hint: "ไม่บังคับ พิมพ์หรือยิงเครื่องสแกน",
    className: "mono",
  },
  { key: "name", label: "ชื่อสินค้า", required: true },
  {
    key: "category",
    label: "หมวดหมู่",
    required: true,
    placeholder: "เช่น เครื่องดื่ม",
  },
  {
    key: "unit",
    label: "หน่วย",
    required: true,
    placeholder: "เช่น ชิ้น, กล่อง, กก.",
  },
  {
    key: "location",
    label: "โลเคชั่น",
    hint: "ไม่บังคับ ที่เก็บสินค้าในร้าน",
    placeholder: "เช่น แลค A4",
  },
  {
    key: "reorderPoint",
    label: "จุดสั่งซื้อ",
    hint: "คงเหลือเท่านี้หรือน้อยกว่า = ใกล้หมด",
    inputMode: "decimal",
  },
];

const toFields = (product) =>
  product
    ? {
        sku: product.sku,
        barcode: product.barcode ?? "",
        name: product.name,
        category: product.category,
        unit: product.unit,
        location: product.location ?? "",
        reorderPoint: String(product.reorderPoint),
      }
    : EMPTY;

// ตัวเลือกในช่องหมวดหมู่ที่เปิดช่องพิมพ์หมวดหมู่ใหม่
const NEW_CATEGORY = "__new__";

// ฟอร์มเพิ่ม/แก้ไขสินค้า product = null คือเพิ่มใหม่ (App ใส่ key ตามสินค้า ฟอร์มจึงเริ่มใหม่ทุกครั้งที่เปลี่ยน)
export default function ProductForm({
  product,
  imageUrl,
  categories,
  repository,
  onSaved,
  onCancel,
}) {
  const [fields, setFields] = useState(() => toFields(product));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  // หมวดหมู่: เลือกจากที่เคยบันทึกไว้ หรือพิมพ์หมวดหมู่ใหม่ (ยังไม่มีหมวดหมู่ใดเลย = พิมพ์เท่านั้น)
  const [typingCategory, setTypingCategory] = useState(categories.length === 0);

  const set = (key) => (e) =>
    setFields((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    const found = validateProduct(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const { id, error } = await repository.saveProduct({
      ...fields,
      id: product?.id,
    });
    setBusy(false);
    if (error) setServerError(error);
    else
      onSaved(
        id,
        product
          ? `บันทึกการแก้ไข ${fields.name.trim()} แล้ว`
          : `เพิ่มสินค้า ${fields.name.trim()} แล้ว`,
      );
  };

  // เลือกรูป/ถ่ายรูป: ย่อในเบราว์เซอร์ แล้วอัปโหลดแทนรูปเดิม
  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setServerError(null);
    const invalid = checkImageFile(file);
    if (invalid) {
      setServerError(invalid);
      return;
    }
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      const { error } = await repository.uploadProductImage(product, blob);
      if (error) setServerError(error);
      else
        onSaved(
          product.id,
          `${product.imagePath ? "เปลี่ยน" : "เพิ่ม"}รูป ${product.name} แล้ว`,
        );
    } catch (thrown) {
      setServerError(thrown.message);
    }
    setBusy(false);
  };

  const handleRemoveImage = async () => {
    setServerError(null);
    setBusy(true);
    const { error } = await repository.removeProductImage(product);
    setBusy(false);
    if (error) setServerError(error);
    else onSaved(product.id, `ลบรูป ${product.name} แล้ว`);
  };

  const handleToggleActive = async () => {
    setServerError(null);
    setBusy(true);
    const { error } = await repository.setProductActive(
      product.id,
      !product.active,
    );
    setBusy(false);
    if (error) setServerError(error);
    else
      onSaved(
        product.id,
        product.active
          ? `ปิดใช้งาน ${product.name} แล้ว`
          : `เปิดใช้งาน ${product.name} แล้ว`,
      );
  };

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel-head">
        {product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
        {product && <span className="mono dim">{product.sku}</span>}
      </div>
      {serverError && (
        <p className="alert form-alert" role="alert">
          บันทึกไม่สำเร็จ: {serverError}
        </p>
      )}

      <div className="panel-body form-grid compact">
        {FIELDS.map((f) => (
          <div key={f.key} className="form-row">
            <label
              className={f.required ? "req" : undefined}
              htmlFor={`product-${f.key}`}
            >
              {f.label}
            </label>
            <div>
              {f.key === "category" && categories.length > 0 && (
                <select
                  id={typingCategory ? undefined : "product-category"}
                  aria-label={typingCategory ? "เลือกหมวดหมู่" : undefined}
                  value={typingCategory ? NEW_CATEGORY : fields.category}
                  onChange={(e) => {
                    const typing = e.target.value === NEW_CATEGORY;
                    setTypingCategory(typing);
                    setFields((current) => ({
                      ...current,
                      category: typing ? "" : e.target.value,
                    }));
                  }}
                  aria-invalid={Boolean(errors.category)}
                >
                  {!typingCategory && !categories.includes(fields.category) && (
                    <option value={fields.category}>
                      {fields.category || "เลือกหมวดหมู่"}
                    </option>
                  )}
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>+ เพิ่มหมวดหมู่ใหม่…</option>
                </select>
              )}
              {(f.key !== "category" || typingCategory) && (
                <input
                  id={`product-${f.key}`}
                  className={
                    f.key === "category" && categories.length > 0
                      ? "category-new"
                      : f.className
                  }
                  placeholder={
                    f.key === "category"
                      ? "พิมพ์หมวดหมู่ใหม่ เช่น เครื่องดื่ม"
                      : f.placeholder
                  }
                  inputMode={f.inputMode}
                  value={fields[f.key]}
                  onChange={set(f.key)}
                  aria-invalid={Boolean(errors[f.key])}
                />
              )}
              {f.hint && <div className="hint">{f.hint}</div>}
              {errors[f.key] && <div className="err">{errors[f.key]}</div>}
            </div>
          </div>
        ))}

        <div className="form-row">
          <span className="label">รูปสินค้า</span>
          {product ? (
            <div className="image-field">
              <ProductThumb url={imageUrl} name={product.name} size="lg" />
              <div className="image-actions">
                <label className={busy ? "btn sm disabled" : "btn sm"}>
                  {product.imagePath ? "เปลี่ยนรูป" : "เลือกรูป"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImage}
                    disabled={busy}
                  />
                </label>
                <label className={busy ? "btn sm disabled" : "btn sm"}>
                  ถ่ายรูป
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handleImage}
                    disabled={busy}
                  />
                </label>
                {product.imagePath && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={handleRemoveImage}
                    disabled={busy}
                  >
                    ลบรูป
                  </button>
                )}
                <span className="hint">ย่อเหลือไม่เกิน 800px ให้อัตโนมัติ</span>
              </div>
            </div>
          ) : (
            <div className="plain hint">
              บันทึกสินค้าก่อน แล้วจึงเพิ่มรูปได้
            </div>
          )}
        </div>

        {product && (
          <div className="form-row">
            <span className="label">คงเหลือ</span>
            <div className="plain">
              {formatQuantity(product.onHand)} {product.unit}{" "}
              <span className="hint">(เปลี่ยนได้จากหน้ารับเข้า / เบิกออก)</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-actions">
        {product && (
          <button
            type="button"
            className="btn push-left"
            onClick={handleToggleActive}
            disabled={busy}
          >
            {product.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-cancel"
          onClick={onCancel}
          disabled={busy}
        >
          ยกเลิก
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
