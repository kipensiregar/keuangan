/**
 * INGREDIENT FORM MODAL - Tambah Master Bahan Baku Baru
 * Warung Medan CT Catering
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryRepository } from '../../database/repositories/inventoryRepository';
import { type UnitType, DEFAULT_OFFICIAL_STORES, type Ingredient } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { X, CheckCircle } from 'lucide-react';

interface IngredientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ingredient?: Ingredient | null;
}

export const IngredientFormModal: React.FC<IngredientFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  ingredient = null
}) => {
  const { stores, selectedStoreId, bazarEvents, selectedBazarEventId, showToast } = useApp();
  const availableStores = stores && stores.length > 0 ? stores : DEFAULT_OFFICIAL_STORES;

  const initialStore = selectedStoreId !== 'ALL' ? selectedStoreId : 'store_palembang_center';
  const [storeId, setStoreId] = useState(initialStore);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bumbu & Rempah');
  const [unit, setUnit] = useState<UnitType>('kg');
  const [initialStockInput, setInitialStockInput] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState<'potong' | 'botol' | 'butir' | 'bungkus' | 'pack' | 'unit' | 'ikat' | ''>('');
  const [initialSecondaryInput, setInitialSecondaryInput] = useState('');
  const [minimumSecondaryInput, setMinimumSecondaryInput] = useState('');
  const [minimumStockInput, setMinimumStockInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [defaultSupplier, setDefaultSupplier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(ingredient);

  useEffect(() => {
    if (!isOpen) return;
    if (ingredient) {
      setStoreId(ingredient.storeId);
      setName(ingredient.name);
      setCategory(ingredient.category);
      setUnit(ingredient.unit);
      setMinimumStockInput(String(ingredient.minimumStock ?? 0));
      setMinimumSecondaryInput(String(ingredient.minimumStockSecondary ?? 0));
      setSecondaryUnit((ingredient.secondaryUnit as typeof secondaryUnit) || '');
      setDefaultSupplier(ingredient.defaultSupplier || '');
      setInitialStockInput('');
      setInitialSecondaryInput('');
      setPriceInput('');
    } else {
      setStoreId(selectedStoreId !== 'ALL' ? selectedStoreId : 'store_palembang_center');
      setName('');
      setCategory('Bumbu & Rempah');
      setUnit('kg');
      setInitialStockInput('');
      setSecondaryUnit('');
      setInitialSecondaryInput('');
      setMinimumSecondaryInput('');
      setMinimumStockInput('');
      setPriceInput('');
      setDefaultSupplier('');
    }
  }, [isOpen, ingredient, selectedStoreId]);

  if (!isOpen) return null;

  const initialStock = Math.max(0, parseFloat(initialStockInput) || 0);
  const initialStockSecondary = Math.max(0, parseFloat(initialSecondaryInput) || 0);
  const minimumStockSecondary = Math.max(0, parseFloat(minimumSecondaryInput) || 0);
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
    if (!isEditing && storeId === 'store_bazar' && !selectedBazarEventId) {
      showToast('Pilih event bazar terlebih dahulu pada dropdown Stok.', 'error');
      return;
    }
    if (!isEditing && purchasePrice <= 0) {
      showToast('Harga beli satuan harus lebih dari Rp0', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (ingredient) {
        await inventoryRepository.updateIngredient(ingredient.id, {
          name: name.trim(),
          category,
          minimumStock,
          minimumStockSecondary,
          defaultSupplier: defaultSupplier.trim() || undefined
        });
        showToast(`Data bahan "${name}" berhasil diperbarui. Saldo stok dan riwayat tetap aman.`, 'success');
      } else {
        await inventoryRepository.createIngredient({
          storeId,
          eventId: storeId === 'store_bazar' && selectedBazarEventId ? selectedBazarEventId : undefined,
          secondaryUnit: secondaryUnit || undefined,
          initialStockSecondary,
          minimumStockSecondary,
          name: name.trim(),
          category,
          unit,
          initialStock,
          minimumStock,
          purchasePrice,
          defaultSupplier: defaultSupplier.trim() || undefined
        });
        showToast(`Bahan baku "${name}" berhasil ditambahkan ke master!`, 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`Gagal menambahkan bahan: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {isEditing ? 'Edit Master Bahan Baku' : 'Tambah Master Bahan Baku'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing ? 'Perbarui data master tanpa mengubah saldo dan riwayat stok' : 'Warung Medan CT Catering · Pengelolaan stok dapur'}
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
              disabled={isEditing}
              onChange={(e) => setStoreId(e.target.value)}
              className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white text-slate-900"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Event Bazar</label>
              <select value={selectedBazarEventId} disabled={!bazarEvents.length} onChange={() => {}} className="box-border w-full min-w-0 h-10 px-3 rounded-xl border border-slate-300 text-xs bg-slate-50">
                {selectedBazarEventId ? bazarEvents.filter((event) => event.id === selectedBazarEventId).map((event) => <option key={event.id} value={event.id}>{event.name}</option>) : <option value="">Pilih event dari dropdown modul Stok</option>}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Stok baru akan terikat pada event yang sedang dipilih.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Bahan Baku</label>
            <input type="text" required placeholder="Contoh: Daun Ubi Segar, Lokio, Asam Gelugur"
              value={name} onChange={(e) => setName(e.target.value)}
              className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#800020]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white font-medium">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan Ukuran</label>
              <select value={unit} disabled={isEditing} onChange={(e) => setUnit(e.target.value as UnitType)}
                className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white font-medium">
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {!isEditing && <>
            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan Kedua (Opsional)</label>
                <select value={secondaryUnit} onChange={(e) => setSecondaryUnit(e.target.value as typeof secondaryUnit)}
                  className="box-border w-full min-w-0 h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white">
                  <option value="">Tidak pakai satuan kedua</option>
                  {(['potong','botol','butir','bungkus','pack','unit','ikat'] as const).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {secondaryUnit && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Stok Awal ({secondaryUnit})</label>
                  <input type="number" min="0" step="any" value={initialSecondaryInput} onChange={(e) => setInitialSecondaryInput(e.target.value)} className="box-border w-full min-w-0 h-10 px-3 rounded-xl border border-slate-300 text-sm" placeholder="0" /></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Batas Minimum ({secondaryUnit})</label>
                  <input type="number" min="0" step="any" value={minimumSecondaryInput} onChange={(e) => setMinimumSecondaryInput(e.target.value)} className="box-border w-full min-w-0 h-10 px-3 rounded-xl border border-slate-300 text-sm" placeholder="0" /></div>
              </div>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Stok Awal ({unit})</label>
                <input type="number" step="any" min="0" placeholder="0" value={initialStockInput} onChange={(e) => setInitialStockInput(e.target.value)}
                  className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]" /></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Batas Minimum ({unit})</label>
                <input type="number" step="any" min="0" placeholder="Contoh: 5" value={minimumStockInput} onChange={(e) => setMinimumStockInput(e.target.value)}
                  className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]" /></div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Beli Satuan (Rp / {unit})</label>
              <input type="text" inputMode="numeric" required placeholder="0" value={priceInput ? formatRupiah(purchasePrice) : ''}
                onChange={(e) => setPriceInput(e.target.value)}
                className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]" />
            </div>
          </>}

          {isEditing && <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Batas Minimum ({unit})</label>
                <input type="number" step="any" min="0" value={minimumStockInput} onChange={(e) => setMinimumStockInput(e.target.value)}
                  className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]" /></div>
              {secondaryUnit && <div><label className="block text-xs font-semibold text-slate-700 mb-1">Batas Minimum ({secondaryUnit})</label>
                <input type="number" step="any" min="0" value={minimumSecondaryInput} onChange={(e) => setMinimumSecondaryInput(e.target.value)}
                  className="box-border w-full min-w-0 h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#800020]" /></div>}
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              Stok saat ini: <strong>{ingredient?.currentStock} {ingredient?.unit}</strong>
              {ingredient?.secondaryUnit ? ` + ${ingredient.currentStockSecondary || 0} ${ingredient.secondaryUnit}` : ''}.
              Saldo stok, satuan, dan harga rata-rata tidak diubah dari form edit ini.
            </div>
          </>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Rekomendasi (Opsional)</label>
            <input type="text" placeholder="Contoh: Toko Rempah Berastagi" value={defaultSupplier}
              onChange={(e) => setDefaultSupplier(e.target.value)}
              className="box-border w-full min-w-0 h-10 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]" />
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
              <span>{isSubmitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Bahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
