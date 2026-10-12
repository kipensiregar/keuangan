/**
 * PRODUCTS & MENU VIEW - Master Menu Warung Medan & CT Catering
 * Dilengkapi fitur Tambah, Edit, Ubah Status Aktif, dan Hapus Menu
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { productRepository } from '../../database/repositories/productRepository';
import type { ProductMenu } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Plus, Utensils, CheckCircle, X, Edit3, Trash2, AlertTriangle, Search, Filter } from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { products, refreshData, showToast } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductMenu['category']>('Lauk Utama');
  const [sellingPriceInput, setSellingPriceInput] = useState('');
  const [hppInput, setHppInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [productToEdit, setProductToEdit] = useState<ProductMenu | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<ProductMenu['category']>('Lauk Utama');
  const [editSellingPriceInput, setEditSellingPriceInput] = useState('');
  const [editHppInput, setEditHppInput] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState<ProductMenu | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sellingPrice = Math.max(0, parseInt(sellingPriceInput.replace(/\D/g, ''), 10) || 0);
  const estimatedHpp = hppInput ? Math.max(0, parseInt(hppInput.replace(/\D/g, ''), 10) || 0) : undefined;

  const editSellingPrice = Math.max(0, parseInt(editSellingPriceInput.replace(/\D/g, ''), 10) || 0);
  const editEstimatedHpp = editHppInput ? Math.max(0, parseInt(editHppInput.replace(/\D/g, ''), 10) || 0) : undefined;

  // Filtered products
  const categoriesList: Array<ProductMenu['category']> = [
    'Lauk Utama',
    'Sayur & Pelengkap',
    'Mie & Sarapan',
    'Paket Catering',
    'Minuman'
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama menu wajib diisi', 'error');
      return;
    }
    if (sellingPrice <= 0) {
      showToast('Harga jual harus lebih dari Rp0', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await productRepository.create({
        name: name.trim(),
        category,
        sellingPrice,
        estimatedHpp,
        notes: notes.trim() || undefined
      });

      showToast(`Menu "${name}" berhasil ditambahkan!`, 'success');
      setIsAddModalOpen(false);
      setName('');
      setSellingPriceInput('');
      setHppInput('');
      setNotes('');
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal menambahkan menu: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (p: ProductMenu) => {
    setProductToEdit(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditSellingPriceInput(p.sellingPrice.toString());
    setEditHppInput(p.estimatedHpp ? p.estimatedHpp.toString() : '');
    setEditNotes(p.notes || '');
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit) return;

    if (!editName.trim()) {
      showToast('Nama menu wajib diisi', 'error');
      return;
    }
    if (editSellingPrice <= 0) {
      showToast('Harga jual harus lebih dari Rp0', 'error');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await productRepository.update(productToEdit.id, {
        name: editName.trim(),
        category: editCategory,
        sellingPrice: editSellingPrice,
        estimatedHpp: editEstimatedHpp,
        notes: editNotes.trim() || undefined
      });

      showToast(`Menu "${editName}" berhasil diperbarui!`, 'success');
      setProductToEdit(null);
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal memperbarui menu: ${err.message}`, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    try {
      setIsDeleting(true);
      await productRepository.delete(productToDelete.id);
      showToast(`Menu "${productToDelete.name}" berhasil dihapus`, 'success');
      setProductToDelete(null);
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal menghapus menu: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await productRepository.toggleActive(id, !currentStatus);
      showToast('Status menu berhasil diperbarui', 'success');
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal mengubah status: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#800020]" />
            <span>Master Menu & Produk Katering</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Warung Medan CT Catering · Masakan Khas Batak & Nusantara ({products.length} menu terdaftar)
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#800020] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#660019] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Menu Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu atau bumbu..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-[#800020] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({products.length})
          </button>
          {categoriesList.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#800020] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product List */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
          <Utensils className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak ada menu ditemukan</p>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'Coba ganti filter atau kata kunci pencarian Anda.'
              : 'Belum ada menu yang didaftarkan. Klik "Tambah Menu Baru" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                p.isActive ? 'border-slate-200/90 hover:border-slate-300' : 'border-slate-200 bg-slate-50/70 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 pr-1">
                    <span className="text-[10px] font-bold text-[#800020] uppercase tracking-wide">
                      {p.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                      {p.name}
                    </h4>
                    {p.notes && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {p.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions: Toggle Active, Edit, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(p.id, p.isActive)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 transition-colors ${
                        p.isActive
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title={p.isActive ? 'Klik untuk nonaktifkan menu' : 'Klik untuk aktifkan menu'}
                    >
                      {p.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title="Edit menu"
                      aria-label="Edit menu"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setProductToDelete(p)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      title="Hapus menu"
                      aria-label="Hapus menu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Harga Jual</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {formatRupiah(p.sellingPrice)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">Estimasi HPP</span>
                  <span className="font-mono font-semibold text-xs text-slate-600">
                    {p.estimatedHpp ? formatRupiah(p.estimatedHpp) : 'Belum diisi'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">Hapus Menu Masakan?</h3>
                <span className="text-xs text-rose-600 font-medium">Tindakan permanen</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              Apakah Anda yakin ingin menghapus menu <strong className="text-slate-900 font-bold">"{productToDelete.name}"</strong>? Menu ini akan dihapus dari daftar master menu.
            </p>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 min-h-[44px] hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 min-h-[44px] transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Menu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {productToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#800020]" />
                <h3 className="text-base font-bold text-slate-900">Edit Menu Masakan</h3>
              </div>
              <button
                onClick={() => setProductToEdit(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3.5 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Menu
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daun Ubi Tumbuk Andaliman"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#800020] focus:outline-none"
                >
                  <option value="Lauk Utama">Lauk Utama</option>
                  <option value="Sayur & Pelengkap">Sayur & Pelengkap</option>
                  <option value="Mie & Sarapan">Mie & Sarapan</option>
                  <option value="Paket Catering">Paket Catering</option>
                  <option value="Minuman">Minuman</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={editSellingPriceInput ? formatRupiah(editSellingPrice) : ''}
                    onChange={(e) => setEditSellingPriceInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono tabular-nums font-bold text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimasi HPP (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Opsional"
                    value={editHppInput ? formatRupiah(editEstimatedHpp || 0) : ''}
                    onChange={(e) => setEditHppInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Deskripsi
                </label>
                <input
                  type="text"
                  placeholder="Bumbu rempah & racikan"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProductToEdit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 min-h-[44px] hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || !editName.trim()}
                  className="px-5 py-2 rounded-xl bg-[#800020] text-xs font-bold text-white hover:bg-[#660019] min-h-[44px] transition-colors shadow-sm"
                >
                  {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Tambah Menu Masakan</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Menu
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daun Ubi Tumbuk Andaliman"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#800020] focus:outline-none"
                >
                  <option value="Lauk Utama">Lauk Utama</option>
                  <option value="Sayur & Pelengkap">Sayur & Pelengkap</option>
                  <option value="Mie & Sarapan">Mie & Sarapan</option>
                  <option value="Paket Catering">Paket Catering</option>
                  <option value="Minuman">Minuman</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={sellingPriceInput ? formatRupiah(sellingPrice) : ''}
                    onChange={(e) => setSellingPriceInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono tabular-nums font-bold text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimasi HPP (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Opsional"
                    value={hppInput ? formatRupiah(estimatedHpp || 0) : ''}
                    onChange={(e) => setHppInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono tabular-nums text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Deskripsi
                </label>
                <input
                  type="text"
                  placeholder="Bumbu rempah & racikan"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-[#800020] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 min-h-[44px] hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-5 py-2 rounded-xl bg-[#800020] text-xs font-bold text-white hover:bg-[#660019] min-h-[44px] transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
