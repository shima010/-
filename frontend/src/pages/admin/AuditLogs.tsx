import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, downloadCsv } from '../../api/client';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'ログイン',
  CREATE: '新規作成',
  UPDATE: '更新',
  DELETE: '削除',
  CONSUME_TICKET: 'チケット消化',
  CONSUME_GROUP_TICKET: 'グループ消化',
  MONTHLY_CLOSE: '月次確定',
  CSV_IMPORT_STUDENTS: '生徒CSVインポート',
  CSV_IMPORT_TICKET_BALANCES: 'チケット残高インポート',
};

const ENTITY_LABELS: Record<string, string> = {
  Student: '生徒',
  Instructor: '講師',
  TicketType: 'チケット種別',
  StudentTicket: '保有チケット',
  LessonRecord: 'レッスン記録',
  RewardResult: '報酬結果',
  User: 'ユーザー',
};

export default function AdminAuditLogs() {
  const [targetEntity, setTargetEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'logs', targetEntity, action, page],
    queryFn: () =>
      auditApi.getLogs({
        targetEntity: targetEntity || undefined,
        action: action || undefined,
        limit,
        offset: page * limit,
      }),
    select: (r) => r.data,
  });

  const handleDownload = async () => {
    try {
      const res = await auditApi.downloadCsv({
        targetEntity: targetEntity || undefined,
        action: action || undefined,
      });
      const filename = `監査ログ_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCsv(res.data, filename);
    } catch (err) {
      console.error('CSV download failed:', err);
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">監査ログ</h1>
          <p className="text-sm text-gray-500 mt-1">
            チケット操作・レッスン消化・マスタ変更・ログインの記録（RFP 第8章）
          </p>
        </div>
        <button onClick={handleDownload} className="btn-secondary text-sm">
          📥 CSVダウンロード
        </button>
      </div>

      {/* フィルター */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">対象エンティティ</label>
            <select
              className="input"
              value={targetEntity}
              onChange={(e) => { setTargetEntity(e.target.value); setPage(0); }}
            >
              <option value="">すべて</option>
              {Object.entries(ENTITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">アクション</label>
            <select
              className="input"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(0); }}
            >
              <option value="">すべて</option>
              {Object.entries(ACTION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {data?.total ?? 0} 件
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-gray-600">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="table-container rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>ユーザー</th>
                  <th>ロール</th>
                  <th>アクション</th>
                  <th>対象</th>
                  <th>対象ID</th>
                  <th>変更内容</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="text-sm font-medium">
                      {log.user?.name || <span className="text-gray-400">—</span>}
                    </td>
                    <td>
                      <span className={`badge text-xs ${
                        log.userRole === 'admin' ? 'badge-blue' :
                        log.userRole === 'instructor' ? 'badge-green' : 'badge-gray'
                      }`}>
                        {log.userRole === 'admin' ? '管理者' :
                         log.userRole === 'instructor' ? '講師' :
                         log.userRole === 'student' ? '生徒' : log.userRole || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {ENTITY_LABELS[log.targetEntity] || log.targetEntity}
                    </td>
                    <td className="text-xs text-gray-400">{log.targetId || '—'}</td>
                    <td className="max-w-xs">
                      {(log.oldValue || log.newValue) ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:underline">
                            詳細を表示
                          </summary>
                          <div className="mt-1 space-y-1">
                            {log.oldValue && (
                              <div className="bg-red-50 p-1 rounded text-red-700 font-mono text-xs break-all">
                                変更前: {JSON.stringify(log.oldValue)}
                              </div>
                            )}
                            {log.newValue && (
                              <div className="bg-green-50 p-1 rounded text-green-700 font-mono text-xs break-all">
                                変更後: {JSON.stringify(log.newValue)}
                              </div>
                            )}
                          </div>
                        </details>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      ログがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        監査ログは最低1年間保存されます（RFP 第8章）
      </p>
    </div>
  );
}
