# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/Pages/Tracking.js"
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)

# Remove header GPS block (lines 671-693, 1-based) -> index 670-692
out = []
i = 0
while i < len(lines):
    line = lines[i]
    if i == 670 and line.strip().startswith("{signalLive ? ("):
        # skip until line after acc meter block ends with ") : null}"
        while i < len(lines) and not (lines[i].strip() == ") : null}" and i > 680):
            i += 1
        i += 1  # skip the ") : null}" line
        continue
    out.append(line)
    i += 1

text = "".join(out)

# Replace status grid section between markers
start = text.find("          {position ? (\n            <div\n              className=\"pp-trackStatusGrid\"")
end = text.find("          ) : null}\n        </section>\n      ) : null}\n\n      {trackerTab === 'live' ? (", start)
if start < 0 or end < 0:
    raise SystemExit(f"grid section not found {start} {end}")

replacement = r'''          {position ? (
            <motionless className="pp-trackStatusGrid">
              <article className="pp-card pp-trackStatCard">
                <motionless className="pp-label">{t('trackingPage.cardGps')}</motionless>
                <motionless className="pp-trackStatCard__body">
                  <span className={`pp-trackGpsPill ${gpsOkVisual ? 'pp-trackGpsPill--ok' : 'pp-trackGpsPill--warn'}`}>
                    {gpsOkVisual ? `✓ ${t('trackingPage.gpsOk')}` : `⚠ ${t('trackingPage.gpsWeak')}`}
                  </span>
                  <p className="pp-subtle pp-trackStatCard__meta">
                    {t('trackingPage.accuracyLabel', { value: accuracyLabel })}
                    {position?.warningStale ? ` · ${t('trackingPage.warnOffline')}` : ''}
                  </p>
                  {accMeter ? (
                    <motionless
                      className="pp-trackAccuracyMeter"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Number.parseInt(accMeter.width, 10)}
                      aria-label={t('trackingPage.accuracyMeterLabel')}
                    >
                      <motionless className="pp-trackAccuracyMeter__fill" style={{ width: accMeter.width, background: accMeter.background }} />
                    </motionless>
                  ) : null}
                </motionless>
              </article>

              <article className="pp-card pp-trackStatCard">
                <motionless className="pp-label">{t('trackingPage.cardHealth')}</motionless>
                <motionless className="pp-trackStatCard__body">
                  {batPct != null ? (
                    <motionless className="pp-batteryBar" aria-label={t('trackingPage.batteryPctAria', { pct: batPct })}>
                      <motionless className="pp-batteryBar__fill" style={batteryFillStyle(batPct)} />
                      <motionless className="pp-batteryBar__label">
                        {batPct}% · {position.batteryStatus || t('trackingPage.healthBattery')}
                      </motionless>
                    </motionless>
                  ) : (
                    <p className="pp-subtle pp-trackStatCard__meta">
                      {t('trackingPage.healthBattery')}: —
                    </p>
                  )}
                </motionless>
              </article>

              <article className="pp-card pp-trackStatCard">
                <motionless className="pp-label">{t('trackingPage.cardActivity')}</motionless>
                <motionless className="pp-trackStatCard__body">
                  <p className="pp-subtle pp-trackStatCard__meta">
                    {t('trackingPage.activitySteps')}: {position.steps ?? '—'}
                  </p>
                  <p className="pp-subtle pp-trackStatCard__meta">
                    {position.movementText || (position.isMoving ? t('trackingPage.moving') : t('trackingPage.notMoving'))}
                  </p>
                </motionless>
              </article>
            </motionless>
'''.replace("motionless", "div")

text = text[:start] + replacement + text[end:]
p.write_text(text, encoding="utf-8")
print("ok")
