import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useCart } from '../../contexts/cart/CartContext';
import { useProducts } from '../../contexts/products/ProductsContext';
import { buildImageUrl } from '../../lib/api';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function sanitizeNumber(value: string | string[] | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Array.isArray(value) ? value[0] : value;
  const numeric = Number(parsed);
  return Number.isNaN(numeric) ? undefined : numeric;
}

export default function CatalogPage() {
  const router = useRouter();
  const { catalog, catalogMeta, catalogLoading, loadCatalog } = useProducts();
  const { addItem } = useCart();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const currentPage = useMemo(() => {
    const queryPage = sanitizeNumber(router.query.page);
    return queryPage && queryPage > 0 ? queryPage : 1;
  }, [router.query.page]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const querySearch = router.query.search;
    const queryCategory = router.query.category;
    const queryMin = router.query.minPrice;
    const queryMax = router.query.maxPrice;

    setSearch(typeof querySearch === 'string' ? querySearch : '');
    setCategory(typeof queryCategory === 'string' ? queryCategory : '');
    setMinPrice(typeof queryMin === 'string' ? queryMin : '');
    setMaxPrice(typeof queryMax === 'string' ? queryMax : '');

    loadCatalog({
      page: currentPage,
      limit: 12,
      search: typeof querySearch === 'string' ? querySearch : undefined,
      category: typeof queryCategory === 'string' ? queryCategory : undefined,
      minPrice: sanitizeNumber(queryMin),
      maxPrice: sanitizeNumber(queryMax),
    }).catch(() => undefined);
  }, [router.isReady, router.query.search, router.query.category, router.query.minPrice, router.query.maxPrice, currentPage, loadCatalog]);

  const totalPages = useMemo(() => {
    if (!catalogMeta) {
      return 1;
    }
    return Math.max(1, Math.ceil(catalogMeta.total / catalogMeta.limit));
  }, [catalogMeta]);

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query: Record<string, string> = {};
    if (search.trim()) {
      query.search = search.trim();
    }
    if (category.trim()) {
      query.category = category.trim();
    }
    if (minPrice.trim()) {
      query.minPrice = minPrice.trim();
    }
    if (maxPrice.trim()) {
      query.maxPrice = maxPrice.trim();
    }

    router.push({ pathname: '/catalog', query }, undefined, { shallow: true });
  };

  const handleReset = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    router.push('/catalog', undefined, { shallow: true });
  };

  const handlePageChange = (page: number) => {
    const query = { ...router.query } as Record<string, string>;
    if (page <= 1) {
      delete query.page;
    } else {
      query.page = String(page);
    }
    router.push({ pathname: '/catalog', query }, undefined, { shallow: true });
  };

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="bg-white rounded-4 shadow-sm p-4 p-lg-5">
          <header className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
            <div>
              <h1 className="h3 mb-2">Our Tea Catalog</h1>
              <p className="text-muted mb-0">Filter by flavor, intensity, or price to find your next favourite brew.</p>
            </div>
            <div className="text-muted small text-lg-end">
              Showing <strong>{catalog.length}</strong> of{' '}
              <strong>{catalogMeta?.total ?? catalog.length}</strong> available teas
            </div>
          </header>

          <form className="d-flex flex-column flex-lg-row align-items-stretch gap-3" onSubmit={handleFilterSubmit}>
            <div className="flex-lg-grow-1">
              <label className="form-label" htmlFor="search">
                Search
              </label>
              <input
                id="search"
                className="form-control form-control-lg"
                type="text"
                placeholder="Search by name or description"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex-lg-grow-1">
              <label className="form-label" htmlFor="category">
                Category
              </label>
              <input
                id="category"
                className="form-control form-control-lg"
                type="text"
                placeholder="e.g. Green Tea"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </div>

            <div className="flex-lg-grow-0" style={{ minWidth: 160 }}>
              <label className="form-label" htmlFor="minPrice">
                Min Price
              </label>
              <input
                id="minPrice"
                className="form-control form-control-lg"
                type="number"
                min={0}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
              />
            </div>

            <div className="flex-lg-grow-0" style={{ minWidth: 160 }}>
              <label className="form-label" htmlFor="maxPrice">
                Max Price
              </label>
              <input
                id="maxPrice"
                className="form-control form-control-lg"
                type="number"
                min={0}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>

            <div className="d-flex flex-lg-column justify-content-end gap-2 align-self-end">
              <button className="btn btn-success btn-lg px-4" type="submit">
                Apply
              </button>
              <button className="btn btn-outline-secondary btn-lg" type="button" onClick={handleReset}>
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="col-12">
        <div className="bg-white rounded-4 shadow-sm p-4 p-lg-5">
          {catalogLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mt-3">Brewing the perfect selection…</p>
            </div>
          ) : catalog.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-2">No teas match your current filters.</p>
              <button className="btn btn-success" type="button" onClick={handleReset}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="row g-4">
                {catalog.map((product) => {
                  const imageUrl = buildImageUrl(product.images[0]?.url);
                  return (
                    <div className="col-12 col-md-6 col-lg-4" key={product.id}>
                      <div className="card border-0 shadow-sm h-100">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="card-img-top"
                            style={{ height: 220, objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            className="card-img-top bg-success-subtle d-flex align-items-center justify-content-center"
                            style={{ height: 220 }}
                          >
                            <span className="text-success fw-semibold">Awaiting image</span>
                          </div>
                        )}
                        <div className="card-body d-flex flex-column">
                          <span className="badge bg-success-subtle text-success mb-2">
                            {product.category}
                          </span>
                          <h2 className="h5 text-dark">{product.name}</h2>
                          <p className="text-muted small flex-grow-1">
                            {product.description.substring(0, 140)}
                            {product.description.length > 140 ? '…' : ''}
                          </p>
                          <div className="d-flex justify-content-between align-items-center mt-3">
                            <strong className="text-success">{formatter.format(product.price)}</strong>
                            <span className="text-muted small">Stock: {product.stock}</span>
                          </div>
                        </div>
                        <div className="card-footer bg-white border-0 pt-0 pb-4 px-4">
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-success flex-grow-1"
                              type="button"
                              onClick={() => addItem(product, 1)}
                            >
                              Add to Cart
                            </button>
                            <Link className="btn btn-outline-success" href={`/products/${product.id}`}>
                              Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex justify-content-between align-items-center mt-4">
                <div className="text-muted small">
                  Page {catalogMeta?.page ?? currentPage} of {totalPages}
                </div>
                <div className="btn-group" role="group" aria-label="Pagination">
                  <button
                    className="btn btn-outline-success"
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline-success"
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
