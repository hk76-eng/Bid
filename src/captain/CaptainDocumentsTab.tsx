import React, { useState, useEffect, useRef } from 'react';
import {
  Captain,
  CaptainDocuments,
  CaptainDocumentItem,
} from '../types/motoride';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  UploadCloud,
  Camera,
  Eye,
  Trash2,
  RefreshCw,
  Bike,
  FileText,
  CreditCard,
  UserCheck,
  X,
  Check,
  ChevronRight,
  Info,
  ExternalLink,
  Save,
  HelpCircle,
} from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import { motorideApi } from '../services/motorideApi';
import { getApiUrl } from '../utils/apiUrl';

interface CaptainDocumentsTabProps {
  captain: Captain | null;
  onClose: () => void;
  onUpdateCaptain?: (updated: Partial<Captain>) => void;
  onOpenWallet?: () => void;
}

type DocumentKey = 'driving_licence' | 'vehicle_rc' | 'pan_card' | 'aadhaar_card';

interface DocumentMeta {
  key: DocumentKey;
  title: string;
  shortName: string;
  icon: React.ElementType;
  description: string;
  numberLabel: string;
  numberPlaceholder: string;
  hasBackImage: boolean;
  frontLabel: string;
  backLabel?: string;
  sampleTip: string;
}

const DOCUMENT_CONFIGS: DocumentMeta[] = [
  {
    key: 'driving_licence',
    title: 'Driving Licence (DL)',
    shortName: 'Driving Licence',
    icon: Bike,
    description: 'Valid commercial or private Indian Driving Licence authorizing 2-wheeler/4-wheeler transport.',
    numberLabel: 'DL Number',
    numberPlaceholder: 'e.g. DL-0420110012345 or CH0120200001234',
    hasBackImage: true,
    frontLabel: 'Licence Front Side (Photo & Validity)',
    backLabel: 'Licence Back Side (Vehicle Classes & Endorsements)',
    sampleTip: 'Ensure photo, DL number, valid-till date and vehicle category (MCWG/LMV) are clearly visible.',
  },
  {
    key: 'vehicle_rc',
    title: 'Vehicle RC (Registration Certificate)',
    shortName: 'Vehicle RC',
    icon: FileText,
    description: 'Vehicle Registration Certificate issued by RTO matching your registered bike/scooter plate number.',
    numberLabel: 'RC Registration Number',
    numberPlaceholder: 'e.g. PB65XX1000 or CH01AB1234',
    hasBackImage: true,
    frontLabel: 'RC Card Front (Owner & Reg Details)',
    backLabel: 'RC Card Back (Engine & Chassis Details)',
    sampleTip: 'Plate number on RC must match your vehicle profile. Smart card or DigiLocker RC accepted.',
  },
  {
    key: 'pan_card',
    title: 'PAN Card (Permanent Account Number)',
    shortName: 'PAN Card',
    icon: CreditCard,
    description: 'Required for automated direct UPI/bank payouts, platform compliance and TDS reporting.',
    numberLabel: 'PAN Number (10 Alphanumeric)',
    numberPlaceholder: 'e.g. ABCDE1234F',
    hasBackImage: false,
    frontLabel: 'PAN Card Front (Full Face & PAN Number)',
    sampleTip: 'Name on PAN Card must match your Captain profile full name exactly for payout clearance.',
  },
  {
    key: 'aadhaar_card',
    title: 'Aadhaar Card (UIDAI)',
    shortName: 'Aadhaar Card',
    icon: UserCheck,
    description: 'Government proof of identity and permanent residential address verification.',
    numberLabel: 'Aadhaar Number (12 Digits)',
    numberPlaceholder: 'e.g. 1234 5678 9012',
    hasBackImage: true,
    frontLabel: 'Aadhaar Front Side (Photo, Name & DOB)',
    backLabel: 'Aadhaar Back Side (Full Address & QR Code)',
    sampleTip: 'Front photo with DOB and back side with address must both be uploaded.',
  },
];

