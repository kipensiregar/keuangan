/**
 * SETTINGS VIEW - Pengaturan Usaha, Saldo Awal per Cabang, Multi-Store Budgets & APK Guide
 * Warung Medan CT Catering
 * Offline-first: database lokal & manajemen tiga unit cabang
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { syncRepository } from '../../database/repositories/syncRepository';
import { storeRepository } from '../../database/repositories/storeRepository';
import { ProductsView } from '../products/ProductsView';
import { MigrationModal } from './MigrationModal';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../../services/backupCrypto';
import type { AuditLog, OpeningBalanceConfig, StoreBudget, Store } from '../../types';
import {
  STORE_SUNGAI_BAUNG_ID,
  STORE_PALEMBANG_CENTER_ID,
  STORE_BAZAR_ID
} from '../../types';
import { formatRupiah, formatIndonesianDate, downloadFile } from '../../utils/formatters';
import {
  Settings,
  Building,
  Save,
  Download,
  Upload,
  Shield,
  Smartphone,
  History,
  CheckCircle,
  AlertCircle,
  Utensils,
  RefreshCw,
  Building2,
  Tent,
  Layers,
  Target,
  Database,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  HardDrive,
  X
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    stores,
    selectedStoreId,
    unmappedRecordCount,
    refreshData,
    triggerSync,
    showToast
  } = useApp();

  type SubTab = 'PROFILE' | 'STORES' | 'OPENING' | 'MENU' | 'BACKUP' | 'APK' | 'AUDIT';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('PROFILE');

  // Business Profile
  const [businessName, setBusinessName] = useState(settings?.businessName || 'Warung Medan CT Catering');
  const [address, setAddress] = useState(settings?.address || 'Jl. R. Sukamto No. 88, Palembang');
  const [phone, setPhone] = useState(settings?.phone || '0812-3456-7890');
  const [timezone, setTimezone] = useState(settings?.timezone || 'Asia/Jakarta');

  // Sync profile when settings loaded
  useEffect(() => {
    if (settings) {
      if (settings.businessName) setBusinessName(settings.businessName);
      if (settings.address) setAddress(settings.address);
      if (settings.phone) setPhone(settings.phone);
      if (settings.timezone) setTimezone(settings.timezone);
    }
  }, [settings]);

  // Fallback stores jika database masih memuat data di awal
  const defaultFallbackStores: Store[] = [
    {
      id: STORE_SUNGAI_BAUNG_ID,
      name: 'Sungai Baung',
      code: 'SB',
      address: 'Kompleks Industri Sungai Baung, OKI, Sumatera Selatan',
      isActive: true,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: STORE_PALEMBANG_CENTER_ID,
      name: 'Palembang Center',
      code: 'PC',
      address: 'Jl. R. Sukamto No. 88, Palembang',
      isActive: true,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: STORE_BAZAR_ID,
      name: 'Bazar',
      code: 'BZ',
      address: 'Unit Operasional Bazar & Mobile Catering Event',
      isActive: true,
      createdAt: '',
      updatedAt: ''
    }
  ];

  const availableStores = stores && stores.length > 0 ? stores : defaultFallbackStores;

  // Store & Budget State
  const defaultStoreId = selectedStoreId !== 'ALL' ? selectedStoreId : (availableStores[0]?.id || 'store_palembang_center');
  const [selectedBudgetStoreId, setSelectedBudgetStoreId] = useState(defaultStoreId);
  const [budgetMonth, setBudgetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [targetRevenueInput, setTargetRevenueInput] = useState('');
  const [maxExpenseInput, setMaxExpenseInput] = useState('');
  const [targetNetProfitInput, setTargetNetProfitInput] = useState('');

  // Opening Balance per Store state
  const [selectedOpeningStoreId, setSelectedOpeningStoreId] = useState(defaultStoreId);
  const [cashBalanceInput, setCashBalanceInput] = useState('');
  const [bankBalanceInput, setBankBalanceInput] = useState('');
  const [ewalletBalanceInput, setEwalletBalanceInput] = useState('');

  // Store Management Modal State
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreIsBazar, setNewStoreIsBazar] = useState(false);

  // Sync selected branch if stores load asynchronously
  useEffect(() => {
    if (availableStores.length > 0) {
      if (!availableStores.some((s) => s.id === selectedOpeningStoreId)) {
        setSelectedOpeningStoreId(availableStores[0].id);
      }
      if (!availableStores.some((s) => s.id === selectedBudgetStoreId)) {
        setSelectedBudgetStoreId(availableStores[0].id);
      }
    }
  }, [availableStores, selectedOpeningStoreId, selectedBudgetStoreId]);

  // Modals
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load opening balance for chosen store
  useEffect(() => {
    if (!selectedOpeningStoreId) return;
    syncRepository.getOpeningBalance(selectedOpeningStoreId).then((ob) => {
      if (ob) {
        setCashBalanceInput(formatRupiah(ob.cashBalance));
        setBankBalanceInput(formatRupiah(ob.bankBalance));
        setEwalletBalanceInput(formatRupiah(ob.ewalletBalance));
      } else {
        setCashBalanceInput('Rp0');
        setBankBalanceInput('Rp0');
        setEwalletBalanceInput('Rp0');
      }
    });
  }, [selectedOpeningStoreId]);

  // Load budget for chosen store & month
  useEffect(() => {
    storeRepository.getBudget(selectedBudgetStoreId, budgetMonth).then((bgt) => {
      if (bgt) {
        setTargetRevenueInput(formatRupiah(bgt.targetRevenue));
        setMaxExpenseInput(formatRupiah(bgt.maxExpenseBudget));
        setTargetNetProfitInput(formatRupiah(bgt.targetNetProfit));
      } else {
        setTargetRevenueInput('Rp0');
        setMaxExpenseInput('Rp0');
        setTargetNetProfitInput('Rp0');
      }
    });
  }, [selectedBudgetStoreId, budgetMonth]);

  useEffect(() => {
    if (activeSubTab === 'AUDIT') {
      syncRepository.getAuditLogs().then(setAuditLogs);
    }
  }, [activeSubTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await syncRepository.updateSettings({
        businessName,
        address,
        phone,
        timezone
      });
      showToast('Profil usaha berhasil disimpan ke database!', 'success');
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal: ${err.message}`, 'error');
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const parse = (val: string) => parseInt(val.replace(/\D/g, ''), 10) || 0;
    try {
      await storeRepository.saveBudget({
        storeId: selectedBudgetStoreId,
        month: budgetMonth,
        targetRevenue: parse(targetRevenueInput),
        maxExpenseBudget: parse(maxExpenseInput),
        targetNetProfit: parse(targetNetProfitInput)
      });
      showToast('Target & Anggaran cabang berhasil disimpan ke database!', 'success');
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal menyimpan anggaran: ${err.message}`, 'error');
    }
  };

  const handleSaveOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const parse = (val: string) => parseInt(val.replace(/\D/g, ''), 10) || 0;
    const cash = parse(cashBalanceInput);
    const bank = parse(bankBalanceInput);
    const ewallet = parse(ewalletBalanceInput);

    try {
      const selectedStore = availableStores.find((s) => s.id === selectedOpeningStoreId);
      const storeName = selectedStore ? selectedStore.name : selectedOpeningStoreId;

      const now = new Date().toISOString();
      const newConfig: OpeningBalanceConfig = {
        id: `opb_${selectedOpeningStoreId}`,
        storeId: selectedOpeningStoreId,
        effectiveDate: now.slice(0, 10),
        cashBalance: cash,
        bankBalance: bank,
        ewalletBalance: ewallet,
        initialInventoryValue: 0,
        initialPayables: 0,
        initialReceivables: 0,
        ownerEquity: cash + bank + ewallet,
        isConfirmed: true,
        notes: `Saldo awal pembukuan ${storeName}`,
        createdAt: now,
        updatedAt: now
      };

      await syncRepository.saveOpeningBalance(newConfig, selectedOpeningStoreId);
      showToast(`Saldo awal ${storeName} berhasil disimpan di database lokal!`, 'success');
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal menyimpan saldo awal: ${err.message}`, 'error');
    }
  };

  // Tambah Cabang Manual
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      showToast('Nama cabang tidak boleh kosong', 'error');
      return;
    }

    try {
      const code = newStoreCode.trim().toUpperCase() || newStoreName.slice(0, 2).toUpperCase();

      if (storeToEdit) {
        await storeRepository.update(storeToEdit.id, {
          name: newStoreName.trim(),
          code,
          address: newStoreAddress.trim() || '-',
          phone: newStorePhone.trim() || '-',
          isBazarUnit: newStoreIsBazar
        });
        showToast(`Unit cabang ${newStoreName} berhasil diperbarui di database!`, 'success');
      } else {
        const newStore = await storeRepository.create({
          id: `store_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: newStoreName.trim(),
          code,
          address: newStoreAddress.trim() || '-',
          phone: newStorePhone.trim() || '-',
          isBazarUnit: newStoreIsBazar,
          isActive: true
        });
        showToast(`Cabang ${newStore.name} berhasil ditambahkan ke database lokal!`, 'success');
      }

      setIsAddStoreModalOpen(false);
      setStoreToEdit(null);
      setNewStoreName('');
      setNewStoreCode('');
      setNewStoreAddress('');
      setNewStorePhone('');
      setNewStoreIsBazar(false);
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal menyimpan cabang: ${err.message}`, 'error');
    }
  };

  const handleOpenEditStore = (store: Store) => {
    setStoreToEdit(store);
    setNewStoreName(store.name);
    setNewStoreCode(store.code);
    setNewStoreAddress(store.address || '');
    setNewStorePhone(store.phone || '');
    setNewStoreIsBazar(!!store.isBazarUnit);
    setIsAddStoreModalOpen(true);
  };

  const handleExportBackup = async () => {
    try {
      const password = window.prompt('Buat kata sandi backup (minimal 12 karakter). Simpan kata sandi ini terpisah; tanpa kata sandi, backup tidak dapat dipulihkan:');
      if (password === null) return;
      const confirmation = window.prompt('Masukkan ulang kata sandi backup:');
      if (confirmation === null) return;
      if (password !== confirmation) throw new Error('Kata sandi tidak sama. Backup belum dibuat.');
      if (password.length < 12) throw new Error('Kata sandi backup minimal 12 karakter.');
      const json = await syncRepository.exportFullBackupJson();
      const encrypted = await encryptBackup(json, password);
      const filename = `backup_warung_medan_${new Date().toISOString().slice(0, 10)}.wmfbak`;
      downloadFile(encrypted, filename, 'application/octet-stream');
      showToast('Backup terenkripsi berhasil dibuat. Simpan salinannya di media lokal terpisah.', 'success');
    } catch (err: any) {
      showToast(`Gagal ekspor: ${err.message}`, 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        let content = evt.target?.result as string;
        if (isEncryptedBackup(content)) {
          const password = window.prompt('Masukkan kata sandi untuk membuka backup terenkripsi:');
          if (password === null) return;
          content = await decryptBackup(content, password);
        } else {
          const confirmed = window.confirm('File ini merupakan backup JSON tanpa enkripsi. Lanjutkan pemulihan? Pastikan file berasal dari sumber tepercaya.');
          if (!confirmed) return;
        }
        const result = await syncRepository.restoreBackupJson(content);
        if (result.success) {
          showToast(result.message, 'success');
          await refreshData();
        } else {
          showToast(result.message, 'error');
        }
      } catch (err: any) {
        showToast(`Gagal membaca file: ${err.message}`, 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* LOCAL DATABASE STATUS */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-800 text-white rounded-3xl p-4 shadow-sm border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h4 className="text-sm font-bold tracking-tight">Database Lokal Aktif</h4>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-200 font-mono px-2 py-0.5 rounded-full">Offline-first</span>
            </div>
            <p className="text-xs text-emerald-200/90 mt-0.5">
              Seluruh transaksi disimpan pada perangkat pusat. Internet tidak diperlukan untuk pembukuan; lakukan backup secara berkala.
            </p>
          </div>
        </div>
        <button
          onClick={triggerSync}
          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang Data Lokal</span>
        </button>
      </div>

      {/* Subtab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200">
        {[
          { key: 'PROFILE', label: 'Profil Usaha', icon: Building },
          { key: 'STORES', label: 'Unit Cabang', icon: Building2 },
          { key: 'OPENING', label: 'Saldo Awal Cabang', icon: Layers },
          { key: 'MENU', label: 'Master Menu', icon: Utensils },
          { key: 'BACKUP', label: 'Cadangkan / Backup', icon: Shield },
          { key: 'APK', label: 'Panduan APK HP', icon: Smartphone },
          { key: 'AUDIT', label: 'Jejak Audit', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as SubTab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#800020] text-amber-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subtab 1: PROFIL USAHA */}
      {activeSubTab === 'PROFILE' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Identitas & Informasi Usaha
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Digunakan pada kop cetak laporan keuangan, nota transaksi, dan tanda terima catering
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Usaha / Bisnis
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Kantor Pusat / Dapur Utama
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Kontak / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zona Waktu Operasional
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
                >
                  <option value="Asia/Jakarta">WIB (Waktu Indonesia Barat) - Jakarta / Medan / Palembang</option>
                  <option value="Asia/Makassar">WITA (Waktu Indonesia Tengah)</option>
                  <option value="Asia/Jayapura">WIT (Waktu Indonesia Timur)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-[#800020] text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#600018] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Profil Usaha</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab 2: CABANG & TARGET ANGGARAN */}
      {activeSubTab === 'STORES' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Daftar Unit Usaha (Multi-Store)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unit cabang operasional Warung Medan CT Catering yang tersimpan di perangkat ini
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStoreToEdit(null);
                  setNewStoreName('');
                  setNewStoreCode('');
                  setNewStoreAddress('');
                  setNewStorePhone('');
                  setNewStoreIsBazar(false);
                  setIsAddStoreModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-[#800020] text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#600018] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Unit Cabang</span>
              </button>
              {unmappedRecordCount > 0 && (
                <button
                  onClick={() => setIsMigrationModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Petakan Data ({unmappedRecordCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Cabang */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {availableStores.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2 hover:border-[#800020]/30 transition-all relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{s.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-[#800020] text-amber-200">
                    {s.code}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">{s.address || 'Alamat belum diatur'}</p>
                <p className="text-[10px] text-slate-400">Telp: {s.phone || '-'}</p>
                
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">
                    {s.isBazarUnit ? 'Unit Bazar / Event' : 'Cabang Resto & Dapur'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditStore(s)}
                    className="p-1 text-slate-500 hover:text-[#800020] hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Edit Cabang"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Target & Anggaran Bulanan Form */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#800020]" />
              <span>Target & Anggaran Keuangan Bulanan per Cabang</span>
            </h4>

            <form onSubmit={handleSaveBudget} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Unit Cabang ({availableStores.length} Unit Tersedia)
                </label>
                {/* Tombol Pilihan Cabang Cepat */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {availableStores.map((s) => {
                    const isSelected = selectedBudgetStoreId === s.id;
                    return (
                      <button
                        key={`btn_bgt_${s.id}`}
                        type="button"
                        onClick={() => setSelectedBudgetStoreId(s.id)}
                        className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#800020] text-amber-200 border-[#800020] shadow-xs font-bold ring-2 ring-[#800020]/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight truncate">{s.name}</div>
                        <span
                          className={`inline-block text-[10px] font-mono mt-0.5 px-1.5 py-0.2 rounded font-bold ${
                            isSelected ? 'bg-amber-400 text-amber-950' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {s.code}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <select
                    value={selectedBudgetStoreId}
                    onChange={(e) => setSelectedBudgetStoreId(e.target.value)}
                    className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#800020] appearance-none cursor-pointer"
                  >
                    {availableStores.map((s) => (
                      <option key={s.id} value={s.id} className="text-slate-900 bg-white">
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bulan Target Anggaran
                </label>
                <input
                  type="month"
                  required
                  value={budgetMonth}
                  onChange={(e) => setBudgetMonth(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Omzet (Revenue)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={targetRevenueInput}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                      setTargetRevenueInput(formatRupiah(num));
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-[#800020]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batas Biaya Operasional
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={maxExpenseInput}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                      setMaxExpenseInput(formatRupiah(num));
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-[#800020]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Laba Bersih
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={targetNetProfitInput}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                      setTargetNetProfitInput(formatRupiah(num));
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-[#800020]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#800020] text-amber-200 rounded-xl text-xs font-bold shadow-xs hover:bg-[#600018] cursor-pointer"
                >
                  Simpan Target Cabang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subtab 3: SALDO AWAL PER CABANG */}
      {activeSubTab === 'OPENING' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Saldo Awal Pembukuan per Cabang
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap unit cabang memiliki saldo awal kas fisik, bank, dan e-wallet yang terpisah
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStoreToEdit(null);
                setNewStoreName('');
                setNewStoreCode('');
                setNewStoreAddress('');
                setNewStorePhone('');
                setNewStoreIsBazar(false);
                setIsAddStoreModalOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 text-[#800020]" />
              <span>Tambah Unit Cabang Baru</span>
            </button>
          </div>

          <form onSubmit={handleSaveOpeningBalance} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Pilih Unit Cabang ({availableStores.length} Unit Tersedia)
                </label>
                <span className="text-[11px] font-bold text-[#800020] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  Aktif: {availableStores.find((s) => s.id === selectedOpeningStoreId)?.name || 'Pilih Cabang'}
                </span>
              </div>

              {/* Tombol Pilihan Cabang Cepat (Sangat responsif di iPad & HP Touchscreen) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2.5">
                {availableStores.map((s) => {
                  const isSelected = selectedOpeningStoreId === s.id;
                  return (
                    <button
                      key={`btn_open_${s.id}`}
                      type="button"
                      onClick={() => setSelectedOpeningStoreId(s.id)}
                      className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#800020] text-amber-200 border-[#800020] shadow-sm font-bold ring-2 ring-[#800020]/20 scale-[1.01]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight truncate">{s.name}</div>
                      <span
                        className={`inline-block text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded font-bold ${
                          isSelected ? 'bg-amber-400 text-amber-950' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {s.code}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dropdown Selector Resmi dengan Text Jelas & Chevron Arrow */}
              <div className="relative">
                <select
                  value={selectedOpeningStoreId}
                  onChange={(e) => setSelectedOpeningStoreId(e.target.value)}
                  className="w-full h-12 px-3.5 pr-10 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#800020] appearance-none cursor-pointer"
                >
                  {availableStores.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900 bg-white font-bold py-1">
                      Cabang: {s.name} ({s.code}) - {s.isBazarUnit ? 'Unit Bazar & Event' : 'Cabang Tetap'}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-600">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo Kas Fisik (Laci Cabang)
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={cashBalanceInput}
                onChange={(e) => {
                  const num = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                  setCashBalanceInput(formatRupiah(num));
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold font-mono tabular-nums focus:ring-2 focus:ring-[#800020]"
                placeholder="Rp0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo Rekening Bank Operasional Cabang
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={bankBalanceInput}
                onChange={(e) => {
                  const num = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                  setBankBalanceInput(formatRupiah(num));
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold font-mono tabular-nums focus:ring-2 focus:ring-[#800020]"
                placeholder="Rp0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo QRIS & E-Wallet Cabang
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={ewalletBalanceInput}
                onChange={(e) => {
                  const num = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                  setEwalletBalanceInput(formatRupiah(num));
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold font-mono tabular-nums focus:ring-2 focus:ring-[#800020]"
                placeholder="Rp0"
              />
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
              <strong className="block mb-1">Catatan Akuntansi:</strong>
              Konfirmasi saldo awal akan memperbarui akun kas dan bank cabang terkait pada database lokal perangkat ini.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#800020] text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#600018] cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Saldo Awal Cabang</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab 4: MASTER MENU */}
      {activeSubTab === 'MENU' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <ProductsView />
        </div>
      )}

      {/* Subtab 5: BACKUP & RESTORE */}
      {activeSubTab === 'BACKUP' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Cadangan & Pemulihan Data (Backup & Restore)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Simpan berkas JSON cadangan seluruh catatan keuangan, multi-cabang, rekap menu, dan jurnal
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Download className="w-4 h-4 text-[#800020]" />
                <span>Backup Terenkripsi</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Membuat file .wmfbak terenkripsi AES-GCM. Kata sandi minimal 12 karakter wajib disimpan terpisah. Salin file ke SSD atau flashdisk khusus setelah diunduh.
              </p>
              <button
                onClick={handleExportBackup}
                className="w-full py-2 bg-[#800020] text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#600018] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Buat Backup Terenkripsi</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Upload className="w-4 h-4 text-emerald-700" />
                <span>Pulihkan Data</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pulihkan backup terenkripsi .wmfbak atau backup JSON lama. JSON lama tidak terenkripsi dan akan meminta konfirmasi.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportBackup}
                accept=".json,.wmfbak"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:bg-emerald-800 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 6: PANDUAN APK HP */}
      {activeSubTab === 'APK' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Panduan Pembuatan File APK Android untuk HP & Tablet
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cara menghasilkan aplikasi APK mandiri yang dapat langsung diinstal di HP/Tablet kasir tanpa perantara browser
            </p>
          </div>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <strong className="text-slate-900 font-bold block">1. Menginstal Capacitor:</strong>
              <pre className="p-2 bg-slate-900 text-amber-300 rounded-lg font-mono text-[11px] overflow-x-auto">
{`npm install @capacitor/core @capacitor/cli @capacitor/android`}
              </pre>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <strong className="text-slate-900 font-bold block">2. Membangun Kode Web & Sinkronisasi:</strong>
              <pre className="p-2 bg-slate-900 text-amber-300 rounded-lg font-mono text-[11px] overflow-x-auto">
{`# 1. Build aplikasi web
npm run build

# 2. Inisialisasi platform Android (jika belum ada)
npx cap add android

# 3. Salin hasil build ke Android project
npx cap copy android
npx cap sync android`}
              </pre>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <strong className="text-slate-900 font-bold block">3. Menghasilkan Debug APK:</strong>
              <pre className="p-2 bg-slate-900 text-amber-300 rounded-lg font-mono text-[11px] overflow-x-auto">
{`cd android
./gradlew assembleDebug

# Lokasi file APK Debug yang dihasilkan:
# android/app/build/outputs/apk/debug/app-debug.apk`}
              </pre>
              <p className="text-[11px] text-slate-500 mt-1">
                APK Debug dapat langsung ditransfer lewat WhatsApp/USB ke HP Android pemilik dan diinstal (centang 'Izinkan sumber tidak dikenal').
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 7: AUDIT LOGS */}
      {activeSubTab === 'AUDIT' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Jejak Audit Keuangan (Audit Logs)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Catatan mutasi, transfer antar cabang, pemetaan data, dan verifikasi integritas
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.length === 0 ? (
              <div className="py-6 text-center text-slate-400">Belum ada jejak audit.</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{log.details}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT UNIT CABANG */}
      {isAddStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-[#800020]">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {storeToEdit ? 'Edit Unit Cabang' : 'Tambah Unit Cabang Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddStoreModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Unit Cabang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cabang Jakabaring, Stand Festival, dll"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Singkatan (2-4 Huruf)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Contoh: JK, PC, SB, BZ"
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value.toUpperCase())}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap Cabang
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat fisik toko, stand bazar, atau dapur cabang"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp Cabang
                </label>
                <input
                  type="text"
                  placeholder="0812-xxxx-xxxx"
                  value={newStorePhone}
                  onChange={(e) => setNewStorePhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isBazarCheck"
                  checked={newStoreIsBazar}
                  onChange={(e) => setNewStoreIsBazar(e.target.checked)}
                  className="w-4 h-4 rounded text-[#800020] focus:ring-[#800020]"
                />
                <label htmlFor="isBazarCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Ini adalah Unit Bazar / Mobile Catering Event
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStoreModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#800020] text-amber-200 rounded-xl text-xs font-bold hover:bg-[#600018] shadow-xs cursor-pointer"
                >
                  {storeToEdit ? 'Simpan Perubahan' : 'Tambah Cabang ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Migration Modal */}
      <MigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
      />
    </div>
  );
};
