import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/cart/CartContext';
import { useProducts } from '../../contexts/products/ProductsContext';
import { buildImageUrl } from '../../lib/api';
import type { Product } from '../../types/shared';
import styles from '../../styles/Customer.module.css';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

const sections = [
  {
    title: 'Herbal Tea',
    products: [
      {
        id: 101,
        name: 'Jasmine Tea',
        price: 55000,
        image: 'https://images.unsplash.com/photo-1527169402691-feff5539e52c?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 102,
        name: 'Black Tea',
        price: 38000,
        image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 103,
        name: 'Chamomile Cup',
        price: 50000,
        image: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 104,
        name: 'White Tea',
        price: 60000,
        image: 'https://images.unsplash.com/photo-1484980859177-5ac1249fda6f?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 105,
        name: 'Oolong Tea',
        price: 55000,
        image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    title: 'Rooibos Tea',
    products: [
      {
        id: 201,
        name: 'Mint Tea',
        price: 50000,
        image: 'https://images.unsplash.com/photo-1527169402691-feff5539e52c?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 202,
        name: 'Honey Oolong',
        price: 40000,
        image: 'https://images.unsplash.com/photo-1527169402691-feff5539e52c?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 203,
        name: 'Silky White',
        price: 48000,
        image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
  {
    title: 'Spiced Chai',
    products: [
      {
        id: 301,
        name: 'Fruit Medley',
        price: 42000,
        image: 'https://images.unsplash.com/photo-1494415859740-21e878dd929d?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 302,
        name: 'Matcha Powder',
        price: 43000,
        image: 'https://images.unsplash.com/photo-1542843137-8791a6904d14?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 303,
        name: 'Green Tea',
        price: 49000,
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 304,
        name: 'Chai Latte',
        price: 35000,
        image: 'https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 305,
        name: 'Tea Sampler',
        price: 45000,
        image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      },
      {
        id: 306,
        name: 'Emerald Green',
        price: 70000,
        image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  },
];

export default function CustomerHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { addItem } = useCart();
  const { catalog, loadCatalog, catalogLoading } = useProducts();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      void router.replace('/auth/login');
      return;
    }
    if (user.role !== 'CUSTOMER') {
      const destination = user.role === 'SELLER' ? '/seller/products' : '/';
      void router.replace(destination);
      return;
    }
    void loadCatalog({ page: 1, limit: 60 });
  }, [user, router, loading, loadCatalog]);

  const heroImages = useMemo(
    () => [
      'https://images.unsplash.com/photo-1496318447583-f524534e9ce1?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1524499982521-1ffd58dd89ea?auto=format&fit=crop&w=1600&q=80',
    ],
    [],
  );

  const fallbackImage = heroImages[0];

  type DisplayProduct = {
    id: number;
    name: string;
    price: number;
    image: string;
    payload: Product;
  };

  const combinedSections = useMemo(() => {
    const map = new Map<string, { title: string; products: DisplayProduct[] }>();
    const order: string[] = [];
    const seenIds = new Set<number>();

    const ensureSection = (title: string) => {
      if (!map.has(title)) {
        map.set(title, { title, products: [] });
        order.push(title);
      }
      return map.get(title)!;
    };

    sections.forEach((section) => {
      const bucket = ensureSection(section.title);
      section.products.forEach((product) => {
        if (seenIds.has(product.id)) {
          return;
        }
        const payload: Product = {
          id: product.id,
          name: product.name,
          description: `${product.name} from ${section.title}`,
          price: product.price,
          category: section.title,
          stock: 100,
          isActive: true,
          sellerId: 0,
          images: [
            {
              id: product.id,
              url: product.image,
            },
          ],
        };
        bucket.products.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          payload,
        });
      });
    });

    catalog.forEach((product) => {
      const title = product.category || 'Other';
      if (!map.has(title)) {
        order.push(title);
        map.set(title, { title, products: [] });
      }
      if (seenIds.has(product.id)) {
        return;
      }
      seenIds.add(product.id);
      map.get(title)!.products.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: buildImageUrl(product.images[0]?.url) ?? fallbackImage,
        payload: product,
      });
    });

    return order.map((title) => map.get(title)!).filter((section) => section.products.length > 0);
  }, [catalog, fallbackImage]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <Image
          src={heroImages[0]}
          alt="Tea Haven"
          fill
          className={styles.heroImage}
          priority
        />
        <div className={styles.heroContent}>
          <span className="tea-badge">Tea Haven</span>
          <h1>Delivering tea to your door</h1>
          <p>We offer fresh teas daily from 9AM to 6PM.</p>
        </div>
      </section>

      {catalogLoading && catalog.length === 0 ? (
        <section className={styles.section}>
          <div className={styles.loading}>Brewing your personalised catalog…</div>
        </section>
      ) : (
        combinedSections.map((section) => (
          <section className={styles.section} key={section.title}>
            <header>
              <h2>{section.title}</h2>
            </header>
            <div className={styles.grid}>
              {section.products.map((product) => (
                <article className={styles.card} key={`${section.title}-${product.id}`}>
                  <div className={styles.imageWrapper}>
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className={styles.cardImage}
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{product.name}</h3>
                    <p className={styles.price}>{rupiah.format(product.price)}</p>
                    <button
                      className={styles.cartButton}
                      type="button"
                      onClick={() => {
                        addItem(product.payload, 1);
                      }}
                    >
                      Add to cart
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
