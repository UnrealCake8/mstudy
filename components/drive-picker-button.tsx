"use client";

import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { authorizeClassroomDriveFile } from "@/lib/drive-picker";

export function DrivePickerButton() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function authorize() {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await authorizeClassroomDriveFile(user);
      if (!result.matched && result.readable) {
        setMessage(`“${result.fileName}” is authorized and readable. You can use it as a Drive study file even though it is not attached to Classroom.`);
      } else if (!result.matched) {
        setMessage(`“${result.fileName}” is authorized. It is not attached to Classroom, but MStudy can still use supported Drive files directly.`);
      } else if (result.readable) {
        setMessage(`“${result.fileName}” is authorized and its text is ready for Study Games.`);
      } else {
        setMessage(`“${result.fileName}” is authorized. MStudy can use the file, but this file type does not have automatic text extraction yet.`);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not authorize that Drive file.";
      if (text !== "File selection was cancelled.") setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  return <div className="drive-picker-action">
    <button className="secondary-button" onClick={authorize} disabled={busy}>
      <FolderOpen size={16}/>{busy ? "Opening Drive…" : "Authorise Drive file"}
    </button>
    {message ? <small className="section-help">{message}</small> : null}
  </div>;
}