export const CaptainDocumentsTab: React.FC<CaptainDocumentsTabProps> = ({
  captain,
  onClose,
  onUpdateCaptain,
  onOpenWallet,
}) => {
  const captainId = captain?.id || '';

  // Local documents store
  const [documents, setDocuments] = useState<CaptainDocuments>(() => {
    // Try localStorage fallback first for instant load
    const saved = localStorage.getItem(`motoride_captain_docs_${captainId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return captain?.documents || {};
  });

  // Edited numbers state for each card
  const [docNumbers, setDocNumbers] = useState<Record<DocumentKey, string>>({
    driving_licence: '',
    vehicle_rc: captain?.plate_number || '',
    pan_card: '',
    aadhaar_card: '',
  });

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Hidden file inputs
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Sync initial numbers from props
  useEffect(() => {
    if (captain?.documents) {
      setDocuments(captain.documents);
      setDocNumbers({
        driving_licence: captain.documents.driving_licence?.number || '',
        vehicle_rc: captain.documents.vehicle_rc?.number || captain.plate_number || '',
        pan_card: captain.documents.pan_card?.number || '',
        aadhaar_card: captain.documents.aadhaar_card?.number || '',
      });
    }
  }, [captain]);

  // Fetch latest documents from backend on mount
  useEffect(() => {
    if (!captainId) return;

    let isMounted = true;
    fetch(getApiUrl(`/api/motoride/captains/${captainId}/documents`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.success && data.documents) {
          setDocuments(data.documents);
          setDocNumbers((prev) => ({
            driving_licence: data.documents.driving_licence?.number || prev.driving_licence,
            vehicle_rc: data.documents.vehicle_rc?.number || prev.vehicle_rc || captain?.plate_number || '',
            pan_card: data.documents.pan_card?.number || prev.pan_card,
            aadhaar_card: data.documents.aadhaar_card?.number || prev.aadhaar_card,
          }));
          localStorage.setItem(`motoride_captain_docs_${captainId}`, JSON.stringify(data.documents));
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [captainId]);

  // Show auto-dismissing toast
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text === text ? null : cur));
    }, 4000);
  };

  // Helper to calculate compliance score
  const calculateScore = () => {
    let uploadedCount = 0;
    DOCUMENT_CONFIGS.forEach((cfg) => {
      const doc = documents[cfg.key];
      if (doc?.front_image) {
        uploadedCount += 1;
      }
    });
    return {
      uploadedCount,
      total: DOCUMENT_CONFIGS.length,
      pct: Math.round((uploadedCount / DOCUMENT_CONFIGS.length) * 100),
    };
  };

  const score = calculateScore();

  // Save document number
  const handleSaveNumber = async (key: DocumentKey) => {
    const rawVal = docNumbers[key]?.trim();
    if (!captainId) return;

    setSavingKey(`${key}_number`);
    try {
      const currentDoc = documents[key] || { status: 'not_uploaded' };
      const updatedDoc: CaptainDocumentItem = {
        ...currentDoc,
        number: rawVal,
        status: currentDoc.front_image ? currentDoc.status : rawVal ? 'pending' : 'not_uploaded',
      };

      const newDocs: CaptainDocuments = {
        ...documents,
        [key]: updatedDoc,
      };

      setDocuments(newDocs);
      localStorage.setItem(`motoride_captain_docs_${captainId}`, JSON.stringify(newDocs));

      const res = await fetch(getApiUrl(`/api/motoride/captains/${captainId}/documents`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: key,
          number: rawVal,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
        }
        if (onUpdateCaptain && data.captain) {
          onUpdateCaptain(data.captain);
        }
        showToast(`${DOCUMENT_CONFIGS.find((c) => c.key === key)?.shortName} number updated`);
      }
    } catch {
      showToast('Failed to save document number. Please check connection.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  // Trigger file dialog
  const triggerUpload = (inputKey: string) => {
    const input = fileInputRefs.current[inputKey];
    if (input) {
      input.click();
    }
  };

  // Handle file selection and upload
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: DocumentKey,
    side: 'front' | 'back'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !captainId) return;

    const uploadId = `${key}_${side}`;
    setUploadingKey(uploadId);

    try {
      // 1. Compress image client-side to lightweight JPEG (max 1280px, quality 0.85)
      const base64Data = await compressImage(file, 1280, 1280, 0.85);

      const currentDoc = documents[key] || { status: 'not_uploaded' };
      const updatedDoc: CaptainDocumentItem = {
        ...currentDoc,
        number: docNumbers[key]?.trim() || currentDoc.number || '',
        front_image: side === 'front' ? base64Data : currentDoc.front_image,
        back_image: side === 'back' ? base64Data : currentDoc.back_image,
        status: 'pending',
        uploaded_at: new Date().toISOString(),
      };

      const newDocs: CaptainDocuments = {
        ...documents,
        [key]: updatedDoc,
      };

      // Optimistic update
      setDocuments(newDocs);
      localStorage.setItem(`motoride_captain_docs_${captainId}`, JSON.stringify(newDocs));

      // 2. Persist to backend server
      const res = await fetch(getApiUrl(`/api/motoride/captains/${captainId}/documents`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: key,
          number: updatedDoc.number,
          front_image: updatedDoc.front_image,
          back_image: updatedDoc.back_image,
          status: 'pending',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
        }
        if (onUpdateCaptain && data.captain) {
          onUpdateCaptain(data.captain);
        }
        showToast(`✅ ${DOCUMENT_CONFIGS.find((c) => c.key === key)?.shortName} (${side.toUpperCase()}) uploaded!`);
      } else {
        showToast('Server error while saving. Cached locally.', 'error');
      }
    } catch (err) {
      showToast('Image upload failed. Please try a different photo.', 'error');
    } finally {
      setUploadingKey(null);
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  };

  // Remove uploaded image
  const handleRemoveImage = async (key: DocumentKey, side: 'front' | 'back') => {
    if (!captainId) return;
    if (!window.confirm(`Are you sure you want to remove the ${side} photo for this document?`)) {
      return;
    }

    try {
      const currentDoc = documents[key] || { status: 'not_uploaded' };
      const updatedDoc: CaptainDocumentItem = {
        ...currentDoc,
        front_image: side === 'front' ? undefined : currentDoc.front_image,
        back_image: side === 'back' ? undefined : currentDoc.back_image,
        status: (side === 'front' ? undefined : currentDoc.front_image) ? currentDoc.status : 'not_uploaded',
      };

      const newDocs: CaptainDocuments = {
        ...documents,
        [key]: updatedDoc,
      };

      setDocuments(newDocs);
      localStorage.setItem(`motoride_captain_docs_${captainId}`, JSON.stringify(newDocs));

      await fetch(getApiUrl(`/api/motoride/captains/${captainId}/documents`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: key,
          front_image: updatedDoc.front_image || '',
          back_image: updatedDoc.back_image || '',
          status: updatedDoc.status,
        }),
      });

      showToast(`Removed ${side} image.`);
    } catch {
      showToast('Could not remove document photo.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[1150] pt-16 sm:pt-20 pb-12 px-3 sm:px-6 md:px-8 bg-slate-950/95 backdrop-blur-xl overflow-y-auto flex flex-col gap-6 animate-in fade-in duration-200 scrollbar-thin">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs font-black flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-emerald-950/50'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-rose-950/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">Captain Documents & KYC</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  {score.uploadedCount === 4 ? '100% Complete' : `${score.uploadedCount}/4 Uploaded`}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Upload your Driving Licence, Vehicle RC, PAN Card & Aadhaar Card for partner verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onOpenWallet && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <span>Wallet</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer shrink-0"
            >
              <Bike className="w-4 h-4 stroke-[2.5]" />
              <span>Back to Map & Requests</span>
            </button>
          </div>
        </div>

        {/* Verification Progress Banner */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Verification Checklist: {score.uploadedCount} of {score.total} Documents Uploaded</span>
            </span>
            <span className="text-white font-mono-num font-black text-sm">{score.pct}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-500"
              style={{ width: `${score.pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {DOCUMENT_CONFIGS.map((cfg) => {
              const doc = documents[cfg.key];
              const isUploaded = Boolean(doc?.front_image);
              const isVerified = doc?.status === 'verified';
              return (
                <div
                  key={cfg.key}
                  className={`px-3 py-2 rounded-xl text-center flex items-center justify-center gap-1.5 border text-[11px] font-bold ${
                    isVerified
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : isUploaded
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  {isVerified ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isUploaded ? (
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span className="truncate">{cfg.shortName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Main Document Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {DOCUMENT_CONFIGS.map((config) => {
            const doc = documents[config.key];
            const Icon = config.icon;
            const currentNum = docNumbers[config.key] ?? '';
            const isSavingNum = savingKey === `${config.key}_number`;
            const isUploadingFront = uploadingKey === `${config.key}_front`;
            const isUploadingBack = uploadingKey === `${config.key}_back`;

            const hasFront = Boolean(doc?.front_image);
            const hasBack = Boolean(doc?.back_image);
            const status = doc?.status || (hasFront ? 'pending' : 'not_uploaded');

            return (
              <div
                key={config.key}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 shadow-2xl flex flex-col justify-between gap-4 transition-all"
              >
                {/* Card Header */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-white truncate">{config.title}</h3>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{config.description}</p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0">
                      {status === 'verified' && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-black flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Verified</span>
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                          <span>Under Review</span>
                        </span>
                      )}
                      {status === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-black flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          <span>Re-upload Needed</span>
                        </span>
                      )}
                      {status === 'not_uploaded' && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold">
                          Not Uploaded
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Document Number Input */}
                  <div className="mt-2 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {config.numberLabel}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentNum}
                        onChange={(e) => {
                          const val = config.key === 'pan_card' ? e.target.value.toUpperCase() : e.target.value;
                          setDocNumbers((prev) => ({
                            ...prev,
                            [config.key]: val,
                          }));
                        }}
                        placeholder={config.numberPlaceholder}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors uppercase font-mono-num"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNumber(config.key)}
                        disabled={isSavingNum}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1"
                        title="Save Number"
                      >
                        {isSavingNum ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Upload Zones (Front and Optional Back) */}
                <div className={`grid ${config.hasBackImage ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3 pt-2 border-t border-slate-800/80`}>
                  
                  {/* Front Side */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-300 flex items-center justify-between">
                      <span>{config.frontLabel}</span>
                      {hasFront && <span className="text-[9px] text-emerald-400 font-bold">Uploaded ✓</span>}
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      ref={(el) => {
                        fileInputRefs.current[`${config.key}_front`] = el;
                      }}
                      onChange={(e) => handleFileChange(e, config.key, 'front')}
                      className="hidden"
                    />

                    {hasFront && doc?.front_image ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black/60 group h-32 flex items-center justify-center">
                        <img
                          src={doc.front_image}
                          alt={`${config.title} Front`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: doc.front_image!,
                                title: `${config.title} - Front Side`,
                              })
                            }
                            className="p-2 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                            title="View Full Image"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerUpload(`${config.key}_front`)}
                            className="p-2 rounded-xl bg-amber-500/90 text-slate-950 hover:bg-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Replace Image"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(config.key, 'front')}
                            className="p-2 rounded-xl bg-rose-500/90 text-white hover:bg-rose-600 text-xs font-bold cursor-pointer active:scale-95"
                            title="Delete Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerUpload(`${config.key}_front`)}
                        disabled={isUploadingFront}
                        className="h-32 rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-950/60 hover:bg-slate-950 flex flex-col items-center justify-center gap-2 p-3 text-center cursor-pointer transition-all group"
                      >
                        {isUploadingFront ? (
                          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-400 flex items-center justify-center transition-colors">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                        )}
                        <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">
                          {isUploadingFront ? 'Compressing & Uploading...' : 'Upload Front Photo'}
                        </span>
                        <span className="text-[9px] text-slate-500">Camera / Gallery (PNG, JPG)</span>
                      </button>
                    )}
                  </div>

                  {/* Back Side (If applicable) */}
                  {config.hasBackImage && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-300 flex items-center justify-between">
                        <span>{config.backLabel || 'Licence / RC Back Side'}</span>
                        {hasBack && <span className="text-[9px] text-emerald-400 font-bold">Uploaded ✓</span>}
                      </span>

                      <input
                        type="file"
                        accept="image/*"
                        ref={(el) => {
                          fileInputRefs.current[`${config.key}_back`] = el;
                        }}
                        onChange={(e) => handleFileChange(e, config.key, 'back')}
                        className="hidden"
                      />

                      {hasBack && doc?.back_image ? (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black/60 group h-32 flex items-center justify-center">
                          <img
                            src={doc.back_image}
                            alt={`${config.title} Back`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: doc.back_image!,
                                  title: `${config.title} - Back Side`,
                                })
                              }
                              className="p-2 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                              title="View Full Image"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerUpload(`${config.key}_back`)}
                              className="p-2 rounded-xl bg-amber-500/90 text-slate-950 hover:bg-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                              title="Replace Image"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Replace</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(config.key, 'back')}
                              className="p-2 rounded-xl bg-rose-500/90 text-white hover:bg-rose-600 text-xs font-bold cursor-pointer active:scale-95"
                              title="Delete Image"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => triggerUpload(`${config.key}_back`)}
                          disabled={isUploadingBack}
                          className="h-32 rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-950/60 hover:bg-slate-950 flex flex-col items-center justify-center gap-2 p-3 text-center cursor-pointer transition-all group"
                        >
                          {isUploadingBack ? (
                            <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-amber-500/20 text-slate-400 group-hover:text-amber-400 flex items-center justify-center transition-colors">
                              <UploadCloud className="w-5 h-5" />
                            </div>
                          )}
                          <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">
                            {isUploadingBack ? 'Compressing & Uploading...' : 'Upload Back Photo'}
                          </span>
                          <span className="text-[9px] text-slate-500">Camera / Gallery (PNG, JPG)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Helpful Tip Footer */}
                <div className="pt-2 flex items-start gap-2 text-[10px] text-slate-400 border-t border-slate-800/60">
                  <Info className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                  <span>{config.sampleTip}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verification Support & Guidelines Card */}
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">Need Help with Document Approval?</h4>
              <p className="text-[11px] text-slate-400">
                Uploaded documents are verified within 2 to 4 hours. You can drive immediately once verification is active.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-all"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox / Full Image Viewer Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between text-white px-2">
              <span className="text-xs sm:text-sm font-black">{lightboxImage.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full max-h-[80vh] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center p-2">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
