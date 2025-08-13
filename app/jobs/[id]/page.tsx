type Props = { params: { id: string } };

export default function JobDetailsPage({ params }: Props) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Job #{params.id}</h1>
      <p className="text-slate-600">פרטי משרה. בהמשך: ציון התאמה + יצירת מכתב.</p>
    </main>
  );
}
