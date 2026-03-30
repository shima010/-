import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { ticketsApi, studentsApi } from '../../api/client';
import QRCode from '../../components/QRCode';

export default function StudentMyPage() {
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ['student', 'profile', user?.profileId],
    queryFn: () => studentsApi.getOne(user!.profileId),
    enabled: !!user?.profileId,
    select: (r) => r.data,
  });

  const { data: activeTickets, isLoading } = useQuery({
    queryKey: ['tickets', 'active', user?.profileId],
    queryFn: () => ticketsApi.getActiveTickets(user!.profileId),
    enabled: !!user?.profileId,
    select: (r) => r.data,
  });

  const qrValue = `MUSICSCHOOL:STUDENT:${user?.profileId}:${user?.email}`;

  const getDaysLeft = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="max-w-sm mx-auto space-y-6 pb-8">
      {/* Member Card with QR */}
      <div className="card bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="text-center">
          <div className="text-4xl mb-2">🎵</div>
          <h2 className="text-xl font-bold">{user?.name}</h2>
          {student?.course && (
            <p className="text-blue-200 text-sm">{student.course}</p>
          )}
          <p className="text-blue-300 text-xs mt-1">Member ID: #{user?.profileId}</p>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="bg-white rounded-xl p-3">
            <QRCode value={qrValue} size={160} />
          </div>
        </div>

        <p className="text-center text-blue-200 text-xs mt-3">
          Show this QR code at the front desk
        </p>
      </div>

      {/* Active Tickets */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">My Tickets</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : activeTickets?.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-4xl mb-2">🎫</p>
            <p className="text-gray-500">No active tickets</p>
            <p className="text-sm text-gray-400">Please contact the office to purchase a ticket</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTickets?.map((ticket: any) => {
              const daysLeft = getDaysLeft(ticket.expiresAt);
              const isExpiringSoon = daysLeft <= 7;
              const progressPercent = Math.round(
                (ticket.remainingCount / ticket.initialCount) * 100,
              );

              return (
                <div
                  key={ticket.id}
                  className={`card ${isExpiringSoon ? 'border-yellow-400' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{ticket.ticketType.name}</h3>
                      <span
                        className={`badge mt-1 ${
                          ticket.ticketType.category === 'monthly' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {ticket.ticketType.category}
                      </span>
                    </div>
                    {isExpiringSoon && (
                      <span className="badge badge-yellow">⚠️ {daysLeft}d left</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Remaining lessons</span>
                      <span className="font-bold text-blue-600">
                        {ticket.remainingCount} / {ticket.initialCount}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          progressPercent > 50
                            ? 'bg-blue-500'
                            : progressPercent > 25
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Issued: {new Date(ticket.issuedAt).toLocaleDateString()}</span>
                    <span>Expires: {new Date(ticket.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
