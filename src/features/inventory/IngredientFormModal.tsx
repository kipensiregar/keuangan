/**
 * INGREDIENT FORM MODAL - Tambah Master Bahan Baku Baru
 * Warung Medan CT Catering
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryRepository } from '../../database/repositories/inventoryRepository';
import { type UnitType, DEFAULT_OFFICIAL_STORES } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { X, CheckCircle } from 'lucide-react';

interface IngredientFormModalProps {
  isOpen: boolean;
  ingredient?: import('../../types').Ingredient | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const IngredientFormModal: React.FC<IngredientFormModalProps> = ({
  isOpen,
  ingredient,
  onClose,
  onSuccess
}) => {
  const { stores, selectedStoreId, showToast } = useApp();
  const availableStores = stores && stores.length > 0 ? stores : DEFAULT_OFFICIAL_STORES;

  const initialStore = selectedStoreId !== 'ALL' ? selectedStoreId : 'store_palembang_center';
  const [storeId, setStoreId] = useState(initialStore);
  const [bazarArea, setBazarArea] = useState<'A' | 'B' | ''>('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bumbu & Rempah');
  const [unit, setUnit] = useState<UnitType>('kg');
  const [initialStockInput, setInitialStockInput] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState<UnitType | ''>('');
  const [initialSecondaryStockInput, setInitialSecondaryStockInput] = useState('');
  const [minimumStockInput, setMinimumStockInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [defaultSupplier, setDefaultSupplier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (ingredient) {
      setStoreId(ingredient.storeId);
      setBazarArea(ingredient.bazarArea || '');
      setName(ingredient.name);
      setCategory(ingredient.category);
      setUnit(ingredient.unit);
      setInitialStockInput(String(ingredient.initialStock ?? 0));
      setSecondaryUnit(ingredient.secondaryUnit || '');
      setInitialSecondaryStockInput(String(ingredient.currentSecondaryStock ?? ingredient.initialSecondaryStock ?? 0));
      setMinimumStockInput(String(ingredient.minimumStock ?? 0));
      setPriceInput(String(ingredient.averagePurchasePrice ?? 0));
      setDefaultSupplier(ingredient.defaultSupplier || '');
    } else {
      setStoreId(initialStore);
      setBazarArea(''); setName(''); setCategory('Bumbu & Rempah'); setUnit('kg');
      setInitialStockInput(''); setSecondaryUnit(''); setInitialSecondaryStockInput('');
      setMinimumStockInput(''); setPriceInput(''); setDefaultSupplier('');
    }
  }, [isOpen, ingredient?.id]);

  if (!isOpen) return null;

  const initialStock = Math.max(0, parseFloat(initialStockInput) || 0);
  const initialSecondaryStock = Math.max(0, parseFloat(initialSecondaryStockInput) || 0);
  const minimumStock = Math.max(0, parseFloat(minimumStockInput) || 0);
  const purchasePrice = Math.max(0, parseInt(priceInput.replace(/\D/g, ''), 10) || 0);

  const units: UnitType[] = ['kg', 'gram', 'liter', 'ml', 'butir', 'potong', 'bungkus', 'pack', 'unit', 'ikat'];
  const categories = [
    'Bumbu Khas Batak',
    'Bumbu & Rempah',
    'Daging & Unggas',
    'Ikan Air Tawar',
    'Bahan Pokok',
    'Sayuran Segar',
    'Kemasan & Wadah',
    'Lain-lain'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama bahan baku wajib diisi', 'error');
      return;
    }
    if (purchasePrice <= 0) {
      showToast('Harga beli satuan harus lebih dari Rp0', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (ingredient) {
        await inventoryRepository.updateIngredient(ingredient.id, {
          name: name.trim(), category, unit, minimumStock, purchasePrice,
          defaultSupplier: defaultSupplier.trim() || undefined,
          bazarArea: storeId === 'store_bazar' && bazarArea ? bazarArea as 'A' | 'B' : undefined,
          secondaryUnit: secondaryUnit || undefined,
          initialSecondaryStock
        });
        showToast(`Master bahan "${name}" berhasil diperbarui!`, 'success');
      } else {
        await inventoryRepository.createIngredient({
          storeId, name: name.trim(), category, unit, initialStock, minimumStock, purchasePrice,
          defaultSupplier: defaultSupplier.trim() || undefined,
          bazarArea: storeId === 'store_bazar' && bazarArea ? bazarArea as 'A' | 'B' : undefined,
          secondaryUnit: secondaryUnit || undefined, initialSecondaryStock
        });
        showToast(`Bahan baku "${name}" berhasil ditambahkan ke master!`, 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`Gagal menyimpan master bahan: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {ingredient ? 'Edit Master Bahan Baku' : 'Tambah Master Bahan Baku'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Warung Medan CT Catering · Pengelolaan stok dapur
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit Cabang Penyimpanan *
            </label>
            <select
              value={storeId}
              disabled={!!ingredient}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white text-slate-900"
            >
              {availableStores.map((s) => (
                <option key={s.id} value={s.id} className="text-slate-900 bg-white">
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {storeId === 'store_bazar' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Area Bazar</label>
              <select value={bazarArea} onChange={(e) => setBazarArea(e.target.value as 'A' | 'B' | '')} className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm bg-white">
                <option value="">Stok umum / belum dipisah</option><option value="A">Bazar A</option><option value="B">Bazar B</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Bahan Baku
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Daun Ubi Segar, Lokio, Asam Gelugur"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white font-medium"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Satuan Ukuran
              </label>
              <select
                value={unit}
                disabled={!!ingredient}
                onChange={(e) => setUnit(e.target.value as UnitType)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white font-medium"
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {ingredient && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batas Minimum Stok ({unit})</label>
              <input type="number" step="any" min="0" value={minimumStockInput} onChange={(e) => setMinimumStockInput(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono" />
            </div>
          )}

          {!ingredient && <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stok Awal ({unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={initialStockInput}
                onChange={(e) => setInitialStockInput(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Minimum ({unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Contoh: 5"
                value={minimumStockInput}
                onChange={(e) => setMinimumStockInput(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]"
              />
            </div>
          </div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan Tambahan (Opsional)</label>
              <select value={secondaryUnit} disabled={!!ingredient} onChange={(e) => setSecondaryUnit(e.target.value as UnitType | '')} className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs bg-white disabled:bg-slate-100">
                <option value="">Tidak ada</option>{units.filter((u) => u !== unit).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{ingredient ? 'Stok Tambahan (ubah lewat pergerakan stok)' : 'Stok Awal Tambahan'} ({secondaryUnit || 'satuan'})</label>
              <input type="number" step="any" min="0" disabled={!secondaryUnit || !!ingredient} value={initialSecondaryStockInput} onChange={(e) => setInitialSecondaryStockInput(e.target.value)} placeholder="Contoh: 48" className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono disabled:bg-slate-100" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Harga Beli Satuan (Rp / {unit})
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="0"
              value={priceInput ? formatRupiah(purchasePrice) : ''}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier Rekomendasi (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Toko Rempah Berastagi"
              value={defaultSupplier}
              onChange={(e) => setDefaultSupplier(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#800020] text-xs font-bold text-white hover:bg-[#660019] shadow-sm disabled:opacity-50 min-h-[44px] flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : ingredient ? 'Simpan Perubahan' : 'Simpan Bahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
