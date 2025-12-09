export type Role = 'CUSTOMER' | 'SELLER';

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface ProductImage {
  id: number;
  url: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  isActive: boolean;
  sellerId: number;
  images: ProductImage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  meta: {
    page: number;
    limit: number;
    total: number;
  };
  data: T[];
}

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  sellerId: number;
}

export interface OrderDraftItem {
  productId: number;
  quantity: number;
}

export interface OrderDraft {
  shippingAddress: string;
  items: OrderDraftItem[];
}

export interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  product: {
    id: number;
    name: string;
    category: string;
    sellerId: number;
    sellerName: string;
  };
}

export interface Order {
  id: number;
  status: OrderStatus;
  shippingAddress: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
