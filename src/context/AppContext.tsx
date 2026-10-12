/**
 * WARUNG MEDAN FINANCE - APPLICATION CONTEXT
 * Warung Medan CT Catering
 * Multi-Store & Consolidated State Management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, seedInitialDataIfEmpty } from '../database/db';
import { accountRepository } from '../database/repositories/accountRepository';
import { inventoryRepository } from '../database/repositories/inventoryRepository';
import { productRepository } from '../database/repositories/productRepository';
import { syncRepository } from '../database/repositories/syncRepository';
import { storeRepository } from '../database/repositories/storeRepository';
import { bazarRepository } from '../database/repositories/bazarRepository';
import {
  type Account,
  type Ingredient,
  type ProductMenu,
  type AppSettings,
  type OpeningBalanceConfig,
  type Store,
  type BazarEvent,
  CONSOLIDATED_STORE_ID,
  DEFAULT_OFFICIAL_STORES
} from '../types';

export type PeriodType = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';
export type ActiveTab = 'dashboard' | 'transactions' | 'inventory' | 'reports' | 'settings';
export type SyncStatus = 'SYNCED' | 'SYNCING' | 'PENDING' | 'OFFLINE' | 'FAILED'; // SYNCED means local database ready in offline build

interface AppContextValue {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  period: PeriodType;
  setPeriod: (p: PeriodType) => void;
  customStartDate: string;
  setCustomStartDate: (d: string) => void;
  customEndDate: string;
  setCustomEndDate: (d: string) => void;
  dateRange: { startDate: string; endDate: string; label: string };
  // Multi-Store State
  selectedStoreId: string; // 'ALL' | storeId
  setSelectedStoreId: (storeId: string) => void;
  stores: Store[];
  bazarEvents: BazarEvent[];
  unmappedRecordCount: number;
  // Repositories & Data
  accounts: Account[];
  ingredients: Ingredient[];
  products: ProductMenu[];
  settings: AppSettings | null;
  openingBalance: OpeningBalanceConfig | null;
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  lowStockCount: number;
  isLoading: boolean;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  refreshData: () => Promise<void>;
  triggerSync: () => Promise<void>;
  transferMoney: (payload: {
    date: string;
    fromStoreId: string;
    toStoreId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    notes?: string;
  }) => Promise<void>;
  transferStock: (payload: {
    date: string;
    fromStoreId: string;
    toStoreId: string;
    fromIngredientId: string;
    quantity: number;
    notes?: string;
  }) => Promise<void>;
  mapLegacyData: (targetStoreId: string) => Promise<number>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Multi-store state
  const [selectedStoreId, setSelectedStoreId] = useState<string>(CONSOLIDATED_STORE_ID);
  const [stores, setStores] = useState<Store[]>(DEFAULT_OFFICIAL_STORES);
  const [bazarEvents, setBazarEvents] = useState<BazarEvent[]>([]);
  const [unmappedRecordCount, setUnmappedRecordCount] = useState<number>(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<ProductMenu[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalanceConfig | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine); // informational only; never gates local transactions
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('SYNCED');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Compute active date range based on period filter
  const dateRange = React.useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (period === 'today') {
      return { startDate: today, endDate: today, label: 'Hari Ini' };
    }
    if (period === 'this_week') {
      const dayOfWeek = now.getDay(); // 0 is Sunday
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const start = monday.toISOString().slice(0, 10);
      return { startDate: start, endDate: today, label: 'Minggu Ini' };
    }
    if (period === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const start = `${y}-${m}-01`;
      return { startDate: start, endDate: today, label: 'Bulan Ini' };
    }
    if (period === 'this_year') {
      const y = now.getFullYear();
      const start = `${y}-01-01`;
      return { startDate: start, endDate: today, label: 'Tahun Ini' };
    }
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      label: `${customStartDate} s/d ${customEndDate}`
    };
  }, [period, customStartDate, customEndDate]);

  const loadData = useCallback(async () => {
    try {
      try {
        await seedInitialDataIfEmpty();
      } catch (seedErr) {
        console.warn('Initial seed non-fatal warning:', seedErr);
      }

      const [allStores, events, accs, ings, prds, sets, opb, pendingCount, lowStocks, unmapped] =
        await Promise.all([
          storeRepository.getAll().catch(() => DEFAULT_OFFICIAL_STORES),
          bazarRepository.getAllEvents().catch(() => []),
          accountRepository.getAll().catch(() => []),
          inventoryRepository.getAllIngredients().catch(() => []),
          productRepository.getAll().catch(() => []),
          syncRepository.getSettings().catch(() => null),
          syncRepository.getOpeningBalance().catch(() => undefined),
          syncRepository.getPendingSyncCount().catch(() => 0),
          inventoryRepository.getLowStockAlerts().catch(() => []),
          storeRepository.getUnmappedRecordsCount().catch(() => ({ salesCount: 0, txCount: 0, ingredientCount: 0, total: 0 }))
        ]);

      setStores(allStores.length > 0 ? allStores : DEFAULT_OFFICIAL_STORES);
      setBazarEvents(events);
      setAccounts(accs);
      setIngredients(ings);
      setProducts(prds);
      setSettings(sets);
      setOpeningBalance(opb || null);
      setPendingSyncCount(pendingCount);
      setLowStockCount(lowStocks.length);
      setUnmappedRecordCount(unmapped.total);

      // Offline edition: local IndexedDB is the source of truth; no cloud sync queue.
      setSyncStatus('SYNCED');
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Offline-first: the local IndexedDB is the only active database.
    void loadData();
    // Ask the browser to protect the local database from automatic storage eviction when supported.
    if (navigator.storage?.persist) {
      void navigator.storage.persist().then((granted) => {
        if (!granted) console.warn('Browser did not grant persistent storage; create regular backups.');
      }).catch(() => {});
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  const triggerSync = async () => {
    // Kept as a compatibility action for existing UI controls; it refreshes local data only.
    await loadData();
    setSyncStatus('SYNCED');
    showToast('Data pembukuan lokal sudah diperbarui. Tidak ada sinkronisasi cloud.', 'info');
  };

  const transferMoney = async (payload: {
    date: string;
    fromStoreId: string;
    toStoreId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    notes?: string;
  }) => {
    await storeRepository.transferMoney(payload);
    showToast('Transfer dana antar-cabang berhasil dicatat!', 'success');
    await loadData();
  };

  const transferStock = async (payload: {
    date: string;
    fromStoreId: string;
    toStoreId: string;
    fromIngredientId: string;
    quantity: number;
    notes?: string;
  }) => {
    await storeRepository.transferStock(payload);
    showToast('Transfer stok bahan baku antar-cabang berhasil dicatat!', 'success');
    await loadData();
  };

  const mapLegacyData = async (targetStoreId: string): Promise<number> => {
    const count = await storeRepository.mapUnmappedRecordsToStore(targetStoreId);
    showToast(`Berhasil memetakan ${count} data historis ke cabang!`, 'success');
    await loadData();
    return count;
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        period,
        setPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        dateRange,
        selectedStoreId,
        setSelectedStoreId,
        stores,
        bazarEvents,
        unmappedRecordCount,
        accounts,
        ingredients,
        products,
        settings,
        openingBalance,
        isOnline,
        syncStatus,
        pendingSyncCount,
        lowStockCount,
        isLoading,
        toastMessage,
        showToast,
        refreshData: loadData,
        triggerSync,
        transferMoney,
        transferStock,
        mapLegacyData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
