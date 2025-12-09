import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../AuthContext';
import type { PaginatedResponse, Product } from '../../types/shared';
import { DEFAULT_CATALOG } from '../../data/defaultCatalog';

export interface CatalogQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface ProductsContextValue {
  catalog: Product[];
  catalogMeta: PaginatedResponse<Product>['meta'] | null;
  catalogLoading: boolean;
  loadCatalog: (query?: CatalogQuery) => Promise<void>;
  sellerProducts: Product[];
  sellerLoading: boolean;
  loadSellerProducts: () => Promise<void>;
  fetchProduct: (productId: number) => Promise<Product | null>;
  createProduct: (payload: FormData) => Promise<Product>;
  updateProduct: (productId: number, payload: FormData) => Promise<Product>;
  deleteProduct: (productId: number) => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { api } = useAuth();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<PaginatedResponse<Product>['meta'] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [sellerLoading, setSellerLoading] = useState(false);

  const buildFallbackCatalog = useCallback((query: CatalogQuery = {}) => {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      minPrice,
      maxPrice,
    } = query;

    const searchTerm = search?.trim().toLowerCase();
    const categoryFilter = category?.trim().toLowerCase();
    const filtered = DEFAULT_CATALOG.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm);
      const matchesCategory =
        !categoryFilter || item.category.toLowerCase() === categoryFilter;
      const matchesMin =
        minPrice === undefined || Number(item.price) >= Number(minPrice);
      const matchesMax =
        maxPrice === undefined || Number(item.price) <= Number(maxPrice);
      return matchesSearch && matchesCategory && matchesMin && matchesMax;
    });

    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      data: paginated,
      meta: {
        page,
        limit,
        total: filtered.length,
      },
    };
  }, []);

  const loadCatalog = useCallback(
    async (query?: CatalogQuery) => {
      setCatalogLoading(true);
      try {
        const { data } = await api.get<PaginatedResponse<Product>>('/products', {
          params: query,
        });
        if (data.data.length === 0) {
          const fallback = buildFallbackCatalog(query ?? {});
          setCatalog(fallback.data);
          setCatalogMeta(fallback.meta);
        } else {
          setCatalog(data.data);
          setCatalogMeta(data.meta);
        }
      } catch {
        const fallback = buildFallbackCatalog(query ?? {});
        setCatalog(fallback.data);
        setCatalogMeta(fallback.meta);
      } finally {
        setCatalogLoading(false);
      }
    },
    [api, buildFallbackCatalog],
  );

  const loadSellerProducts = useCallback(async () => {
    setSellerLoading(true);
    try {
      const { data } = await api.get<Product[]>('/products/seller/me');
      setSellerProducts(data);
    } finally {
      setSellerLoading(false);
    }
  }, [api]);

  const fetchProduct = useCallback(
    async (productId: number) => {
      try {
        const { data } = await api.get<Product>(`/products/${productId}`);
        return data;
      } catch (error) {
        return null;
      }
    },
    [api],
  );

  const createProduct = useCallback(
    async (payload: FormData) => {
      const { data } = await api.post<Product>('/products', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSellerProducts((prev: Product[]) => [data, ...prev]);
      setCatalog((prev: Product[]) => [data, ...prev.filter((item) => item.id !== data.id)]);
      return data;
    },
    [api],
  );

  const updateProduct = useCallback(
    async (productId: number, payload: FormData) => {
      const { data } = await api.patch<Product>(`/products/${productId}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSellerProducts((prev: Product[]) =>
        prev.map((item: Product) => (item.id === data.id ? data : item)),
      );
      setCatalog((prev: Product[]) =>
        prev.map((item: Product) => (item.id === data.id ? data : item)),
      );
      return data;
    },
    [api],
  );

  const deleteProduct = useCallback(
    async (productId: number) => {
      await api.delete(`/products/${productId}`);
      setSellerProducts((prev: Product[]) =>
        prev.filter((item: Product) => item.id !== productId),
      );
      setCatalog((prev: Product[]) =>
        prev.filter((item: Product) => item.id !== productId),
      );
    },
    [api],
  );

  const value = useMemo<ProductsContextValue>(
    () => ({
      catalog,
      catalogMeta,
      catalogLoading,
      loadCatalog,
      sellerProducts,
      sellerLoading,
      loadSellerProducts,
      fetchProduct,
      createProduct,
      updateProduct,
      deleteProduct,
    }),
    [
      catalog,
      catalogMeta,
      catalogLoading,
      loadCatalog,
      sellerProducts,
      sellerLoading,
      loadSellerProducts,
      fetchProduct,
      createProduct,
      updateProduct,
      deleteProduct,
    ],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
