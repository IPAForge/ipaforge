// Every literal text and user-visible prop below must be reported by no-jsx-literal-text.grit.
export const Rejected = ({ count }: { count: number }) => (
  <section>
    Hello there
    <h1>Install SideStore</h1>
    <img alt="Logo" src="logo.png" />
    <button type="button" aria-label="Close">
      ×
    </button>
    <input title={"Name"} placeholder={`Type ${count}`} />
    <Field label="Apple ID" />
    <p>{count} apps</p>
  </section>
);

const Field = (props: { label: string }) => <span>{props.label}</span>;
