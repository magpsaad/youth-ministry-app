"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ServantDirectoryEntry } from "@/lib/servant-directory";
import { servantPhotoUrl } from "@/lib/storage";
import {
  updateServantProfileAction,
  uploadServantPhotoAction,
  removeServantPhotoAction,
  removeServantAction,
} from "@/app/servant-profiles/actions";
import { CameraIcon, TrashIcon } from "@/components/icons";

const inputClass = (editing: boolean) =>
  `w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
    editing
      ? "border-[#ffc107] bg-[#fffacd] focus:ring-2 focus:ring-[#ffc107]/40"
      : "border-[#ddd] bg-[#f5f5f5] text-[#333] cursor-not-allowed"
  }`;

/** REQUIREMENTS.md §6.13 -- Full Name and Email are always read-only. Group
 * assignment lives on the separate Servant Assignments screen, not here.
 * `onSaved` (photo upload, field save) and `onClose` (X/Close button) are
 * kept deliberately separate -- a photo upload must NOT close the modal,
 * matching Member Detail's exact behavior (MemberDetailLink.tsx). */
export function ServantDetailModal({
  servant,
  canManageServants,
  onClose,
  onSaved,
}: {
  servant: ServantDirectoryEntry;
  canManageServants: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState(servant.photo_path);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState(servant.phone ?? "");
  const [fatherOfConfession, setFatherOfConfession] = useState(servant.father_of_confession ?? "");
  const [gender, setGender] = useState(servant.gender ?? "");

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateServantProfileAction(servant.id, {
        phone: phone || null,
        father_of_confession: fatherOfConfession || null,
        gender: gender || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      onSaved();
    });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      const result = await uploadServantPhotoAction(servant.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.photoPath) setPhotoPath(result.photoPath);
      onSaved();
    });
  }

  function handleRemovePhoto() {
    if (!photoPath) return;
    startTransition(async () => {
      const result = await removeServantPhotoAction(servant.id, photoPath);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPhotoPath(null);
      onSaved();
    });
  }

  function handleRemove() {
    if (!confirm(`Remove ${servant.full_name} as a servant? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await removeServantAction(servant.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  const photoUrl = servantPhotoUrl(photoPath);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-[#f0f0f0] pb-3 mb-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">{servant.full_name}</h2>
          <button onClick={onClose} className="text-[#999] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex flex-col items-center mb-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={servant.full_name} className="h-[100px] w-[100px] rounded-full object-cover" />
          ) : (
            <div className="h-[100px] w-[100px] rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d5a7b] flex items-center justify-center text-white text-2xl font-bold">
              {servant.full_name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              title={photoUrl ? "Replace photo" : "Add photo"}
              className="flex items-center gap-1 text-xs font-semibold text-[#1e3a5f] hover:underline"
            >
              <CameraIcon className="h-3.5 w-3.5" />
              {photoUrl ? "Replace" : "Add"} Photo
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={pending}
                title="Delete photo"
                className="flex items-center gap-1 text-xs font-semibold text-[#dc3545] hover:underline"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete Photo
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-3 rounded-md bg-[#f8d7da] text-[#721c24] text-sm px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <FieldRow label="Full Name">
            <input value={servant.full_name} readOnly className={inputClass(false)} />
          </FieldRow>
          <FieldRow label="Email">
            <input value={servant.email ?? ""} readOnly className={inputClass(false)} />
          </FieldRow>
          <FieldRow label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={!editing} className={inputClass(editing)} />
          </FieldRow>
          <FieldRow label="Father of Confession">
            <input
              value={fatherOfConfession}
              onChange={(e) => setFatherOfConfession(e.target.value)}
              readOnly={!editing}
              className={inputClass(editing)}
            />
          </FieldRow>
          <FieldRow label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={!editing} className={inputClass(editing)}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </FieldRow>
          <FieldRow label="Join Date">
            <input value={servant.join_date ?? "Not yet attended"} readOnly className={inputClass(false)} />
          </FieldRow>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 justify-between items-center border-t border-[#f0f0f0] pt-4">
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45]"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setPhone(servant.phone ?? "");
                    setFatherOfConfession(servant.father_of_confession ?? "");
                    setGender(servant.gender ?? "");
                  }}
                  className="rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]"
                >
                  Cancel
                </button>
              </>
            )}
            <button onClick={onClose} className="rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]">
              Close
            </button>
          </div>
          {canManageServants && (
            <button
              onClick={handleRemove}
              disabled={pending}
              className="rounded-md bg-[#dc3545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c82333] disabled:opacity-60"
            >
              Remove Servant
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#333] mb-1">{label}</label>
      {children}
    </div>
  );
}
