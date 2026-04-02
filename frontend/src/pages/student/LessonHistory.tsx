import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { lessonsApi } from '../../api/client';

export default function StudentLessonHistory() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['lessons', 'student', user?.profileId],
    queryFn: () => lessonsApi.getAll({ studentId: user?.profileId, limit: 50 }),
    enabled: !!user?.profileId,
    select: (r) => r.data,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <h1 className="text-2xl font-bold text-gray-900">受講履歴</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.records.map((lesson: any) => (
            <div key={lesson.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {new Date(lesson.executedAt).toLocaleDateString('ja-JP', {
                        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                      })}
                    </p>
                    <span className={`badge ${lesson.lessonType === 'group' ? 'badge-blue' : 'badge-green'}`}>
                      {lesson.lessonType === 'group' ? 'グループ' : '個人'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">担当講師: {lesson.instructor?.name}</p>
                  <p className="text-sm text-gray-400">チケット: {lesson.ticket?.ticketType?.name}</p>
                  {lesson.notes && <p className="text-sm text-gray-600 mt-1 italic">「{lesson.notes}」</p>}
                </div>
                {lesson.isConfirmed && <span className="badge badge-green text-xs">✓ 確定</span>}
              </div>
            </div>
          ))}
          {!data?.records.length && (
            <div className="card text-center py-12">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-gray-500">受講履歴はまだありません</p>
            </div>
          )}
        </div>
      )}

      {data && (
        <p className="text-center text-sm text-gray-400">合計 {data.total} 回</p>
      )}
    </div>
  );
}
