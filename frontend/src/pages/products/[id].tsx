import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useCart } from '../../contexts/cart/CartContext';
import { useProducts } from '../../contexts/products/ProductsContext';
import { buildImageUrl } from '../../lib/api';
import type { Product, ProductImage } from '../../types/shared';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export default function ProductDetailPage() {
  const router = useRouter();
  const { fetchProduct } = useProducts();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const productId = useMemo(() => {
    const raw = router.query.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }, [router.query.id]);

  useEffect(() => {
    if (!router.isReady || productId == null) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      const data = await fetchProduct(productId);
      if (data) {
        setProduct(data);
      } else {
        setError('Product not found.');
      }
      setLoading(false);
    };

    load().catch(() => {
      setError('Unable to load product. Please try again later.');
      setLoading(false);
    });
  }, [router.isReady, productId, fetchProduct]);

  const handleAddToCart = () => {
    if (!product) {
      return;
    }
    const safeQuantity = Math.min(quantity, product.stock);
    addItem(product, safeQuantity);
  };

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value) || value < 1) {
      setQuantity(1);
      return;
    }
    if (product) {
      setQuantity(Math.min(value, product.stock));
      return;
    }
    setQuantity(value);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-5">
        <p className="text-muted mb-3">{error ?? 'Product not found.'}</p>
        <Link className="btn btn-success" href="/catalog">
          Back to catalog
        </Link>
      </div>
    );
  }

  const primaryImage = buildImageUrl(product.images[0]?.url);
  const gallery = product.images.slice(1);

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="bg-white rounded-4 shadow-sm p-4 h-100">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              className="img-fluid rounded-4 mb-3"
              style={{ width: '100%', height: 'auto' }}
            />
          ) : (
            <div className="bg-success-subtle text-success d-flex align-items-center justify-content-center rounded-4 mb-3" style={{ minHeight: 320 }}>
              No image available
            </div>
          )}
          {gallery.length > 0 && (
            <div className="d-flex gap-2 flex-wrap">
              {gallery.map((image: ProductImage) => (
                <img
                  key={image.id}
                  src={buildImageUrl(image.url) ?? undefined}
                  alt={product.name}
                  className="rounded"
                  style={{ width: 96, height: 96, objectFit: 'cover' }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="col-lg-6">
        <div className="bg-white rounded-4 shadow-sm p-4 h-100 d-flex flex-column gap-3">
          <div>
            <span className="badge bg-success-subtle text-success mb-2">{product.category}</span>
            <h1 className="h3 mb-2">{product.name}</h1>
            <p className="text-muted">Sold by seller #{product.sellerId}</p>
          </div>

          <p className="text-muted flex-grow-1">{product.description}</p>

          <div className="d-flex align-items-center gap-3">
            <strong className="display-6 text-success mb-0">{formatter.format(product.price)}</strong>
            <span className="text-muted">Stock available: {product.stock}</span>
          </div>

          <div className="d-flex align-items-center gap-3">
            <input
              className="form-control"
              style={{ maxWidth: 120 }}
              type="number"
              min={1}
              max={product.stock}
              value={quantity}
              onChange={handleQuantityChange}
            />
            <button className="btn btn-success btn-lg flex-grow-1" type="button" onClick={handleAddToCart}>
              Add to cart
            </button>
            <Link className="btn btn-outline-success" href="/cart">
              View cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
