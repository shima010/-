import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rewardsApi, csvApi, downloadCsv } from '../../api/client';

export default function AdminRewards() {
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [closeError, setCloseError] = useState('');
  const [closeSuccess, setCloseSuccess] = useState('');

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['rewards', 'preview', yearMonth],
    queryFn: () => rewardsApi.preview(yearMonth),
    select: (r) => r.data,
  });

  const { data: confirmed } = useQuery({
    queryKey: ['rewards', 'results', yearMonth],
    queryFn: () => rewardsApi.getResults({ yearMonth }),
    select: (r) => r.data,
  });

  const closeMutation = useMutation({
    mutationFn: () => rewardsApi.close(yearMonth),
    onSuccess: () => {
      setCloseSuccess(`Month ${yearMonth} has been closed successfully!`);
      setCloseError('');
    },
    onError: (e: any) => {
      setCloseError(e.response?.data?.message || 'Failed to close month');
      setCloseSuccess('');
    },
  });

  const handleClose = () => {
    if (
      window.confirm(
        `Close month ${yearMonth}? This will lock all lesson records and confirm rewards. This cannot be undone.`,
      )
    ) {
      closeMutation.mutate();
    }
  };

  const handleCsvDownload = async (type: 'monthly' | 'issuance' | 'balance') => {
    try {
      let blob: Blob;
      let filename: string;

      if (type === 'monthly') {
        const res = await csvApi.monthlyLessons(yearMonth);
        blob = res.data;
        filename = `monthly-lessons-${yearMonth}.csv`;
      } else if (type === 'issuance') {
        const res = await csvApi.ticketIssuance(yearMonth);
        blob = res.data;
        filename = `ticket-issuance-${yearMonth}.csv`;
      } else {
        const res = await csvApi.ticketBalance();
        blob = res.data;
        filename = `ticket-balance-${new Date().toISOString().split('T')[0]}.csv`;
      }

      downloadCsv(blob, filename);
    } catch (err) {
      console.error('CSV download failed:', err);
    }
  };

  const isAlreadyClosed = confirmed && confirmed.length > 0 && confirmed[0]?.confirmedAt;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
      </div>

      {/* Month picker */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div>
            <label className="label">Target Month</label>
            <input
              type="month"
              className="input"
              value={yearMonth}
              onChange={(e) => {
                setYearMonth(e.target.value);
                setCloseError('');
                setCloseSuccess('');
              }}
            />
          </div>
          <button
            onClick={handleClose}
            disabled={closeMutation.isPending || !!isAlreadyClosed}
            className={`btn-danger py-2 px-6 ${isAlreadyClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isAlreadyClosed ? 'Already Closed' : 'Monthly Close'}
          </button>
        </div>

        {closeSuccess && (
          <div className="mt-3 bg-green-50 text-green-700 text-sm p-3 rounded">{closeSuccess}</div>
        )}
        {closeError && (
          <div className="mt-3 bg-red-50 text-red-700 text-sm p-3 rounded">{closeError}</div>
        )}
      </div>

      {/* Preview table */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {isAlreadyClosed ? '✓ Confirmed Results' : 'Preview'} — {yearMonth}
          </h2>
          {isAlreadyClosed && (
            <span className="badge badge-green">Closed</span>
          )}
        </div>
        {previewLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th>Reward Type</th>
                  <th className="text-right">Lessons</th>
                  <th className="text-right">Total Sales</th>
                  <th className="text-right">Reward Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview?.results.map((r: any) => (
                  <tr key={r.instructorId}>
                    <td className="font-medium">{r.instructorName}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.rewardType === 'fixed' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {r.rewardType}
                      </span>
                    </td>
                    <td className="text-right">{r.lessonCount}</td>
                    <td className="text-right">
                      {r.totalSales > 0 ? `¥${r.totalSales.toLocaleString()}` : '—'}
                    </td>
                    <td className="text-right font-semibold text-green-700">
                      ¥{r.rewardAmount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!preview?.results.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No lesson records for this month
                    </td>
                  </tr>
                )}
                {preview?.results.length > 0 && (
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={2}>Total</td>
                    <td className="text-right">
                      {preview.results.reduce((s: number, r: any) => s + r.lessonCount, 0)}
                    </td>
                    <td className="text-right">
                      ¥{preview.results
                        .reduce((s: number, r: any) => s + r.totalSales, 0)
                        .toLocaleString()}
                    </td>
                    <td className="text-right text-green-700">
                      ¥{preview.results
                        .reduce((s: number, r: any) => s + r.rewardAmount, 0)
                        .toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Export */}
      <div className="card">
        <h2 className="font-semibold mb-4">CSV Export</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCsvDownload('monthly')}
            className="btn-secondary text-sm"
          >
            📥 Monthly Lessons ({yearMonth})
          </button>
          <button
            onClick={() => handleCsvDownload('issuance')}
            className="btn-secondary text-sm"
          >
            📥 Ticket Issuance ({yearMonth})
          </button>
          <button
            onClick={() => handleCsvDownload('balance')}
            className="btn-secondary text-sm"
          >
            📥 Ticket Balance (Current)
          </button>
        </div>
      </div>
    </div>
  );
}
