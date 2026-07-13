import { TICKER_ITEMS } from "./content";

function TickerGroup({ duplicate = false }: Readonly<{ duplicate?: boolean }>) {
  const items = TICKER_ITEMS.map((item) => (
    <span className="lp-ticker-item" key={item.id}>
      <span className="lp-ticker-dot" aria-hidden="true" />
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </span>
  ));

  if (duplicate) {
    return (
      <div className="lp-ticker-group" aria-hidden="true">
        {items}
      </div>
    );
  }

  return <div className="lp-ticker-group">{items}</div>;
}

export default function LiveTicker() {
  return (
    <div
      className="lp-ticker"
      role="region"
      aria-label="ตัวอย่างข้อมูลสดจากระบบขายหน้าร้าน"
      tabIndex={0}
    >
      <div className="lp-ticker-track">
        <TickerGroup />
        <TickerGroup duplicate />
      </div>
    </div>
  );
}
