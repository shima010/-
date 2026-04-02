import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorsApi } from '../../api/client';

interface InstructorForm {
  name: string;
  email: string;
  password: string;
  rewardType: string;
  employmentType: string;
}

const defaultForm: InstructorForm = {
  name: '',
  email: '',
  password: '',
  rewardType: '固定単価',
  employmentType: '非常勤',
};

export default function AdminInstructors() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InstructorForm>(defaultForm);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll({ limit: 100 }),
    select: (r) => r.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => instructorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      setShowModal(false);
      setForm(defaultForm);
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => instructorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      setShowModal(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => instructorsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  });

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (instructor: any) => {
    setForm({
      name: instructor.name,
      email: instructor.email,
      password: '',
      rewardType: instructor.rewardType,
      employmentType: instructor.employmentType,
    });
    setEditingId(instructor.id);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
    if (!data.password) delete (data as any).password;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`講師「 "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Instructors</h1>
        <button onClick={handleOpenCreate} className="btn-primary">
          + 講師を追加
        </button>
      </div>

      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">{data?.total ?? 0} instructors</h2>
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
                  <th>Name</th>
                  <th>Email</th>
                  <th>報酬計算方式</th>
                  <th>Employment</th>
                  <th>Lessons</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.instructors.map((instructor: any) => (
                  <tr key={instructor.id}>
                    <td className="font-medium">{instructor.name}</td>
                    <td className="text-gray-600">{instructor.email}</td>
                    <td>
                      <span
                        className={`badge ${
                          instructor.rewardType === '固定単価' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {instructor.rewardType}
                      </span>
                    </td>
                    <td className="text-gray-600">{instructor.employmentType}</td>
                    <td className="text-center">
                      <span className="badge badge-gray">
                        {instructor._count?.lessonRecords ?? 0}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(instructor)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(instructor.id, instructor.name)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.instructors.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      講師がいません found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="固定単価 inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? '講師を編集' : '講師を追加'}
            </h2>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{editingId ? 'Password (leave blank to keep)' : 'Password *'}</label>
                <input
                  className="input"
                  type="password"
                  required={!editingId}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">報酬計算方式</label>
                  <select
                    className="input"
                    value={form.rewardType}
                    onChange={(e) => setForm({ ...form, rewardType: e.target.value })}
                  >
                    <option value="固定単価">Fixed</option>
                    <option value="歩合">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="label">Employment</label>
                  <select
                    className="input"
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  >
                    <option value="常勤">Full Time</option>
                    <option value="非常勤">Part Time</option>
                    <option value="契約">Contract</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
