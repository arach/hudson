export type SlugProps = {
  num: string;
  title: string;
  sub?: string;
};

export function Slug({ num, title, sub }: SlugProps) {
  return (
    <div className="slug">
      <div className="slug__sheet">{num}</div>
      <div className="slug__title">{title}</div>
      {sub && <div style={{ marginTop: 4, color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  );
}
