import { STATUS, STATUS_LABEL } from '../lib/loanRules.js'
import { TAB } from '../lib/tabs.js'

const CARDS = [
  { status: STATUS.OVERDUE, icon: '⏰', tab: TAB.ACTIVE },
  { status: STATUS.OUTSTANDING, icon: '📦', tab: TAB.ACTIVE },
  { status: STATUS.RETURNED, icon: '✅', tab: TAB.RETURNED },
]

// การ์ดสรุปจำนวน Loan ตามสถานะ กดแล้วไป Tab ที่ตรงกัน
export default function SummaryCards({ counts, onSelect }) {
  return (
    <div className="summary-cards">
      {CARDS.map(({ status, icon, tab }) => (
        <button
          key={status}
          type="button"
          className={`summary-card summary-${status}`}
          onClick={() => onSelect(tab)}
        >
          <span className="summary-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="summary-count">{counts[status]}</span>
          <span className="summary-label">{STATUS_LABEL[status]}</span>
        </button>
      ))}
    </div>
  )
}
