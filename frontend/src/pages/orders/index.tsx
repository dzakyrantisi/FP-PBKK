import { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import type { Order, OrderItem, OrderStatus } from '../../types/shared';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', className: 'bg-warning text-dark' };
    case 'PROCESSING':
      return { label: 'Processing', className: 'bg-info text-dark' };
    case 'SHIPPED':
      return { label: 'Shipped', className: 'bg-primary' };
    case 'DELIVERED':
      return { label: 'Delivered', className: 'bg-success' };
    default:
      return { label: status, className: 'bg-secondary' };
  }
}

export default function OrdersPage() {
  const { api } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setError(null);
        setLoading(true);
        const { data } = await api.get<Order[]>('/orders/me');
        setOrders(data);
      } catch {
        setError('Unable to load your orders at the moment.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders().catch(() => undefined);
  }, [api]);

  return (
    <ProtectedRoute roles={['CUSTOMER']}>
      <div className="bg-white rounded-4 shadow-sm p-4">
        <header className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center mb-4">
          <div>
            <h1 className="h3 mb-1">My Orders</h1>
            <p className="text-muted mb-0">Track your purchases and delivery status.</p>
          </div>
          <span className="badge bg-success-subtle text-success">
            Total orders: {orders.length}
          </span>
        </header>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <p className="mb-0">You have not placed any orders yet. Explore our catalog to get started.</p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-4">
            {orders.map((order) => {
              const badge = statusLabel(order.status);
              return (
                <div className="border rounded-3 p-3" key={order.id}>
                  <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
                    <div>
                      <h2 className="h5 mb-1">Order #{order.id}</h2>
                      <p className="text-muted small mb-0">
                        Placed on {new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span className={`badge ${badge.className} px-3 py-2`}>{badge.label}</span>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-borderless align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th scope="col">Product</th>
                          <th scope="col" className="text-center">
                            Quantity
                          </th>
                          <th scope="col" className="text-end">
                            Unit Price
                          </th>
                          <th scope="col" className="text-end">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item: OrderItem) => (
                          <tr key={item.id}>
                            <td>
                              <div className="fw-semibold">{item.product.name}</div>
                              <div className="text-muted small">Seller: {item.product.sellerName}</div>
                            </td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-end">{formatter.format(item.unitPrice)}</td>
                            <td className="text-end">{formatter.format(item.unitPrice * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mt-3 gap-2">
                    <div className="text-muted small">
                      Shipping address:
                      <span className="d-block text-dark" style={{ whiteSpace: 'pre-wrap' }}>
                        {order.shippingAddress}
                      </span>
                    </div>
                    <div className="text-lg-end">
                      <span className="text-muted me-2">Total paid:</span>
                      <strong className="text-success h5 mb-0">{formatter.format(order.totalAmount)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
