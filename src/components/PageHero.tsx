import { Container } from "./Container";

/** หัวหน้าเพจ (ใช้ทุกหน้ารอง) — พื้นเข้มตาม theme */
export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-dark py-14 text-white sm:py-16">
      <Container>
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">
            {subtitle}
          </p>
        )}
      </Container>
    </section>
  );
}
