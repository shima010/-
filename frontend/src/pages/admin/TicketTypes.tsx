import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '../../api/client';

interface TicketTypeForm {
  name: string;
  price: string;
  grantCount: string;
  validityDays: string;
  category: string;
}

const defaultForm: TicketTypeForm = {
  name: '',
  price: '',
  grantCount: '',
  validityDays: '30',
  category: 'monthly',
};

export default function AdminTicketTypes() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TicketTypeForm>(defaultForm);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: types, isLoading } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => ticketsApi.getTypes(),
    select: (r) => r.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => ticketsApi.createType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketTypes'] });
      setShowModal(false);
      setForm(defaultForm);
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => ticketsApi.updateType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticketTypes'] });
      setShowModal(false);
      setEditingId(null);
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ticketsApi.deleteType(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticketTypes'] }),
  });

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (type: any) => {
    setForm({
      name: type.name,
      price: String(type.price),
      grantCount: String(type.grantCount),
      validityDays: String(type.validityDays),
      category: type.category,
    });
    setEditingId(type.id);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      price: parseFloat(form.price),
      grantCount: parseInt(form.grantCount),
      validityDays: parseInt(form.validityDays),
      category: form.category,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Delete ticket type "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ticket Types</h1>
        <button onClick={handleOpenCreate} className="btn-primary">
          + Add Ticket Type
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {types?.map((type: any) => (
            <div key={type.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{type.name}</h3>
                  <span
                    className={`badge mt-1 ${
                      type.category === 'monthly' ? 'badge-blue' : 'badge-green'
                    }`}
                  >
                    {type.category}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(type)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(type.id, type.name)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Price</dt>
                  <dd className="font-medium">¥{type.price.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Lessons</dt>
                  <dd className="font-medium">{type.grantCount} lessons</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Validity</dt>
                  <dd className="font-medium">{type.validityDays} days</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Per Lesson</dt>
                  <dd className="font-medium text-green-600">
                    ¥{Math.round(type.price / type.grantCount).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Issued</dt>
                  <dd className="text-gray-600">{type._count?.studentTickets ?? 0}x</dd>
                </div>
              </dl>
            </div>
          ))}
          {!types?.length && (
            <div className="col-span-3 text-center py-12 text-gray-500">
              No ticket types yet. Create one!
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? 'Edit Ticket Type' : 'Add Ticket Type'}
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
                  placeholder="e.g. Monthly 4 Lessons"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Price (¥) *</label>
                  <input
                    className="input"
                    type="number"
                    required
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="20000"
                  />
                </div>
                <div>
                  <label className="label">Lessons *</label>
                  <input
                    className="input"
                    type="number"
                    required
                    min="1"
                    value={form.grantCount}
                    onChange={(e) => setForm({ ...form, grantCount: e.target.value })}
                    placeholder="4"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Validity (days) *</label>
                  <input
                    className="input"
                    type="number"
                    required
                    min="1"
                    value={form.validityDays}
                    onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    className="input"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="coupon">Coupon</option>
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
