import Link from "next/link";

export default function MenuPage() {
  return (
    <main>
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
        <Link
          href="/"
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #2c2c2e",
            background: "#1c1c1e",
            color: "#fff",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          Back
        </Link>
      </div>

      <section
        style={{
          border: "1px solid #2c2c2e",
          borderRadius: 12,
          padding: 20,
          margin: "0 auto",
          maxWidth: 420,
          background: "#121214",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>Menu</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>Quick actions</p>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2c2c2e",
              background: "#1c1c1e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Win
          </button>
          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2c2c2e",
              background: "#1c1c1e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Draw
          </button>
          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2c2c2e",
              background: "#1c1c1e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Loose
          </button>
        </div>
      </section>
    </main>
  );
}
