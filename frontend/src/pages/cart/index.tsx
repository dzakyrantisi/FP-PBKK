import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/cart/CartContext';
import { buildImageUrl } from '../../lib/api';
import type { CartItem } from '../../types/shared';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export default function CartPage() {
  const { items, updateItem, removeItem, clear, toOrderPayload } = useCart();
  const { api } = useAuth();
  const router = useRouter();

  const [shippingAddress, setShippingAddress] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = useMemo(
    () =>
      items.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0),
    [items],
  );

  const shippingFee = useMemo(() => (items.length > 0 ? 15000 : 0), [items.length]);
  const total = subtotal + shippingFee;

  const handleQuantityChange = (productId: number, value: string) => {
    const quantity = Number(value);
    if (Number.isNaN(quantity)) {
      return;
    }
    updateItem(productId, quantity);
  };

  const handleShippingChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setShippingAddress(event.target.value);
  };

  const handleNoteChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setNote(event.target.value);
  };

  const handleCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) {
      setStatus({ type: 'error', message: 'Add at least one product before checking out.' });
      return;
    }

    if (!shippingAddress.trim()) {
      setStatus({ type: 'error', message: 'Please provide a delivery address.' });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const payload = toOrderPayload(`${shippingAddress}\n\n${note}`.trim());
      await api.post('/orders', payload);
      clear();
      setStatus({ type: 'success', message: 'Order placed successfully! We will notify you shortly.' });
      await router.push('/customer');
    } catch (error) {
      setStatus({ type: 'error', message: 'Unable to place the order. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute roles={['CUSTOMER']}>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="bg-white rounded-4 shadow-sm p-4 h-100">
            <header className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h1 className="h3 mb-1">Shopping Cart</h1>
                <p className="text-muted mb-0">Review your selections before confirming your order.</p>
              </div>
              <Link className="btn btn-outline-success" href="/catalog">
                Continue shopping
              </Link>
            </header>

            {items.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <p className="mb-2">Your cart is empty.</p>
                <Link className="btn btn-success" href="/catalog">
                  Explore teas
                </Link>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {items.map((item: CartItem) => {
                  const imageUrl = buildImageUrl(item.imageUrl ?? undefined);
                  return (
                    <div className="d-flex gap-3 align-items-start border rounded-3 p-3" key={item.productId}>
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="rounded"
                            style={{ width: 96, height: 96, objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            className="bg-success-subtle text-success d-flex align-items-center justify-content-center rounded"
                            style={{ width: 96, height: 96 }}
                          >
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h2 className="h5 mb-1">{item.name}</h2>
                            <p className="text-muted small mb-2">Seller ID: {item.sellerId}</p>
                            <strong className="text-success">{formatter.format(item.price)}</strong>
                          </div>
                          <button
                            className="btn btn-sm btn-link text-danger"
                            type="button"
                            onClick={() => removeItem(item.productId)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="d-flex align-items-center gap-3 mt-2">
                          <label className="small text-muted mb-0" htmlFor={`qty-${item.productId}`}>
                            Quantity
                          </label>
                          <input
                            id={`qty-${item.productId}`}
                            className="form-control"
                            style={{ maxWidth: 120 }}
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => handleQuantityChange(item.productId, event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          <div className="bg-white rounded-4 shadow-sm p-4">
            <h2 className="h4 mb-3">Order summary</h2>
            <dl className="row mb-0">
              <dt className="col-6 text-muted">Subtotal</dt>
              <dd className="col-6 text-end">{formatter.format(subtotal)}</dd>
              <dt className="col-6 text-muted">Shipping</dt>
              <dd className="col-6 text-end">{shippingFee === 0 ? 'Free' : formatter.format(shippingFee)}</dd>
              <dt className="col-6 fw-bold">Total</dt>
              <dd className="col-6 text-end fw-bold">{formatter.format(total)}</dd>
            </dl>

            <hr className="my-4" />

            {status && (
              <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.message}
              </div>
            )}

            <form className="d-flex flex-column gap-3" onSubmit={handleCheckout}>
              <div>
                <label className="form-label" htmlFor="shippingAddress">
                  Delivery address
                </label>
                <textarea
                  id="shippingAddress"
                  className="form-control"
                  rows={3}
                  placeholder="Street, city, province"
                  value={shippingAddress}
                  onChange={handleShippingChange}
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="note">
                  Order notes (optional)
                </label>
                <textarea
                  id="note"
                  className="form-control"
                  rows={2}
                  placeholder="Include brewing preferences or delivery instructions"
                  value={note}
                  onChange={handleNoteChange}
                />
              </div>

              <button className="btn btn-success w-100" type="submit" disabled={submitting || items.length === 0}>
                {submitting ? 'Placing order…' : 'Place order'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
