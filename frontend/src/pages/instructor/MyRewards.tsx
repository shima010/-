import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { rewardsApi } from '../../api/client';

export default function InstructorMyRewards() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['rewards', 'instructor', user?.id],
    queryFn: () => rewardsApi.getInstructorRewards(user!.id),
    enabled: !!user?.id,
    select: (r) => r.data,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">報酬確認</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {data?.currentMonthPreview && (
            <div className="card border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="font-semibold text-blue-800 mb-3">今月の見込み報酬</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900">{data.currentMonthPreview.lessonCount}</p>
                  <p className="text-xs text-blue-600">レッスン数</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900">
                    {data.currentMonthPreview.rewardType === 'percentage'
                      ? `¥${data.currentMonthPreview.totalSales.toLocaleString()}` : '—'}
                  </p>
                  <p className="text-xs text-blue-600">売上合計</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-700">¥{data.currentMonthPreview.rewardAmount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">見込み報酬</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">※ 月次確定後に報酬額が確定します。</p>
            </div>
          )}

          <div className="card p-0">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold">確定済み報酬履歴</h2>
            </div>
            <div className="table-container rounded-none border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>対象月</th>
                    <th className="text-right">レッスン数</th>
                    <th className="text-right">売上合計</th>
                    <th className="text-right">支払報酬額</th>
                    <th>確定日</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.confirmed.map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.targetYearMonth}</td>
                      <td className="text-right">{r.lessonCount} 回</td>
                      <td className="text-right">{r.totalSales > 0 ? `¥${r.totalSales.toLocaleString()}` : '—'}</td>
                      <td className="text-right font-semibold text-green-700">¥{r.rewardAmount.toLocaleString()}</td>
                      <td className="text-gray-500 text-sm">
                        {r.confirmedAt ? new Date(r.confirmedAt).toLocaleDateString('ja-JP') : '—'}
                      </td>
                    </tr>
                  ))}
                  {!data?.confirmed.length && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">確定済みの報酬はまだありません</td></tr>
                  )}
                  {data?.confirmed.length > 0 && (
                    <tr className="bg-gray-50 font-semibold">
                      <td>累計</td>
                      <td className="text-right">{data.confirmed.reduce((s: number, r: any) => s + r.lessonCount, 0)} 回</td>
                      <td className="text-right">—</td>
                      <td className="text-right text-green-700">¥{data.confirmed.reduce((s: number, r: any) => s + r.rewardAmount, 0).toLocaleString()}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
