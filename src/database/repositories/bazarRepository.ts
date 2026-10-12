/**
 * BAZAR REPOSITORY - Modul Pengelolaan Event & Laporan Khusus Bazar
 * Warung Medan CT Catering
 */

import { db } from '../db';
import { STORE_BAZAR_ID, type BazarEvent, type ProfitLossReport } from '../../types';
import { formatRupiah } from '../../utils/formatters';

export const bazarRepository = {
  async getAllEvents(): Promise<BazarEvent[]> {
    return await db.bazarEvents.orderBy('startDate').reverse().toArray();
  },

  async getActiveEvents(): Promise<BazarEvent[]> {
    return await db.bazarEvents.filter((e) => e.status === 'ACTIVE').toArray();
  },

  async getEventById(id: string): Promise<BazarEvent | undefined> {
    return await db.bazarEvents.get(id);
  },

  async createEvent(data: Omit<BazarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<BazarEvent> {
    const now = new Date().toISOString();
    const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const event: BazarEvent = {
      ...data,
      id,
      storeId: STORE_BAZAR_ID,
      createdAt: now,
      updatedAt: now
    };

    await db.bazarEvents.add(event);
    return event;
  },

  async updateEvent(id: string, updates: Partial<BazarEvent>): Promise<void> {
    const now = new Date().toISOString();
    await db.transaction('rw', [db.bazarEvents, db.auditLogs], async () => {
      const existing = await db.bazarEvents.get(id);
      if (!existing) throw new Error('Event bazar tidak ditemukan.');

      const safeUpdates: Partial<BazarEvent> = {
        name: updates.name?.trim() ?? existing.name,
        location: updates.location?.trim() ?? existing.location,
        startDate: updates.startDate ?? existing.startDate,
        endDate: updates.endDate ?? existing.endDate,
        targetRevenue: updates.targetRevenue ?? existing.targetRevenue ?? 0,
        notes: updates.notes?.trim() ?? existing.notes ?? '',
        status: updates.status ?? existing.status,
        updatedAt: now
      };
      if (!safeUpdates.name) throw new Error('Nama event wajib diisi.');
      // Resolve dates from the existing event as Partial<BazarEvent> makes
      // safeUpdates.startDate/endDate optional to TypeScript.
      const resolvedStartDate = safeUpdates.startDate ?? existing.startDate;
      const resolvedEndDate = safeUpdates.endDate ?? existing.endDate;
      if (resolvedEndDate < resolvedStartDate) {
        throw new Error('Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.');
      }

      await db.bazarEvents.update(id, safeUpdates);
      await db.auditLogs.add({
        id: `audit_event_update_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        storeId: STORE_BAZAR_ID,
        action: 'UPDATE',
        entityType: 'BAZAR_EVENT',
        entityId: id,
        details: `Event bazar diperbarui: ${existing.name} -> ${safeUpdates.name}`,
        timestamp: now
      });
    });
  },

  /**
   * Event hanya boleh dihapus bila belum dipakai transaksi, penjualan,
   * pergerakan stok, atau piutang. Riwayat keuangan tidak pernah dihapus berantai.
   */
  async deleteEvent(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.transaction(
      'rw',
      [db.bazarEvents, db.dailySales, db.transactions, db.stockMovements, db.receivables, db.auditLogs],
      async () => {
        const event = await db.bazarEvents.get(id);
        if (!event) throw new Error('Event bazar tidak ditemukan.');

        const [sales, transactions, movements, receivables] = await Promise.all([
          db.dailySales.where('eventId').equals(id).count(),
          db.transactions.where('eventId').equals(id).count(),
          db.stockMovements.where('eventId').equals(id).count(),
          db.receivables.where('eventId').equals(id).count()
        ]);
        if (sales + transactions + movements + receivables > 0) {
          throw new Error(
            'Event tidak bisa dihapus karena sudah memiliki data penjualan, transaksi, pergerakan stok, atau piutang. Ubah status menjadi Selesai agar riwayat tetap aman.'
          );
        }

        await db.bazarEvents.delete(id);
        await db.auditLogs.add({
          id: `audit_event_delete_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          storeId: STORE_BAZAR_ID,
          action: 'DELETE',
          entityType: 'BAZAR_EVENT',
          entityId: id,
          details: `Event bazar dihapus: ${event.name} (${event.location})`,
          timestamp: now
        });
      }
    );
  },

  /**
   * Hitung Kinerja Finansial Khusus Satu Event Bazar (Revenue, Expenses, Net Profit per Event)
   */
  async getEventPerformance(eventId: string): Promise<{
    event: BazarEvent;
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    totalExpenses: number;
    stockCostUsed: number;
    netProfit: number;
    netMarginPct: number;
  }> {
    const event = await db.bazarEvents.get(eventId);
    if (!event) throw new Error('Event bazar tidak ditemukan');

    // Penjualan terkait event
    const salesList = await db.dailySales.filter((s) => !s.isVoided && s.eventId === eventId).toArray();
    const grossSales = salesList.reduce((sum, s) => sum + s.grossSales, 0);
    const discounts = salesList.reduce((sum, s) => sum + s.discount, 0);
    const refunds = salesList.reduce((sum, s) => sum + s.refund, 0);
    const netSales = Math.round(grossSales - discounts - refunds);

    // Beban langsung event
    const txList = await db.transactions
      .filter((t) => !t.isVoided && t.eventId === eventId && t.type === 'PENGELUARAN_OPERASIONAL')
      .toArray();
    const totalExpenses = txList.reduce((sum, t) => sum + t.amount, 0);

    // Pemakaian bahan di event
    const movements = await db.stockMovements
      .filter((m) => m.eventId === eventId && (m.type === 'PEMAKAIAN_MANUAL' || m.type === 'RUSAK_TERBUANG'))
      .toArray();
    const stockCostUsed = movements.reduce((sum, m) => sum + (m.totalAmount || 0), 0);

    const netProfit = Math.round(netSales - totalExpenses - stockCostUsed);
    const netMarginPct = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(1)) : 0;

    return {
      event,
      grossSales,
      discounts,
      refunds,
      netSales,
      totalExpenses,
      stockCostUsed,
      netProfit,
      netMarginPct
    };
  }
};
