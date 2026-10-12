/**
 * Sync & Backup Repository - Warung Medan Finance
 * Offline-first Outbox queue, JSON backup/restore, audit trail
 */

import { db } from '../db';
import type { AppSettings, OpeningBalanceConfig, AuditLog } from '../../types';

export const syncRepository = {
  async getSettings(): Promise<AppSettings> {
    const list = await db.settings.toArray();
    if (list.length > 0) return list[0];
    return {
      businessName: 'Warung Medan CT Catering',
      ownerName: 'Pemilik Usaha CT',
      address: 'Jl. Danau Toba Raya No. 18, Medan',
      phone: '0812-3456-7890',
      timezone: 'Asia/Jakarta',
      pinLockEnabled: false,
      autoSyncEnabled: false
    };
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings, id: 'app_settings' };
    await db.settings.put(updated);
  },

  async getOpeningBalance(storeId?: string): Promise<OpeningBalanceConfig | undefined> {
    if (storeId && storeId !== 'ALL') {
      const matches = await db.openingBalances.filter((ob) => ob.storeId === storeId).toArray();
      if (matches.length > 0) {
        // Urutkan berdasarkan updatedAt terbaru jika ada lebih dari satu
        matches.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        return matches[0];
      }

      // Jika belum ada record tersimpan di tabel openingBalances, periksa akun unit cabang ini di db.accounts
      const branchAccounts = await db.accounts.filter((a) => a.storeId === storeId).toArray();
      const cash = branchAccounts.filter((a) => a.type === 'Kas').reduce((sum, a) => sum + a.initialBalance, 0);
      const bank = branchAccounts.filter((a) => a.type === 'Bank').reduce((sum, a) => sum + a.initialBalance, 0);
      const ewallet = branchAccounts.filter((a) => a.type === 'E-Wallet').reduce((sum, a) => sum + a.initialBalance, 0);

      const fallbackConfig: OpeningBalanceConfig = {
        id: `opb_${storeId}`,
        storeId,
        effectiveDate: new Date().toISOString().slice(0, 10),
        cashBalance: cash,
        bankBalance: bank,
        ewalletBalance: ewallet,
        initialInventoryValue: 0,
        initialPayables: 0,
        initialReceivables: 0,
        ownerEquity: cash + bank + ewallet,
        isConfirmed: branchAccounts.length > 0,
        notes: `Saldo awal pembukuan unit cabang ${storeId}`,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Simpan agar langsung persisten di database
      await db.openingBalances.put(fallbackConfig);
      return fallbackConfig;
    }

    // Untuk Konsolidasi ('ALL' atau undefined): Ambil semua saldo awal cabang dan totalkan
    const list = await db.openingBalances.toArray();
    if (list.length === 0) return undefined;

    // Jika dipanggil tanpa storeId atau 'ALL', hitung total konsolidasi seluruh cabang
    const consolidatedCash = list.reduce((sum, item) => sum + item.cashBalance, 0);
    const consolidatedBank = list.reduce((sum, item) => sum + item.bankBalance, 0);
    const consolidatedEwallet = list.reduce((sum, item) => sum + item.ewalletBalance, 0);

    return {
      id: 'opb_consolidated_all',
      storeId: 'ALL',
      effectiveDate: list[0]?.effectiveDate || new Date().toISOString().slice(0, 10),
      cashBalance: consolidatedCash,
      bankBalance: consolidatedBank,
      ewalletBalance: consolidatedEwallet,
      initialInventoryValue: list.reduce((sum, item) => sum + item.initialInventoryValue, 0),
      initialPayables: list.reduce((sum, item) => sum + item.initialPayables, 0),
      initialReceivables: list.reduce((sum, item) => sum + item.initialReceivables, 0),
      ownerEquity: list.reduce((sum, item) => sum + item.ownerEquity, 0),
      isConfirmed: true,
      notes: 'Konsolidasi saldo awal seluruh unit cabang',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  },

  async saveOpeningBalance(config: OpeningBalanceConfig, storeId?: string): Promise<void> {
    const targetStoreId = storeId || config.storeId;
    await db.transaction('rw', [db.openingBalances, db.accounts, db.stores, db.auditLogs], async () => {
      // 1. Cari record saldo awal yang sudah ada untuk cabang ini agar ID konsisten
      const existing = await db.openingBalances.filter((ob) => ob.storeId === targetStoreId).first();
      const configToSave: OpeningBalanceConfig = {
        ...config,
        storeId: targetStoreId,
        id: existing ? existing.id : (config.id || `opb_${targetStoreId}`),
        updatedAt: new Date().toISOString()
      };

      // Hapus duplikat lama untuk cabang ini jika ada id berbeda
      const allForStore = await db.openingBalances.filter((ob) => ob.storeId === targetStoreId).toArray();
      for (const item of allForStore) {
        if (item.id !== configToSave.id) {
          await db.openingBalances.delete(item.id);
        }
      }

      await db.openingBalances.put(configToSave);

      // 2. Sinkronkan ke saldo awal akun untuk cabang yang sesuai
      const accounts = await db.accounts.filter((a) => a.storeId === targetStoreId).toArray();
      let hasKas = false;
      let hasBank = false;
      let hasEwallet = false;

      for (const acc of accounts) {
        let targetInitial = acc.initialBalance;
        if (acc.type === 'Kas') {
          targetInitial = config.cashBalance;
          hasKas = true;
        } else if (acc.type === 'Bank') {
          targetInitial = config.bankBalance;
          hasBank = true;
        } else if (acc.type === 'E-Wallet') {
          targetInitial = config.ewalletBalance;
          hasEwallet = true;
        }

        // Delta transaksi = saldo berjalan saat ini - saldo awal lama
        const ledgerMovementDelta = acc.currentBalance - acc.initialBalance;
        const newCurrentBalance = Math.round(targetInitial + ledgerMovementDelta);

        await db.accounts.update(acc.id, {
          initialBalance: targetInitial,
          currentBalance: newCurrentBalance,
          updatedAt: new Date().toISOString()
        });
      }

      // Jika cabang belum memiliki akun untuk jenis saldo yang diisi nominalnya, buatkan akun agar nominal tercatat di buku kas
      const store = await db.stores.get(targetStoreId);
      const storeName = store ? store.name : targetStoreId;
      const now = new Date().toISOString();

      if (!hasKas && config.cashBalance > 0) {
        await db.accounts.add({
          id: `acc_kas_${targetStoreId}_${Date.now()}`,
          storeId: targetStoreId,
          name: `Kas Fisik ${storeName} (Laci)`,
          type: 'Kas',
          initialBalance: config.cashBalance,
          currentBalance: config.cashBalance,
          isDefault: true,
          createdAt: now,
          updatedAt: now
        });
      }

      if (!hasBank && config.bankBalance > 0) {
        await db.accounts.add({
          id: `acc_bank_${targetStoreId}_${Date.now()}`,
          storeId: targetStoreId,
          name: `Rekening Bank Operasional ${storeName}`,
          type: 'Bank',
          initialBalance: config.bankBalance,
          currentBalance: config.bankBalance,
          isDefault: false,
          createdAt: now,
          updatedAt: now
        });
      }

      if (!hasEwallet && config.ewalletBalance > 0) {
        await db.accounts.add({
          id: `acc_ewallet_${targetStoreId}_${Date.now()}`,
          storeId: targetStoreId,
          name: `QRIS & E-Wallet ${storeName}`,
          type: 'E-Wallet',
          initialBalance: config.ewalletBalance,
          currentBalance: config.ewalletBalance,
          isDefault: false,
          createdAt: now,
          updatedAt: now
        });
      }

      await db.auditLogs.add({
        id: `audit_${Date.now()}`,
        action: 'UPDATE_OPENING_BALANCE',
        storeId: targetStoreId,
        entityType: 'OPENING_BALANCE',
        entityId: configToSave.id,
        details: `Saldo awal pembukuan ${storeName} dikonfirmasi: Kas Rp${config.cashBalance.toLocaleString('id-ID')}, Bank Rp${config.bankBalance.toLocaleString('id-ID')}, E-Wallet Rp${config.ewalletBalance.toLocaleString('id-ID')}`,
        timestamp: new Date().toISOString()
      });

    });
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return await db.auditLogs.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async getPendingSyncCount(): Promise<number> {
    // Legacy table retained for schema compatibility; cloud outbox is unused in offline edition.
    return 0;
  },

  /**
   * Export all data tables into a validated JSON backup bundle
   */
  async exportFullBackupJson(): Promise<string> {
    const backupData = {
      app: 'Warung Medan Finance',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      businessName: 'Warung Medan CT Catering',
      data: {
        stores: await db.stores.toArray(),
        bazarEvents: await db.bazarEvents.toArray(),
        budgets: await db.budgets.toArray(),
        accounts: await db.accounts.toArray(),
        dailySales: await db.dailySales.toArray(),
        transactions: await db.transactions.toArray(),
        ingredients: await db.ingredients.toArray(),
        stockMovements: await db.stockMovements.toArray(),
        products: await db.products.toArray(),
        payables: await db.payables.toArray(),
        receivables: await db.receivables.toArray(),
        openingBalances: await db.openingBalances.toArray(),
        auditLogs: await db.auditLogs.toArray(),
        settings: await db.settings.toArray()
      }
    };

    return JSON.stringify(backupData, null, 2);
  },

  /**
   * Restore database from backup JSON bundle with full safety transaction
   */
  async restoreBackupJson(jsonString: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.app || !parsed.data) {
        throw new Error('Format file backup tidak valid untuk Warung Medan Finance');
      }

      const { data } = parsed;
      await db.transaction(
        'rw',
        [
          db.stores,
          db.bazarEvents,
          db.budgets,
          db.accounts,
          db.dailySales,
          db.transactions,
          db.ingredients,
          db.stockMovements,
          db.products,
          db.payables,
          db.receivables,
          db.openingBalances,
          db.auditLogs,
          db.settings
        ],
        async () => {
          if (Array.isArray(data.stores) && data.stores.length > 0) {
            await db.stores.clear();
            await db.stores.bulkAdd(data.stores);
          }
          if (Array.isArray(data.bazarEvents)) {
            await db.bazarEvents.clear();
            if (data.bazarEvents.length > 0) await db.bazarEvents.bulkAdd(data.bazarEvents);
          }
          if (Array.isArray(data.budgets)) {
            await db.budgets.clear();
            if (data.budgets.length > 0) await db.budgets.bulkAdd(data.budgets);
          }
          if (Array.isArray(data.accounts)) {
            await db.accounts.clear();
            if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
          }
          if (Array.isArray(data.dailySales)) {
            await db.dailySales.clear();
            if (data.dailySales.length > 0) await db.dailySales.bulkAdd(data.dailySales);
          }
          if (Array.isArray(data.transactions)) {
            await db.transactions.clear();
            if (data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
          }
          if (Array.isArray(data.ingredients)) {
            await db.ingredients.clear();
            if (data.ingredients.length > 0) await db.ingredients.bulkAdd(data.ingredients);
          }
          if (Array.isArray(data.stockMovements)) {
            await db.stockMovements.clear();
            if (data.stockMovements.length > 0) await db.stockMovements.bulkAdd(data.stockMovements);
          }
          if (Array.isArray(data.products)) {
            await db.products.clear();
            if (data.products.length > 0) await db.products.bulkAdd(data.products);
          }
          if (Array.isArray(data.payables)) {
            await db.payables.clear();
            if (data.payables.length > 0) await db.payables.bulkAdd(data.payables);
          }
          if (Array.isArray(data.receivables)) {
            await db.receivables.clear();
            if (data.receivables.length > 0) await db.receivables.bulkAdd(data.receivables);
          }
          if (Array.isArray(data.openingBalances)) {
            await db.openingBalances.clear();
            if (data.openingBalances.length > 0) await db.openingBalances.bulkAdd(data.openingBalances);
          }
          if (Array.isArray(data.auditLogs)) {
            await db.auditLogs.clear();
            if (data.auditLogs.length > 0) await db.auditLogs.bulkAdd(data.auditLogs);
          }
          if (Array.isArray(data.settings)) {
            await db.settings.clear();
            if (data.settings.length > 0) await db.settings.bulkAdd(data.settings);
          }

          await db.auditLogs.add({
            id: `audit_restore_${Date.now()}`,
            action: 'RESTORE_BACKUP',
            entityType: 'DATABASE',
            entityId: 'SYSTEM',
            details: `Pemulihan data cadangan berhasil dari ekspor tanggal ${parsed.exportedAt || 'tidak diketahui'}`,
            timestamp: new Date().toISOString()
          });
        }
      );

      return {
        success: true,
        message: 'Pemulihan data cadangan berhasil! Semua catatan keuangan telah diperbarui.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal memulihkan cadangan: ${err.message || 'File rusak atau tidak valid'}`
      };
    }
  }
};
