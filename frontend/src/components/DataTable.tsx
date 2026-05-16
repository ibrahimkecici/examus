export default function DataTable({
  columns,
  rows,
  emptyText = 'Kayıt bulunamadı.',
  onEdit,
  onDelete,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}) {
  const hasActions = onEdit || onDelete;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
              {hasActions && <th className="px-4 py-3 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-100 dark:border-slate-800">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-top">
                      {cell}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3 align-top">
                      <div className="flex gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(rowIndex)}
                            className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                          >
                            Düzenle
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(rowIndex)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={columns.length + (hasActions ? 1 : 0)}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
