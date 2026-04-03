'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CategoryList() {
  const [categories, setCategories] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('cat') ?? 'Tout';

  useEffect(() => {
    fetch('/api/produits')
      .then((r) => r.json())
      .then((data) => {
        const cats = Array.from(
          new Set<string>(
            (data.data ?? []).map((p: { categorie: string }) => p.categorie)
          )
        );
        setCategories(cats);
      })
      .catch(() => {});
  }, []);

  const tabs = ['Tout', ...categories];

  const handleClick = (cat: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat === 'Tout') {
      params.delete('cat');
    } else {
      params.set('cat', cat);
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : '/', { scroll: false });
  };

  return (
    <nav className="space-y-0.5">
      {tabs.map((cat) => (
        <button
          key={cat}
          onClick={() => handleClick(cat)}
          className={`w-full text-left px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 ${
            activeCategory === cat
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {cat}
        </button>
      ))}
    </nav>
  );
}

function CategorySkeleton() {
  return (
    <div className="space-y-1.5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-8 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export default function DesktopCategorySidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-44 xl:w-52 shrink-0">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-20">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
          Catégories
        </p>
        <Suspense fallback={<CategorySkeleton />}>
          <CategoryList />
        </Suspense>
      </div>
    </aside>
  );
}
