"use strict";

/** Push text per language. Keep in sync with `alerts.*` in petpal/src/i18n/locales (in-app inbox). */
const MESSAGES = {
  en: {
    zone_exit: {
      title: "{pet} left the safe zone",
      body: "{pet} is now outside the safe zone ({radius} m). Tap to see the live location.",
    },
    zone_enter: {
      title: "{pet} is back in the safe zone",
      body: "{pet} is inside the safe zone again.",
    },
    battery_low: {
      title: "Low battery: {pet}'s tracker",
      body: "{pet}'s tracker is at {battery}%. Charge it soon.",
    },
    sos: {
      title: "SOS from {pet}'s tracker",
      body: "The SOS alarm on {pet}'s tracker was triggered. Open the live map.",
    },
    offline: {
      title: "{pet}'s tracker is offline",
      body: "No update for {hours} hours. Check the battery and signal.",
    },
  },
  el: {
    zone_exit: {
      title: "{pet}: εκτός ασφαλούς ζώνης",
      body: "Το {pet} βγήκε από την ασφαλή ζώνη ({radius} μ.). Πατήστε για τη ζωντανή τοποθεσία.",
    },
    zone_enter: {
      title: "{pet}: επέστρεψε στην ασφαλή ζώνη",
      body: "Το {pet} βρίσκεται ξανά μέσα στην ασφαλή ζώνη.",
    },
    battery_low: {
      title: "Χαμηλή μπαταρία: ανιχνευτής {pet}",
      body: "Ο ανιχνευτής του {pet} έχει {battery}% μπαταρία. Φορτίστε τον σύντομα.",
    },
    sos: {
      title: "SOS από τον ανιχνευτή του {pet}",
      body: "Ενεργοποιήθηκε ο συναγερμός SOS στον ανιχνευτή του {pet}. Ανοίξτε τον ζωντανό χάρτη.",
    },
    offline: {
      title: "Ο ανιχνευτής του {pet} είναι εκτός σύνδεσης",
      body: "Καμία ενημέρωση εδώ και {hours} ώρες. Ελέγξτε την μπαταρία και το σήμα.",
    },
  },
  ru: {
    zone_exit: {
      title: "{pet} вышел из безопасной зоны",
      body: "Питомец {pet} за пределами безопасной зоны ({radius} м). Нажмите, чтобы открыть карту.",
    },
    zone_enter: {
      title: "{pet} вернулся в безопасную зону",
      body: "Питомец {pet} снова в безопасной зоне.",
    },
    battery_low: {
      title: "Низкий заряд: трекер {pet}",
      body: "У трекера {pet} осталось {battery}%. Зарядите его.",
    },
    sos: {
      title: "SOS с трекера {pet}",
      body: "На трекере {pet} сработала кнопка SOS. Откройте карту.",
    },
    offline: {
      title: "Трекер {pet} не в сети",
      body: "Нет данных уже {hours} ч. Проверьте заряд и сигнал.",
    },
  },
};

const ALERT_TYPES = Object.keys(MESSAGES.en);

function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (params[key] == null ? "" : String(params[key])));
}

function normalizeLang(lang) {
  const code = String(lang || "en").slice(0, 2).toLowerCase();
  return MESSAGES[code] ? code : "en";
}

/** @returns {{ title: string, body: string }} */
function buildPushText(type, lang, params = {}) {
  const table = MESSAGES[normalizeLang(lang)][type] || MESSAGES.en[type];
  if (!table) return { title: "PetPal Care Hub", body: "" };
  return { title: fill(table.title, params), body: fill(table.body, params) };
}

module.exports = { ALERT_TYPES, buildPushText, normalizeLang };
