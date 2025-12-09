import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { CartItem, OrderDraft, Product } from '../../types/shared';

const STORAGE_KEY = 'teahaven_cart';

interface CartState {
  items: CartItem[];
}

interface CartContextValue extends CartState {
  addItem: (product: Product, quantity?: number) => void;
  updateItem: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  toOrderPayload: (shippingAddress: string) => OrderDraft;
}

type CartAction =
  | { type: 'UPSERT'; payload: { product: Product; quantity: number } }
  | { type: 'UPDATE'; payload: { productId: number; quantity: number } }
  | { type: 'REMOVE'; payload: { productId: number } }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'UPSERT': {
      const { product, quantity } = action.payload;
      const existing = state.items.find((item) => item.productId === product.id);
      const nextQuantity = Math.max(1, (existing?.quantity ?? 0) + quantity);
      const nextItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: nextQuantity,
        imageUrl: product.images[0]?.url ?? null,
        sellerId: product.sellerId,
      };

      const items = existing
        ? state.items.map((item) =>
            item.productId === product.id ? nextItem : item,
          )
        : [...state.items, nextItem];

      return { items };
    }
    case 'UPDATE': {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          items: state.items.filter((item) => item.productId !== productId),
        };
      }

      return {
        items: state.items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(1, quantity) }
            : item,
        ),
      };
    }
    case 'REMOVE': {
      const { productId } = action.payload;
      return {
        items: state.items.filter((item) => item.productId !== productId),
      };
    }
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

function loadInitialCart(): CartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) =>
      item && typeof item.productId === 'number' && item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function initState(): CartState {
  return { items: loadInitialCart() };
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, initState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    dispatch({ type: 'UPSERT', payload: { product, quantity } });
  }, []);

  const updateItem = useCallback((productId: number, quantity: number) => {
    dispatch({ type: 'UPDATE', payload: { productId, quantity } });
  }, []);

  const removeItem = useCallback((productId: number) => {
    dispatch({ type: 'REMOVE', payload: { productId } });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const toOrderPayload = useCallback(
    (shippingAddress: string): OrderDraft => ({
      shippingAddress,
      items: state.items.map((item: CartItem) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }),
    [state.items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      addItem,
      updateItem,
      removeItem,
      clear,
      toOrderPayload,
    }),
    [state.items, addItem, updateItem, removeItem, clear, toOrderPayload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
