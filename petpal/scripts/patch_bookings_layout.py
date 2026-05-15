# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/Pages/BookingsHub.js"
s = p.read_text(encoding="utf-8")

old = """        </AppCard>
      </aside>

      <div className="min-w-0">
        <motionless className="mb-3 flex flex-col gap-2 rounded-2xl border border-white/75 bg-white/80 p-2.5 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3">
          <span className="pp-book-serviceBar__label">{t('bookingsHub.categoryLabel')}</span>
          <ServiceTabs tabs={serviceTabs} value={serviceTab} onChange={setServiceTab} />
        </motionless>

        {err ? <motionless className="pp-book-error">{err}</motionless> : null}""".replace("motionless", "div")

new = """        </AppCard>

        <AppCard hover={false} className="pp-book-servicesCard">
          <h3 className="mb-3 text-base font-black tracking-[-0.03em] text-petpal-ink">{t('bookingsHub.categoryLabel')}</h3>
          <ServiceTabs tabs={serviceTabs} value={serviceTab} onChange={setServiceTab} />
        </AppCard>
      </aside>

      <div className="pp-book-main min-w-0">
        {err ? <div className="pp-book-error">{err}</motionless> : null}""".replace("motionless", "motionless")
new = new.replace("motionless", "div")

if old not in s:
    raise SystemExit("pattern not found")
s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("ok")
