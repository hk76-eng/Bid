import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  X,
  SlidersHorizontal,
  DollarSign,
  Shield,
  Gauge,
  RotateCcw,
  Save,
  Check,
  AlertCircle,
  Sparkles,
  Sun,
  Smartphone,
  Eye,
} from 'lucide-react';
import { PricingSettings } from '../types';

interface SettingsModalProps {
  settings: PricingSettings;
  isOpen: boolean;
  onClose: () => void;
  onSaveSettings: (newSettings: Partial<PricingSettings>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSaveSettings,
}) => {
  const [ratePerKm, setRatePerKm] = useState<number>(settings.rate_per_km);
  const [baseUnlockFee, setBaseUnlockFee] = useState<number>(settings.base_unlock_fee);
  const [minimumFare, setMinimumFare] = useState<number>(settings.minimum_fare);
  const [maxAccuracy, setMaxAccuracy] = useState<number>(settings.max_gps_accuracy_threshold_m);
  const [maxSpeed, setMaxSpeed] = useState<number>(settings.max_speed_kmh);
  const [minMovement, setMinMovement] = useState<number>(settings.min_movement_threshold_m);
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(settings.keep_screen_on !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setRatePerKm(settings.rate_per_km);
    setBaseUnlockFee(settings.base_unlock_fee);
    setMinimumFare(settings.minimum_fare);
    setMaxAccuracy(settings.max_gps_accuracy_threshold_m);
    setMaxSpeed(settings.max_speed_kmh);
    setMinMovement(settings.min_movement_threshold_m);
    setKeepScreenOn(settings.keep_screen_on !== false);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings({
        rate_per_km: Number(ratePerKm),
        base_unlock_fee: Number(baseUnlockFee),
        minimum_fare: Number(minimumFare),
        max_gps_accuracy_threshold_m: Number(maxAccuracy),
        max_speed_kmh: Number(maxSpeed),
        min_movement_threshold_m: Number(minMovement),
        keep_screen_on: Boolean(keepScreenOn),
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setRatePerKm(10.0);
    setBaseUnlockFee(0.0);
    setMinimumFare(0.0);
    setMaxAccuracy(45);
    setMaxSpeed(45);
    setMinMovement(3);
    setKeepScreenOn(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Pricing & Rate Settings</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Admin Portal
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Authorized for <span className="text-emerald-300 font-mono text-[11px]">freelanceseoservices01@gmail.com</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
            {/* Section 1: Pricing Rates */}
            <div>
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Per-Kilometer Pricing Rules
              </h4>

              <div className="space-y-3">
                {/* Rate per Km */}
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">
                      Rate per Kilometer ({settings.currency_symbol}/km)
                    </label>
                    <span className="text-sm font-black text-emerald-400 font-mono-num">
                      {settings.currency_symbol}{Number(ratePerKm).toFixed(2)}/km
                    </span>
                  </div>
                  <input
                    id="input-rate-per-km"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={ratePerKm}
                    onChange={(e) => setRatePerKm(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[8, 10, 12, 15, 20].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => setRatePerKm(preset)}
                        className={`text-[11px] px-2 py-1 rounded-md border font-mono-num font-semibold transition-all ${
                          ratePerKm === preset
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {settings.currency_symbol}{preset}/km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Base Unlock Fee */}
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Base Unlock Fee ({settings.currency_symbol})
                    </label>
                    <input
                      id="input-base-fee"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={baseUnlockFee}
                      onChange={(e) => setBaseUnlockFee(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono-num focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Minimum Fare */}
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Minimum Fare ({settings.currency_symbol})
                    </label>
                    <input
                      id="input-min-fare"
                      type="number"
                      min="0"
                      max="200"
                      step="1"
                      value={minimumFare}
                      onChange={(e) => setMinimumFare(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono-num focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {minimumFare === 0 ? 'Pure distance billing (no base floor)' : `Minimum floor of ${settings.currency_symbol}${minimumFare}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: GPS Filtering Tolerances */}
            <div>
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-teal-400 flex items-center gap-1.5 mb-3">
                <Shield className="w-3.5 h-3.5" />
                GPS Filtering & Accuracy Bounds
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Max Accuracy Cutoff
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={maxAccuracy}
                      onChange={(e) => setMaxAccuracy(parseInt(e.target.value) || 45)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-num"
                    />
                    <span className="text-[10px] text-slate-400">m</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Drops poor signals</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Max Speed Filter
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="20"
                      max="100"
                      value={maxSpeed}
                      onChange={(e) => setMaxSpeed(parseInt(e.target.value) || 45)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-num"
                    />
                    <span className="text-[10px] text-slate-400">km/h</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Rejects jumps</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Stationary Jitter
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={minMovement}
                      onChange={(e) => setMinMovement(parseInt(e.target.value) || 3)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-num"
                    />
                    <span className="text-[10px] text-slate-400">m</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Ignores drift</span>
                </div>
              </div>
            </div>

            {/* Section 3: Device Screen Wake Lock */}
            <div>
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-1.5 mb-3">
                <Sun className="w-3.5 h-3.5" />
                Device Display & Power
              </h4>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${
                      keepScreenOn
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="switch-do-not-screen-off"
                        className="text-xs font-bold text-white cursor-pointer select-none"
                      >
                        Do Not Screen Off (Keep Screen Awake)
                      </label>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                          keepScreenOn
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {keepScreenOn ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Prevents phone or browser screen from turning off or dimming during live navigation and fare metering.
                    </p>
                  </div>
                </div>

                {/* Switch Button */}
                <button
                  id="switch-do-not-screen-off"
                  type="button"
                  role="switch"
                  aria-checked={keepScreenOn}
                  onClick={() => setKeepScreenOn((prev) => !prev)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                    keepScreenOn ? 'bg-amber-500 shadow-md shadow-amber-500/30' : 'bg-slate-700'
                  }`}
                  title={keepScreenOn ? 'Disable keep screen awake' : 'Enable keep screen awake'}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                      keepScreenOn ? 'translate-x-5 bg-slate-950' : 'translate-x-0 bg-slate-300'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset ₹10/km Defaults
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-settings"
                  type="submit"
                  disabled={isSaving}
                  className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Rates
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
