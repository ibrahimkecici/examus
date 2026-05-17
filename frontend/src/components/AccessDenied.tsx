export default function AccessDenied() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <h2 className="text-lg font-semibold">Erişim yetkiniz yok</h2>
      <p className="mt-2 text-sm">Bu ekran için rolünüz yeterli değil. Gerekli olduğunu düşünüyorsanız sistem yöneticinizle görüşün.</p>
    </div>
  );
}
