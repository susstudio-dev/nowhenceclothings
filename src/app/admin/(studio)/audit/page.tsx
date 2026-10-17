import { requireCapability } from '@/lib/guard';
import { readAudit } from '@/lib/audit';

export const metadata = { title: 'Audit log' };

export default async function AuditPage() {
  await requireCapability('audit.read');
  const entries = await readAudit(300);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Audit log</h1>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No entries yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1">When (UTC)</th>
              <th>Who</th>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.ts}-${i}`} className="border-t border-line align-top">
                <td className="whitespace-nowrap py-1">{e.ts.slice(0, 19).replace('T', ' ')}</td>
                <td>{e.actor}</td>
                <td className="font-mono text-xs">{e.action}</td>
                <td className="font-mono text-xs">{e.target}</td>
                <td className="text-xs">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
