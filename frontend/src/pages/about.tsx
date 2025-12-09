export default function AboutPage() {
  return (
    <div className="bg-white rounded-4 shadow-sm p-5">
      <h1 className="h3 mb-3">About Tea Haven</h1>
      <p className="text-muted">
        Tea Haven connects specialty tea artisans with enthusiasts across Indonesia. Sellers can showcase their signature
        blends, while customers discover new favourites, manage orders, and enjoy a seamless shopping experience.
      </p>
      <p className="text-muted mb-0">
        This marketplace is built with NestJS, Prisma, and Next.js as part of a final project brief. Features include
        role-based authentication, secure product management, order processing, and email notifications to keep everyone
        informed.
      </p>
    </div>
  );
}
