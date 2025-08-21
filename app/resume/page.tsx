// C:\Users\itays\Desktop\33\job-ai-app\app\resume\page.tsx
import ResumeUpload from "@/components/ResumeUpload";

export default function ResumePage() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Resume</h1>
      <p className="text-slate-600">העלה קובץ PDF ונכין אותו לניתוח.</p>
      <ResumeUpload />
    </main>
  );
}
// #endregion
