import { requireCapability } from '@/lib/guard';
import { readAudit } from '@/lib/audit';
import { PageHeader, EmptyState, Table, th, td, tr, Chip } from '@/components/admin/kit';

export const metadata = { title: 'Audit log' };

export default async function AuditPage() {
  await requireCapability('audit.read');
  const entries = await readAudit(300);
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="The last 300 changes made in the studio. Times are UTC." />
      {entries.length === 0 ? (
        <EmptyState title="No entries yet">Every save, publish and status change will be recorded here.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>When (UTC)</th>
              <th className={th}>Who</th>
              <th className={th}>Action</th>
              <th className={th}>Target</th>
              <th className={th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.ts}-${i}`} className={tr}>
                <td className={`${td} whitespace-nowrap tabular-nums text-muted`}>{e.ts.slice(0, 19).replace('T', ' ')}</td>
                <td className={td}>{e.actor}</td>
                <td className={td}><Chip>{e.action}</Chip></td>
                <td className={`${td} font-mono text-xs`}>{e.target}</td>
                <td className={`${td} text-xs text-muted`}>{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
