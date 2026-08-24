export function StubTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-8 text-center">
      <h2 className="text-xl font-bold text-[#1e3a5f]">{title}</h2>
      <p className="mt-2 text-sm text-[#666] max-w-md mx-auto">{description}</p>
    </div>
  );
}
