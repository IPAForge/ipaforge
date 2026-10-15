// Nothing here may be reported: translated text, punctuation, and literals in props nobody sees or hears.
const t = (key: string): string => key;

export const Allowed = ({ items }: { items: readonly string[] }) => (
  <section id="main" className="flex gap-2" data-testid="allowed" key="root">
    <h1>{t("install.title")}</h1>
    <img alt={t("logo")} src="logo.png" />
    <button type="button" aria-label={t("close")} title={t("close")}>
      {t("close")}
    </button>
    <a href="#main" target="_blank" rel="noreferrer">
      {t("skip")}
    </a>
    <span aria-hidden="true">·</span>
    {items.map((item) => (
      <span key={item}>{item}</span>
    ))}
    {" "}
    (42)
  </section>
);
