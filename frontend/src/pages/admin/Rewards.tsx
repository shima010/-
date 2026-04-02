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
      setCloseSuccess(`${yearMonth} の月次確定が完了しました。`);
      setCloseError('');
    },
    onError: (e: any) => {
      setCloseError(e.response?.data?.message || '月次確定に失敗しました');
      setCloseSuccess('');
    },
  });

  const handleClose = () => {
    if (
      window.confirm(
        `${yearMonth} を月次確定しますか？\nすべてのレッスン記録がロックされ、報酬額が確定します。この操作は取り消せません。`,
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
        filename = `月次レッスン実績_${yearMonth}.csv`;
      } else if (type === 'issuance') {
        const res = await csvApi.ticketIssuance(yearMonth);
        blob = res.data;
        filename = `チケット発行台帳_${yearMonth}.csv`;
      } else {
        const res = await csvApi.ticketBalance();
        blob = res.data;
        filename = `チケット残高一覧_${new Date().toISOString().split('T')[0]}.csv`;
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
        <h1 className="text-2xl font-bold text-gray-900">報酬管理</h1>
      </div>

      {/* 対象月選択 */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div>
            <label className="label">対象月</label>
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
            {isAlreadyClosed ? '✓ 確定済み' : '月次確定'}
          </button>
        </div>

        {closeSuccess && (
          <div className="mt-3 bg-green-50 text-green-700 text-sm p-3 rounded">{closeSuccess}</div>
        )}
        {closeError && (
          <div className="mt-3 bg-red-50 text-red-700 text-sm p-3 rounded">{closeError}</div>
        )}
      </div>

      {/* 報酬プレビューテーブル */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {isAlreadyClosed ? '✓ 確定済み報酬' : '計算プレビュー'} — {yearMonth}
          </h2>
          {isAlreadyClosed && (
            <span className="badge badge-green">確定済み</span>
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
                  <th>講師名</th>
                  <th>計算方式</th>
                  <th className="text-right">レッスン数</th>
                  <th className="text-right">売上合計</th>
                  <th className="text-right">支払報酬額</th>
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
                        {r.rewardType === 'fixed' ? '固定単価' : '歩合'}
                      </span>
                    </td>
                    <td className="text-right">{r.lessonCount} 回</td>
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
                      この月のレッスン記録がありません
                    </td>
                  </tr>
                )}
                {preview?.results.length > 0 && (
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={2}>合計</td>
                    <td className="text-right">
                      {preview.results.reduce((s: number, r: any) => s + r.lessonCount, 0)} 回
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

      {/* CSV出力 */}
      <div className="card">
        <h2 className="font-semibold mb-4">CSV出力（経理・給与計算用）</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCsvDownload('monthly')}
            className="btn-secondary text-sm"
          >
            📥 月次レッスン実績（{yearMonth}）
          </button>
          <button
            onClick={() => handleCsvDownload('issuance')}
            className="btn-secondary text-sm"
          >
            📥 チケット発行台帳（{yearMonth}）
          </button>
          <button
            onClick={() => handleCsvDownload('balance')}
            className="btn-secondary text-sm"
          >
            📥 チケット残高一覧（現在）
          </button>
        </div>
      </div>
    </div>
  );
}
