import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';
import { useProducts } from '../../../contexts/products/ProductsContext';
import { buildImageUrl } from '../../../lib/api';
import type { Order, OrderItem, OrderStatus, Product } from '../../../types/shared';

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  category: string;
  stock: string;
  isActive: boolean;
  images: FileList | null;
}

const emptyForm: ProductFormState = {
  name: '',
  description: '',
  price: '',
  category: '',
  stock: '0',
  isActive: true,
  images: null,
};

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

const quantityFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const statusLabel = (status: OrderStatus) => {
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
};

interface SellerOrderView {
  order: Order;
  sellerItems: OrderItem[];
  sellerQuantity: number;
  sellerSubtotal: number;
}

const formatDate = (value?: string) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString('id-ID', { dateStyle: 'medium' });
};

export default function SellerProductsPage() {
  const { api, user } = useAuth();
  const {
    sellerProducts,
    sellerLoading,
    loadSellerProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useProducts();

  const [formState, setFormState] = useState<ProductFormState>(emptyForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  useEffect(() => {
    loadSellerProducts().catch(() => undefined);
  }, [loadSellerProducts]);

  useEffect(() => {
    if (!editingProduct) {
      setFormState(emptyForm);
      return;
    }
    setFormState({
      name: editingProduct.name,
      description: editingProduct.description,
      price: String(editingProduct.price),
      category: editingProduct.category,
      stock: String(editingProduct.stock),
      isActive: editingProduct.isActive,
      images: null,
    });
  }, [editingProduct]);

  const totalActive = useMemo(
    () => sellerProducts.filter((product: Product) => product.isActive).length,
    [sellerProducts],
  );

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersError(null);
      setOrdersLoading(true);
      const { data } = await api.get<Order[]>('/orders/seller');
      setOrders(data);
    } catch (error) {
      setOrdersError('Unable to load customer orders at the moment.');
    } finally {
      setOrdersLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchOrders().catch(() => undefined);
  }, [fetchOrders]);

  const sellerId = user?.id ?? null;

  const sellerOrders = useMemo(() => {
    if (!sellerId) {
      return [] as SellerOrderView[];
    }
    return orders.reduce<SellerOrderView[]>((acc, order) => {
      const sellerItems = order.items.filter((item) => item.product.sellerId === sellerId);
      if (sellerItems.length === 0) {
        return acc;
      }
      const sellerQuantity = sellerItems.reduce((total, item) => total + item.quantity, 0);
      const sellerSubtotal = sellerItems.reduce(
        (total, item) => total + item.quantity * item.unitPrice,
        0,
      );
      acc.push({ order, sellerItems, sellerQuantity, sellerSubtotal });
      return acc;
    }, []);
  }, [orders, sellerId]);

  const pendingSellerOrders = useMemo(
    () => sellerOrders.filter(({ order }) => order.status === 'PENDING').length,
    [sellerOrders],
  );

  const handleProcessOrder = async (orderId: number) => {
    setProcessingOrderId(orderId);
    setOrderFeedback(null);
    try {
      const { data } = await api.patch<Order>(`/orders/${orderId}/status`, {
        status: 'PROCESSING',
      });
      setOrders((prev) => prev.map((order) => (order.id === data.id ? data : order)));
      setOrderFeedback({
        type: 'success',
        message: `Order #${orderId} is now marked as processing.`,
      });
    } catch (error) {
      setOrderFeedback({ type: 'error', message: 'Failed to update the order status.' });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = event.target;
    setFormState((prev: ProductFormState) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev: ProductFormState) => ({
      ...prev,
      images: event.target.files,
    }));
  };

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingProduct(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('name', formState.name.trim());
    formData.append('description', formState.description.trim());
    formData.append('category', formState.category.trim());
    formData.append('price', formState.price);
    formData.append('stock', formState.stock);
    formData.append('isActive', String(formState.isActive));

    if (formState.images) {
      const files = Array.from(formState.images) as File[];
      files.forEach((file) => {
        formData.append('images', file);
      });
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        setStatus({ type: 'success', message: 'Product updated successfully.' });
      } else {
        await createProduct(formData);
        setStatus({ type: 'success', message: 'Product created successfully.' });
      }
      resetForm();
      await loadSellerProducts();
    } catch (error) {
      setStatus({ type: 'error', message: 'Unable to save product. Please review the form and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
  };

  const handleDelete = async (productId: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    setSubmitting(true);
    try {
      await deleteProduct(productId);
      setStatus({ type: 'success', message: 'Product deleted successfully.' });
      await loadSellerProducts();
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to delete product. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute roles={['SELLER']}>
      <div className="row g-4">
        <div className="col-lg-5">
          <div className="bg-white rounded-4 shadow-sm p-4 h-100">
            <h1 className="h4 mb-3">{editingProduct ? 'Edit product' : 'Create new product'}</h1>
            <p className="text-muted small mb-4">
              Upload clear product images and provide detailed tasting notes to help customers choose confidently.
            </p>

            {status && (
              <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.message}
              </div>
            )}

            <form className="d-flex flex-column gap-3" onSubmit={handleSubmit}>
              <div>
                <label className="form-label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  className="form-control"
                  type="text"
                  value={formState.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  className="form-control"
                  rows={4}
                  value={formState.description}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="price">
                    Price (IDR)
                  </label>
                  <input
                    id="price"
                    name="price"
                    className="form-control"
                    type="number"
                    min={1}
                    value={formState.price}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="stock">
                    Stock
                  </label>
                  <input
                    id="stock"
                    name="stock"
                    className="form-control"
                    type="number"
                    min={0}
                    value={formState.stock}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="category">
                  Category
                </label>
                <input
                  id="category"
                  name="category"
                  className="form-control"
                  type="text"
                  placeholder="e.g. Jasmine Green"
                  value={formState.category}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="images">
                  Images
                </label>
                <input
                  id="images"
                  name="images"
                  className="form-control"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <div className="form-text">
                  Upload up to five images. New uploads will be added to existing media.
                </div>
              </div>

              <div className="form-check form-switch">
                <input
                  id="isActive"
                  name="isActive"
                  className="form-check-input"
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={handleInputChange}
                />
                <label className="form-check-label" htmlFor="isActive">
                  Product is visible in catalog
                </label>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-success" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : editingProduct ? 'Update product' : 'Create product'}
                </button>
                {editingProduct && (
                  <button className="btn btn-outline-secondary" type="button" onClick={resetForm} disabled={submitting}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="d-flex flex-column gap-4">
            <div className="bg-white rounded-4 shadow-sm p-4">
              <header className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="h4 mb-1">Your products</h2>
                  <p className="text-muted small mb-0">
                    {totalActive} active / {sellerProducts.length} total listings
                  </p>
                </div>
              </header>

              {sellerLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : sellerProducts.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <p className="mb-0">You have not published any teas yet. Use the form to add your first product.</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {sellerProducts.map((product: Product) => (
                    <div className="border rounded-3 p-3" key={product.id}>
                      <div className="d-flex flex-column flex-md-row gap-3">
                        <div className="d-flex gap-2 flex-wrap">
                          {product.images.length > 0 ? (
                            product.images.slice(0, 3).map((image) => (
                              <img
                                key={image.id}
                                src={buildImageUrl(image.url) ?? undefined}
                                alt={product.name}
                                className="rounded"
                                style={{ width: 80, height: 80, objectFit: 'cover' }}
                              />
                            ))
                          ) : (
                            <div
                              className="bg-success-subtle text-success d-flex align-items-center justify-content-center rounded"
                              style={{ width: 80, height: 80 }}
                            >
                              No image
                            </div>
                          )}
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                            <div>
                              <h3 className="h5 mb-1">{product.name}</h3>
                              <div className="text-muted small mb-1">Category: {product.category}</div>
                              <div className="fw-semibold text-success mb-2">{formatter.format(product.price)}</div>
                            </div>
                            <div className="text-muted small text-md-end">
                              <div>Stock: {product.stock}</div>
                              <div>Status: {product.isActive ? 'Active' : 'Hidden'}</div>
                              <div>Updated: {formatDate(product.updatedAt ?? product.createdAt)}</div>
                            </div>
                          </div>
                          <p className="text-muted small mb-3">{product.description}</p>
                          <div className="d-flex gap-2">
                            <button className="btn btn-outline-success btn-sm" type="button" onClick={() => handleEditClick(product)}>
                              Edit
                            </button>
                            <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => handleDelete(product.id)} disabled={submitting}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-4 shadow-sm p-4">
              <header className="d-flex flex-column flex-lg-row gap-2 justify-content-between align-items-lg-center mb-3">
                <div>
                  <h2 className="h4 mb-1">Customer orders</h2>
                  <p className="text-muted small mb-0">Monitor purchases that include your teas.</p>
                </div>
                <div className="d-flex gap-2">
                  <span className="badge bg-success-subtle text-success">Orders: {sellerOrders.length}</span>
                  <span className="badge bg-warning-subtle text-warning">Pending: {pendingSellerOrders}</span>
                </div>
              </header>

              {orderFeedback && (
                <div className={`alert alert-${orderFeedback.type === 'success' ? 'success' : 'danger'}`}>
                  {orderFeedback.message}
                </div>
              )}

              {ordersLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : ordersError ? (
                <div className="alert alert-danger" role="alert">
                  {ordersError}
                </div>
              ) : sellerOrders.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <p className="mb-0">No customer orders yet. Your teas will appear here once they are purchased.</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {sellerOrders.map(({ order, sellerItems, sellerQuantity, sellerSubtotal }) => {
                    const badge = statusLabel(order.status);
                    const canProcess = order.status === 'PENDING';
                    return (
                      <div className="border rounded-3 p-3" key={order.id}>
                        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
                          <div>
                            <h3 className="h5 mb-1">Order #{order.id}</h3>
                            <p className="text-muted small mb-1">
                              Placed on {new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                            <p className="text-muted small mb-0">Items for you: {quantityFormatter.format(sellerQuantity)}</p>
                          </div>
                          <div className="d-flex flex-column align-items-lg-end gap-2">
                            <span className={`badge ${badge.className} px-3 py-2`}>{badge.label}</span>
                            <button
                              className="btn btn-success btn-sm"
                              type="button"
                              disabled={!canProcess || processingOrderId === order.id}
                              onClick={() => handleProcessOrder(order.id)}
                            >
                              {processingOrderId === order.id ? 'Processing…' : 'Process order'}
                            </button>
                          </div>
                        </div>

                        <div className="table-responsive">
                          <table className="table table-borderless align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th scope="col">Product</th>
                                <th scope="col" className="text-center">Quantity</th>
                                <th scope="col" className="text-end">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sellerItems.map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <div className="fw-semibold">{item.product.name}</div>
                                    <div className="text-muted small">Category: {item.product.category}</div>
                                  </td>
                                  <td className="text-center">{quantityFormatter.format(item.quantity)}</td>
                                  <td className="text-end">{formatter.format(item.unitPrice * item.quantity)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mt-3 gap-2">
                          <div className="text-muted small">
                            Ship to:
                            <span className="d-block text-dark" style={{ whiteSpace: 'pre-wrap' }}>
                              {order.shippingAddress}
                            </span>
                          </div>
                          <div className="text-lg-end">
                            <span className="text-muted me-2">Subtotal for your items:</span>
                            <strong className="text-success">{formatter.format(sellerSubtotal)}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
