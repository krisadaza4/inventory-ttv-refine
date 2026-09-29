import { getPageInfo } from '../lib/menu.js'

// หัวหน้า: breadcrumb (กลุ่ม / หน้า) + ชื่อหน้า และปุ่มด้านขวา (ถ้ามี)
export default function PageHead({ page, title, actions }) {
  const info = getPageInfo(page)
  return (
    <div className="page-head">
      <div>
        <div className="crumb">
          {info.group} / {info.label}
        </div>
        <h1>{title ?? info.label}</h1>
      </div>
      {actions}
    </div>
  )
}
