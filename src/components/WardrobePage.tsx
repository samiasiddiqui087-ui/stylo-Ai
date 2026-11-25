import { useMemo, useState } from 'react';
import { Edit2, Heart, ImagePlus, Plus, Search, Shirt, Trash2, X } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { compressImageFileToDataUrl } from '../lib/format.ts';
import type { WardrobeCategory, WardrobeItem } from '../types/immerso.ts';
import { SmartImage } from './SmartImage.tsx';

const WARDROBE_CATEGORIES: WardrobeCategory[] = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Shoes',
  'Bags',
  'Accessories',
  'Jewellery',
];

export function WardrobePage() {
  const {
    user,
    signInWithGoogle,
    wardrobe,
    addWardrobeItem,
    updateWardrobeItem,
    deleteWardrobeItem,
    saveOutfit,
    notify,
  } = useImmerso();

  const [filterCat, setFilterCat] = useState<'All' | WardrobeCategory>('All');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<WardrobeCategory>('Tops');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('Ivory');
  const [season, setSeason] = useState('All Season');
  const [size, setSize] = useState('M');
  const [collectionName, setCollectionName] = useState('Capsule Essentials');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedForCombo, setSelectedForCombo] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wardrobe.filter((item) => {
      if (filterCat !== 'All' && item.category !== filterCat) return false;
      if (q) {
        const hay = `${item.name} ${item.brand || ''} ${item.color} ${item.collectionName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [wardrobe, filterCat, search]);

  const openCreateModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('Tops');
    setBrand('');
    setColor('Ivory');
    setSeason('All Season');
    setSize('M');
    setCollectionName('Capsule Essentials');
    setImageUrl('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (item: WardrobeItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setBrand(item.brand || '');
    setColor(item.color);
    setSeason(item.season);
    setSize(item.size);
    setCollectionName(item.collectionName || '');
    setImageUrl(item.imageUrl || '');
    setNotes(item.notes || '');
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 640, 0.72);
      setImageUrl(compressed);
    } catch {
      notify('Unable to process image file.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      await updateWardrobeItem(editingItem.id, {
        name,
        category,
        brand,
        color,
        season,
        size,
        collectionName,
        imageUrl,
        notes,
      });
    } else {
      await addWardrobeItem({
        name,
        category,
        brand,
        color,
        season,
        size,
        collectionName,
        imageUrl,
        isFavorite: false,
        notes,
      });
    }
    setModalOpen(false);
  };

  const handleSaveCombo = async () => {
    if (selectedForCombo.length < 2) {
      notify('Select at least 2 wardrobe items to save an outfit combination.', 'info');
      return;
    }
    const chosen = wardrobe.filter((w) => selectedForCombo.includes(w.id));
    await saveOutfit({
      title: chosen.map((c) => c.name).slice(0, 2).join(' + '),
      occasion: 'Personal Wardrobe Look',
      season: chosen[0]?.season || 'All Season',
      aesthetic: chosen[0]?.collectionName || 'Curated',
      stylingExplanation: `Combined from your private wardrobe: ${chosen.map((c) => `${c.name} (${c.color})`).join(', ')}.`,
      colorPalette: Array.from(new Set(chosen.map((c) => c.color))),
      productIds: chosen.map((c) => c.id),
      totalEstimatedPkr: 0,
    });
    setSelectedForCombo([]);
  };

  if (!user) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-8 py-20 text-center">
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-10">
          <Shirt className="w-10 h-10 text-[#B5945B] mx-auto mb-4" />
          <h1 className="font-editorial text-4xl font-medium mb-3">Your Private Virtual Wardrobe</h1>
          <p className="text-sm text-[#70685E] max-w-md mx-auto mb-6 leading-relaxed">
            Sign in to upload your personal garments, organize seasonal collections, and let IMMERSO’s AI Stylist pair your existing wardrobe with new luxury pieces.
          </p>
          <button
            onClick={() => void signInWithGoogle()}
            className="px-7 py-3 bg-[#2A231E] text-[#FDFBF7] text-sm font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
          >
            Sign In to Open Wardrobe
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div>
          <p className="text-xs text-[#70685E] mb-1">Private Digital Closet</p>
          <h1 className="font-editorial text-4xl font-medium">My Virtual Wardrobe</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedForCombo.length >= 2 && (
            <button
              onClick={() => void handleSaveCombo()}
              className="px-4 py-2.5 bg-[#B5945B] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Save Look ({selectedForCombo.length} selected)
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Garment</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 border-b border-[#E5DDD0]">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {(['All', ...WARDROBE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                filterCat === cat
                  ? 'bg-[#2A231E] text-[#FDFBF7]'
                  : 'bg-[#F7F3EC] text-[#70685E] hover:text-[#2A231E]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 text-[#70685E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter wardrobe..."
            className="w-full sm:w-56 pl-9 pr-4 py-2 text-xs bg-white border border-[#E5DDD0] rounded-lg"
          />
        </div>
      </div>

      {/* Items Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl mt-8">
          <p className="font-editorial text-2xl mb-2">Your digital closet awaits</p>
          <p className="text-sm text-[#70685E] mb-5">
            Upload photos of tops, dresses, shoes, handbags, or jewellery to organize your wardrobe.
          </p>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg cursor-pointer"
          >
            Add Your First Piece
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {filtered.map((item) => {
            const picked = selectedForCombo.includes(item.id);
            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl overflow-hidden flex flex-col transition-all ${
                  picked ? 'border-[#B5945B] ring-1 ring-[#B5945B]' : 'border-[#E5DDD0]'
                }`}
              >
                <div className="relative aspect-[4/3] bg-[#F7F3EC]">
                  <SmartImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => void updateWardrobeItem(item.id, { isFavorite: !item.isFavorite })}
                    aria-label="Favorite item"
                    className={`absolute top-2.5 right-2.5 p-2 rounded-full border ${
                      item.isFavorite
                        ? 'bg-[#2A231E] text-white border-[#2A231E]'
                        : 'bg-white/90 text-[#2A231E] border-[#E5DDD0]'
                    } cursor-pointer`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] text-[#70685E]">
                      {item.category} · {item.season}
                    </p>
                    <h3 className="font-semibold text-sm text-[#2A231E] mt-0.5">{item.name}</h3>
                    <p className="text-xs text-[#70685E] mt-1">
                      {item.brand ? `${item.brand} · ` : ''}
                      {item.color} · Size {item.size}
                    </p>
                    {item.collectionName && (
                      <p className="text-[11px] text-[#B5945B] mt-1">{item.collectionName}</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E5DDD0] flex items-center justify-between gap-2">
                    <button
                      onClick={() =>
                        setSelectedForCombo((prev) =>
                          prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]
                        )
                      }
                      className="text-xs font-medium text-[#2A231E] hover:underline cursor-pointer"
                    >
                      {picked ? 'Selected ✓' : 'Combine Look'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        aria-label="Edit garment"
                        className="p-1.5 text-[#70685E] hover:text-[#2A231E] cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void deleteWardrobeItem(item.id)}
                        aria-label="Delete garment"
                        className="p-1.5 text-[#70685E] hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2A231E]/50 backdrop-blur-xs">
          <form
            onSubmit={handleSubmit}
            className="bg-[#FDFBF7] border border-[#E5DDD0] rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD0]">
              <h2 className="font-editorial text-2xl font-medium">
                {editingItem ? 'Edit Wardrobe Item' : 'Add Wardrobe Item'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-[#F7F3EC] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="w-20 h-24 rounded-xl overflow-hidden bg-[#F7F3EC] border border-[#E5DDD0] shrink-0">
                <SmartImage src={imageUrl} alt={name || 'Garment'} className="w-full h-full object-cover" />
              </div>
              <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-[#B5945B] rounded-xl text-xs font-medium text-[#2A231E] hover:bg-[#F7F3EC] cursor-pointer">
                <ImagePlus className="w-4 h-4 text-[#B5945B]" />
                <span>Upload Clothing Photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Garment Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Silk Ivory Blouse"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as WardrobeCategory)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
                >
                  {WARDROBE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="IMMERSO / Zara / Khaadi"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Color *</label>
                <input
                  type="text"
                  required
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Season</label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
                >
                  <option>All Season</option>
                  <option>Summer</option>
                  <option>Winter</option>
                  <option>Autumn</option>
                  <option>Spring</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#70685E] mb-1">Size *</label>
                <input
                  type="text"
                  required
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Collection</label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Workwear Capsule"
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs text-[#70685E] mb-1">Styling Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD0] rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#2A231E] text-[#FDFBF7] text-sm font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
            >
              {editingItem ? 'Save Changes' : 'Save to Virtual Wardrobe'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
