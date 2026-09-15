import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
};

/**
 * A table of normalized entities.
 *
 * Every row is keyed by the platform Global ID, which is the only stable
 * identity a record has: upstream ids can be reused across systems and names
 * change.
 */
export function EntityTable<T extends { id: string }>({
  caption,
  columns,
  items,
  detailPath,
}: {
  /** Describes the table for screen readers, which announce it on entry. */
  caption: string;
  columns: Column<T>[];
  items: T[];
  /** When given, the first column links to the record's detail page. */
  detailPath?: (item: T) => string;
}) {
  return (
    <table className="entity-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            {columns.map((column, index) => (
              <td key={column.key}>
                {index === 0 && detailPath ? (
                  <Link to={detailPath(item)}>{column.render(item)}</Link>
                ) : (
                  column.render(item)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
