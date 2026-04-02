import { useState, useRef } from 'react';
import { importApi } from '../../api/client';

type Mode = 'students' | 'tickets';

const STUDENTS_CSV_EXAMPLE = `name,email,course,password
山田太郎,yamada@example.com,ピアノ,pass1234
鈴木花子,suzuki@example.com,バイオリン,pass5678`;

const TICKETS_CSV_EXAMPLE = `studentEmail,ticketTypeName,remainingCount,expiresAt
yamada@example.com,月謝ピアノ（4回）,3,2026-05-31
suzuki@example.com,回数券10回,8,2026-06-30`;

export default function AdminImport() {
  const [mode, setMode] = useState<Mode>('students');
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleImport = async () => {
    if (!csvText.trim()) { setError('CSVデータを入力またはファイルを選択してください'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await importApi.importStudentsText(csvText);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'インポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">データ移行・インポート</h1>

      {/* Mode tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([
            { id: 'students' as Mode, label: '生徒データ一括登録' },
            { id: 'tickets' as Mode, label: 'チケット残高移行' },
          ] as { id: Mode; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => { setMode(t.id); setCsvText(''); setResult(null); setError(''); }}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                mode === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        {mode === 'students' ? (
          <>
            <p className="font-semibold mb-1">生徒データ一括登録について</p>
            <p>CSVファイルまたはテキストで生徒データを一括登録します。既存のメールアドレスはスキップされます。</p>
            <p className="mt-1">必須列: <code className="bg-blue-100 px-1 rounded">name, email, password</code> ／ 任意列: <code className="bg-blue-100 px-1 rounded">course</code></p>
          </>
        ) : (
          <>
            <p className="font-semibold mb-1">チケット残高移行について</p>
            <p>紙台帳からの移行時に使用します。既存生徒のチケット残高をCSVで一括登録します。</p>
            <p className="mt-1">必須列: <code className="bg-blue-100 px-1 rounded">studentEmail, ticketTypeName, remainingCount, expiresAt</code></p>
          </>
        )}
      </div>

      {/* CSV input */}
      <div className="card space-y-4">
        <h2 className="font-semibold">CSVデータ入力</h2>

        {/* File upload */}
        <div>
          <label className="label">ファイルを選択（.csv）</label>
          <div className="flex gap-3 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-sm"
            >
              📁 ファイルを選択
            </button>
            {csvText && <span className="text-sm text-green-600">ファイル読み込み済み</span>}
          </div>
        </div>

        {/* Text area */}
        <div>
          <label className="label">またはCSVテキストを直接入力</label>
          <textarea
            className="input font-mono text-xs"
            rows={10}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={mode === 'students' ? STUDENTS_CSV_EXAMPLE : TICKETS_CSV_EXAMPLE}
          />
        </div>

        {/* Example */}
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600 hover:underline">フォーマット例を見る</summary>
          <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
            {mode === 'students' ? STUDENTS_CSV_EXAMPLE : TICKETS_CSV_EXAMPLE}
          </pre>
        </details>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={loading || !csvText.trim()}
            className="btn-primary px-6"
          >
            {loading ? 'インポート中...' : 'インポート実行'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card border-green-200 bg-green-50">
          <h2 className="font-semibold text-green-800 mb-3">インポート完了</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600">{result.imported ?? result.success ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">登録成功</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-2xl font-bold text-yellow-600">{result.skipped ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">スキップ（重複）</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-2xl font-bold text-red-600">{result.errors?.length ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">エラー</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-700 mb-2">エラー詳細：</p>
              <ul className="space-y-1">
                {result.errors.map((err: any, i: number) => (
                  <li key={i} className="text-xs text-red-600 bg-white rounded px-3 py-1">
                    {typeof err === 'string' ? err : `行 ${err.row}: ${err.message}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
