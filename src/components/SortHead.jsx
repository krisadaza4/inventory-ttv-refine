// หัวคอลัมน์ที่กดเรียงได้ sort = { key, dir: 'asc' | 'desc' }
export default function SortHead({ sortKey, sort, onSort, children, className, title }) {
  const active = sort.key === sortKey
  return (
    <th
      className={className}
      title={title}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button type="button" className="sort-head" onClick={() => onSort(sortKey)}>
        {children}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  )
}
