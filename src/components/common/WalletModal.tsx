import React, { useState, useEffect } from 'react';
import { Wallet, QrCode, ArrowUpRight, ArrowDownLeft, X, PlusCircle, Check } from 'lucide-react';
import { QRCodeSetting, WalletTransaction, UserRole } from '../../types/motoride';
import { motorideApi } from '../../services/motorideApi';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userPhone?: string;
  userRole: UserRole;
  currentBalance?: number;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  userId,
  userPhone,
  userRole,
  currentBalance = 500,
  onBalanceUpdated,
}) => {
  const [balance, setBalance] = useState(currentBalance);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [topupAmount, setTopupAmount] = useState<number>(200);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrSettings, setQrSettings] = useState<QRCodeSetting | null>(null);

  useEffect(() => {
    if (currentBalance !== undefined) {
      setBalance(currentBalance);
    }
  }, [currentBalance]);

  useEffect(() => {
    if (isOpen) {
      loadWallet();
      loadQR();
    }
  }, [isOpen, userId, userPhone]);

  const loadWallet = async () => {
    try {
      const res = await motorideApi.getWallet(userId, userPhone);
      if (res?.wallet && typeof res.wallet.balance === 'number') {
        setBalance(res.wallet.balance);
        setTransactions(res.transactions || []);
        onBalanceUpdated?.(res.wallet.balance);
      }
    } catch {}
  };

  const loadQR = async () => {
    try {
      const qr = await motorideApi.getQRSettings();
      setQrSettings(qr);
    } catch {}
  };

  const handleTopup = async () => {
    if (topupAmount <= 0) return;
    setIsProcessing(true);
    try {
      const res = await motorideApi.topupWallet(userId, topupAmount);
      setBalance(res.balance);
      onBalanceUpdated?.(res.balance);
      await loadWallet();
    } catch (err: any) {
      alert(err.message || 'Topup failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col gap-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Motoride Wallet</h3>
              <span className="text-[11px] text-slate-400 capitalize">{userRole} Account</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">CURRENT BALANCE</span>
            <span className="text-3xl font-black text-amber-400 font-mono-num">
              ₹{balance.toFixed(2)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            ₹
          </div>
        </div>

        {/* Quick Topup Options */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-300">Add Money to Wallet</span>
          <div className="grid grid-cols-4 gap-2">
            {[100, 200, 500, 1000].map((amt) => (
              <button
                type="button"
                key={amt}
                onClick={() => setTopupAmount(amt)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-mono-num ${
                  topupAmount === amt
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                +₹{amt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleTopup}
            disabled={isProcessing}
            className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>{isProcessing ? 'Processing...' : `Top-up ₹${topupAmount}`}</span>
          </button>
        </div>

        {/* Official Admin QR Code */}
        {qrSettings && (
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
            {qrSettings.qr_image_url ? (
              <img
                src={qrSettings.qr_image_url}
                alt="Scan & Pay"
                className="w-16 h-16 rounded-lg bg-white p-1 object-contain shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 p-1 flex items-center justify-center text-[10px] text-slate-500 font-bold text-center shrink-0">
                No QR
              </div>
            )}
            <div className="text-xs">
              <span className="font-bold text-white block">UPI Scan & Pay</span>
              <span className="text-[11px] font-mono-num text-amber-400 font-semibold block">
                {qrSettings.upi_id || 'hemant76@idbi'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Zero processing charges on UPI top-ups
              </span>
            </div>
          </div>
        )}

        {/* Transactions list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Recent Transactions & Deductions</span>
            <span className="text-[11px] font-mono text-slate-400">{transactions.length} items</span>
          </div>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
            {transactions.length === 0 ? (
              <span className="text-xs text-slate-500 text-center py-4">No transactions yet</span>
            ) : (
              transactions.map((t) => {
                const isCommission = t.category === 'commission_fee' || (t.category as string) === 'platform_commission' || t.description?.includes('Commission') || Boolean(t.reference_ride_id);
                const grossFare = t.gross_fare || (isCommission ? Number((t.amount / 0.1).toFixed(2)) : 0);
                const captainEarn = t.captain_earning || (grossFare ? Number((grossFare - t.amount).toFixed(2)) : 0);

                if (isCommission) {
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col gap-2 text-xs shadow-inner"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider">
                            10% Platform Commission
                          </span>
                          {t.ride_code && (
                            <span className="font-mono font-bold text-white text-[11px]">
                              #{t.ride_code}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-black text-rose-400 text-sm">
                          -₹{Number(t.amount).toFixed(2)}
                        </span>
                      </div>

                      {/* Tripwise Financial Breakdown */}
                      <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px]">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase font-bold">Gross Fare</span>
                          <span className="font-mono font-bold text-white">₹{grossFare > 0 ? grossFare.toFixed(2) : '-'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-amber-400 block uppercase font-bold">10% Platform Fee</span>
                          <span className="font-mono font-bold text-amber-300">-₹{Number(t.amount).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-400 block uppercase font-bold">Net Take-Home</span>
                          <span className="font-mono font-bold text-emerald-400">+{captainEarn > 0 ? `₹${captainEarn.toFixed(2)}` : '-'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                        <span>{t.created_at ? new Date(t.created_at).toLocaleString() : 'Recent'}</span>
                        {t.wallet_balance_after !== undefined && (
                          <span className="font-mono text-slate-300 font-medium">
                            Balance after: ₹{t.wallet_balance_after.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-200">{t.description || (t.type === 'credit' ? 'Wallet Top-Up' : 'Wallet Debit')}</p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {t.created_at ? new Date(t.created_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold text-sm ${
                        t.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {t.type === 'credit' ? '+' : '-'}₹{Number(t.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
