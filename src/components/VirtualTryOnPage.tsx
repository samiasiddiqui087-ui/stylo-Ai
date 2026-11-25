import { useState } from 'react';
import { Bookmark, ImagePlus, Info, Share2, Sparkles, Trash2 } from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { compressImageFileToDataUrl, formatPkr } from '../lib/format.ts';
import { parseJsonResponse, toFriendlyNetworkError } from '../lib/http.ts';
import { SmartImage } from './SmartImage.tsx';

export function VirtualTryOnPage() {
  const {
    products,
    user,
    tryOnHistory,
    saveTryOnResult,
    deleteTryOnResult,
    addToCart,
    notify,
  } = useImmerso();

  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [userPhoto, setUserPhoto] = useState('');
  const [previewResult, setPreviewResult] = useState<{
    previewDataUrl: string;
    disclaimer: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 768, 0.8);
      setUserPhoto(compressed);
      setPreviewResult(null);
      setErrorMsg('');
    } catch {
      notify('Unable to read the selected image.', 'error');
    }
  };

  const handleGenerateTryOn = async () => {
    if (!userPhoto || !selectedProduct) {
      setErrorMsg('Please upload your photo and select an IMMERSO piece first.');
      return;
    }
    setGenerating(true);
    setErrorMsg('');

    try {
      const resp = await fetch('/api/ai/virtual-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPhotoBase64: userPhoto,
          userPhotoMimeType: 'image/jpeg',
          product: selectedProduct,
        }),
      });
      const data = await parseJsonResponse<{
        previewDataUrl?: string;
        disclaimer?: string;
        error?: string;
      }>(resp, 'Virtual try-on generation failed.');
      if (!resp.ok || !data.previewDataUrl) {
        throw new Error(data.error || 'Virtual try-on generation failed.');
      }
      setPreviewResult({
        previewDataUrl: data.previewDataUrl,
        disclaimer:
          data.disclaimer ||
          'Illustrative AI preview only. Actual garment fit and drape may differ.',
      });
    } catch (err) {
      setErrorMsg(toFriendlyNetworkError(err, 'Virtual try-on unavailable.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-10">
      <div className="border-b border-[#E5DDD0] pb-6">
        <p className="text-xs text-[#70685E] mb-1">Gemini Image Studio</p>
        <h1 className="font-editorial text-4xl font-medium">AI Virtual Try-On</h1>
        <p className="text-sm text-[#70685E] mt-2 max-w-2xl">
          Upload a clear portrait or full-length photo, choose a piece from IMMERSO, and preview how the silhouette styles on you. Generated previews are illustrative and may not accurately represent actual garment fit.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="lg:col-span-5 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-medium text-[#70685E]">1. Your Photo</label>
              {userPhoto && (
                <button
                  onClick={() => {
                    setUserPhoto('');
                    setPreviewResult(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Uploaded Photo</span>
                </button>
              )}
            </div>

            <label className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-[#B5945B] rounded-xl bg-[#FDFBF7] hover:bg-[#F7F3EC] transition-colors cursor-pointer">
              <ImagePlus className="w-6 h-6 text-[#B5945B]" />
              <span className="text-xs font-medium">
                {userPhoto ? 'Replace Photo' : 'Upload Personal Photo'}
              </span>
              <span className="text-[11px] text-[#70685E]">
                Processed privately · You can delete anytime
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#70685E] mb-2">
              2. Select IMMERSO Garment
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPkr(p.pricePkr)}
                </option>
              ))}
            </select>

            {selectedProduct && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-[#F7F3EC] rounded-xl border border-[#E5DDD0]">
                <div className="w-14 h-16 rounded-lg overflow-hidden shrink-0">
                  <SmartImage
                    src={selectedProduct.images[0]}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{selectedProduct.name}</p>
                  <p className="text-xs font-mono-num text-[#70685E]">
                    {formatPkr(selectedProduct.pricePkr)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={() => void handleGenerateTryOn()}
            disabled={generating || !userPhoto}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#3F352E] disabled:opacity-45 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#B5945B]" />
            <span>{generating ? 'Rendering AI Preview...' : 'Generate Virtual Try-On'}</span>
          </button>
        </div>

        {/* Before / After Comparison */}
        <div className="lg:col-span-7 bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-5">
          <h2 className="font-editorial text-2xl font-medium">Original vs. AI Preview</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#70685E]">Original Photo</p>
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#F7F3EC] border border-[#E5DDD0] flex items-center justify-center">
                {userPhoto ? (
                  <img src={userPhoto} alt="Original upload" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-[#70685E]">Upload a photo on the left</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#70685E]">AI Generated Preview</p>
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#F7F3EC] border border-[#E5DDD0] flex items-center justify-center">
                {previewResult ? (
                  <img
                    src={previewResult.previewDataUrl}
                    alt="Virtual try-on preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#70685E] px-6 text-center">
                    {generating
                      ? 'Synthesizing garment drape and lighting...'
                      : 'Your illustrative try-on preview will appear here'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {previewResult && (
            <div className="space-y-3 pt-2 border-t border-[#E5DDD0]">
              <p className="text-xs text-[#70685E]">{previewResult.disclaimer}</p>
              <div className="flex flex-wrap gap-2.5">
                {user && selectedProduct && (
                  <button
                    onClick={() =>
                      void saveTryOnResult({
                        productId: selectedProduct.id,
                        productName: selectedProduct.name,
                        previewDataUrl: previewResult.previewDataUrl,
                        disclaimer: previewResult.disclaimer,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2A231E] text-[#FDFBF7] text-xs font-medium rounded-lg cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save Look</span>
                  </button>
                )}
                {selectedProduct && (
                  <button
                    onClick={() =>
                      addToCart(selectedProduct, selectedProduct.sizes[0], selectedProduct.colors[0], 1)
                    }
                    className="px-4 py-2 bg-[#B5945B] text-white text-xs font-medium rounded-lg cursor-pointer"
                  >
                    Add Piece to Bag
                  </button>
                )}
                <a
                  href={previewResult.previewDataUrl}
                  download={`immerso-tryon-${selectedProduct?.sku || 'look'}.png`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#E5DDD0] text-xs font-medium rounded-lg hover:bg-[#F7F3EC]"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Download Preview</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Try-On Gallery */}
      {user && tryOnHistory.length > 0 && (
        <div className="pt-8 border-t border-[#E5DDD0]">
          <h2 className="font-editorial text-2xl font-medium mb-4">Saved Try-On Previews</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {tryOnHistory.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden"
              >
                <div className="aspect-[3/4] bg-[#F7F3EC]">
                  <img
                    src={item.previewDataUrl}
                    alt={item.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate">{item.productName}</p>
                  <button
                    onClick={() => void deleteTryOnResult(item.id)}
                    aria-label="Delete preview"
                    className="p-1.5 text-[#70685E] hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
