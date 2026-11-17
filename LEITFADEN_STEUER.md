# Leitfaden: Steuer-Export (Anlage V) und Nebenkosten

Dieser Leitfaden erklärt, wie die App aus den Buchungen die Anlage V
(Einkünfte aus Vermietung und Verpachtung) und die Unterlagen für den
Steuerberater erstellt – und was du dafür einmalig einstellen musst.

---

## 1. Ablauf jedes Jahr

1. Kontoauszüge importieren (Saldo-Balken muss grün sein).
2. **Export → Prüfbericht** öffnen und alle **Fehler** beheben,
   **Prüfen**-Einträge durchsehen.
3. **Export → Steuerpaket für den Steuerberater** erstellen. Ergebnis:
   Ordner `exports/Steuerpaket_<Jahr>/` und `Steuerpaket_<Jahr>.zip` mit
   * `AnlageV_<Jahr>.xlsx`: Übersicht aller Häuser, ein Blatt je Haus mit
     Zeilennummer, Gesamtbetrag und anzusetzendem Betrag,
     Einzelnachweis aller Buchungen mit Link zum Beleg sowie Prüfhinweise
   * `Steuerbericht_<Haus>_<Jahr>.pdf`: ein Bericht je Haus
   * `Mieteinnahmen_Alle_Häuser_<Jahr>.pdf`: wer wann wie viel gezahlt hat
   * `EXTF_Buchungsstapel_<Jahr>.csv`: DATEV-Import für den Steuerberater
   * `Belege/<Haus>/B00012_2026-03-14_Kategorie.jpg`: alle Belege, nach
     Belegnummer benannt (die Nummer steht auch im Einzelnachweis)

Je Haus ist eine eigene Anlage V abzugeben.

---

## 2. Steuerliche Behandlung der Kategorien (einmalig)

Unter **Stammdaten → Kategorien → Steuer-Einstellung …** (oder per
Doppelklick) legst du je Kategorie fest:

| Behandlung | Wirkung in der Anlage V |
|---|---|
| Mieteinnahme (Kaltmiete) | Mieteinnahmen ohne Umlagen |
| Umlagen / NK-Vorauszahlung | Umlagen, verrechnet mit Erstattungen |
| Sonstige Einnahme | z. B. Garage, Zuschüsse |
| Laufende Kosten | „umgelegte Kosten“, wenn die Kategorie umlagefähig ist, sonst „nicht umgelegte Kosten“ |
| Erhaltungsaufwand | Reparaturen, sofort abziehbar |
| Schuldzinsen / Geldbeschaffungskosten | eigene Positionen |
| Sonstige Werbungskosten | Fahrten, Porto, Inserate, Beratung |
| Herstellungs-/Anschaffungskosten | **nicht** sofort abziehbar, nur über die AfA (als Investition „Herstellung“ erfassen) |
| Privat | nicht abziehbar (z. B. Einkommensteuer) |
| Neutral | Umbuchung eigenes Geld (Rücklage), Mietkaution |

**Nicht festgelegt** (rot markiert): Ausgaben werden vorsichtshalber
**nicht** angesetzt, Einnahmen als sonstige Einnahme. Der Prüfbericht
meldet jede solche Kategorie, das gilt auch für automatisch angelegte
Kategorien aus Empfängernamen.

---

## 3. Prozentuale Anrechnung

Der steuerlich angesetzte Anteil wird in dieser Rangfolge ermittelt:

1. **Buchung** (Buchungsdialog → „Steuerlicher Anteil“)
2. **Haus × Kategorie** (Steuer-Einstellung → Tabelle „je Haus“)
3. **Kategorie** (Voreinstellung)
4. sonst 100 %

Der nicht angesetzte Rest erscheint im Einzelnachweis und geht im
DATEV-Export auf das Privatkonto. Gerundet wird kaufmännisch auf den
Cent.

---

## 4. Erstattungen und Rückzahlungen

Jede Buchung hat eine **Zahlungsrichtung**:

* Ein Geldeingang auf einer Ausgabe-Kategorie, z. B. ein Guthaben der
  Stadtwerke auf „Heizung/Gas“, ist eine **Erstattung**. Sie mindert
  diese Kosten in der Anlage V und in der Nebenkostenabrechnung.
* Ein Geldausgang auf einer Einnahme-Kategorie, z. B. ein Guthaben, das
  du einem Mieter auf „Nebenkosten-Vorauszahlung“ zurückzahlst, ist eine
  **Rückzahlung**. Sie mindert die Umlagen.

Beim Import erkennt die App das automatisch. Ältere Buchungen meldet
der Prüfbericht; dort lassen sie sich mit „Als Erstattung/Rückzahlung
umbuchen“ korrigieren.

---

## 5. Jahreswechsel (§ 11 EStG, 10-Tage-Regel)

Maßgeblich ist das Jahr der Zahlung. Ausnahme: **regelmäßig
wiederkehrende** Zahlungen (Miete, Nebenkosten, Grundsteuer, Versicherung
usw.), die bis zu 10 Tage vor oder nach dem Jahreswechsel fließen **und**
in diesem Zeitraum fällig sind. Sie gehören zu dem Jahr, für das sie
bestimmt sind. Beispiel: Die Januar-Miete geht am 28.12. ein und gehört
damit ins neue Jahr.

Der Prüfbericht listet solche Kandidaten auf. „Vorgeschlagenes Steuerjahr
setzen“ ordnet sie um; einzeln geht es auch im Buchungsdialog über das
Feld „Steuerjahr“. Nur umstellen, wenn die Zahlung tatsächlich für das
andere Jahr fällig war.

---

## 6. Mieten: Aufteilung Kaltmiete / Nebenkosten

Zahlt ein Mieter beim Import genau die vereinbarte Miete (Kaltmiete +
Nebenkosten laut Stammdaten) oder ein Vielfaches davon, bucht die App
automatisch zwei Teile:

* `… [Anteil Kaltmiete]`
* `… [Anteil Nebenkosten-Vorauszahlung]`

Weicht der Betrag ab, bleibt die Zahlung ungeteilt als Kaltmiete und
die App gibt einen Hinweis aus. Geht die Miete ab dem 25. eines Monats
ein, wird in der Mieterliste der Folgemonat abgehakt.

**Doppelte Erfassung vermeiden:** Wird die Miete per Kontoauszug
importiert, darf sie nicht zusätzlich in der Mieterliste per Häkchen
„erfasst“ werden, denn auch das legt Buchungen an. Der Prüfbericht meldet
solche Doppelungen als Fehler.

**Rücklage:** Die Kategorie „Rücklage (Umbuchung eigenes Geld)“ ist
neutral, zählt also weder als Einnahme noch als Ausgabe.

---

## 7. AfA und Investitionen

* **Gebäude-AfA:** Stammdaten → Häuser → **Steuer-Daten …**. Dort trägst
  du die Bemessungsgrundlage (nur den Gebäudeanteil), das Anschaffungs-
  bzw. Fertigstellungsdatum und den Satz ein: 2 % bei Fertigstellung
  1925–2022, 2,5 % vor 1925, 3 % ab 2023. Die Werte stehen in der
  Vorjahreserklärung bzw. beim Steuerberater.
* **Investitionen** (Stammdaten → Investitionen):
  * Erhaltung: sofort abziehbar oder nach § 82b EStDV auf 2 bis 5 Jahre
    verteilt
  * Herstellung: AfA über die Nutzungsdauer. Das erste Jahr läuft
    zeitanteilig, der Rest folgt am Ende, sodass die Summe exakt stimmt.
* **Achtung, doppelter Abzug:** Wurde die Rechnung auch per Kontoauszug
  importiert, gehört die Bank-Buchung auf „Modernisierung/Anschaffung
  (AfA)“. Der Prüfbericht warnt bei gleichen Beträgen.
* **15-%-Grenze:** Instandsetzungen in den ersten 3 Jahren nach dem Kauf
  über 15 % der Gebäude-Anschaffungskosten meldet der Prüfbericht als
  anschaffungsnahe Herstellungskosten.

---

## 8. Zeilennummern der Anlage V

Die Vordrucke ändern ihre Zeilennummern fast jedes Jahr, und der
Vordruck 2026 erscheint erst Anfang 2027. Die App ist mit Werten nach
Vordruck/Anleitung 2024 vorbelegt; die Positionen ohne gesicherte Nummer
sind leer.

**Vor dem Übertrag in ELSTER** unter Export → Einstellungen → „Anlage V –
Zeilen“ mit dem amtlichen Vordruck des Steuerjahres abgleichen. Die
Bezeichnungen der Positionen bleiben gleich; nur die Nummern wandern.

---

## 9. DATEV-Export

Export → Einstellungen → DATEV:

* Berater- und Mandantennummer (vom Steuerberater)
* Kontenrahmen SKR03 oder SKR04
* Sachkonten: Die eingetragenen Konten sind **Vorschläge ohne Gewähr**.
  Stimme sie vor dem ersten Import mit dem Steuerberater ab. Je Kategorie
  kann zusätzlich ein eigenes Konto hinterlegt werden.

Aufbau der Datei:

* Buchungsstapel im EXTF-Format, Formatversion 13
* Zeichensatz Windows-1252
* Kostenstelle (KOST1) je Haus
* Belegfeld 1 = Belegnummer, Buchungstext mit Kategorie
* Zahlungen aus dem Nachbarjahr (§ 11) stehen mit Belegdatum 01.01. bzw.
  31.12. und dem echten Zahlungsdatum im Text in der Datei

AfA ist keine Zahlung und steht deshalb nicht im Stapel.

---

## 10. Nebenkostenabrechnung

* **Cent-genau:** Jede Kostenart wird einzeln verteilt. Rundungscents
  gehen an die größten Reste, die Summe stimmt damit immer exakt.
* **Leerstand:** Trage beim Haus die Gesamtwohnfläche ein (Steuer-Daten).
  Dann trägt der Vermieter die Kosten leerer Flächen und Zeiten, nicht
  die übrigen Mieter.
* **Vorauszahlungen:** Angesetzt werden die tatsächlich gebuchten
  Zahlungen. Sind keine gebucht, wird ersatzweise der Vertragswert ×
  abgehakte Monate verwendet; die Abrechnung weist darauf hin.
* Erstattungen von Versorgern mindern die umlagefähigen Kosten.

---

## 11. Belege als Fotos

Fotos (JPG, PNG, HEIC vom iPhone) und Scans werden per Texterkennung
gelesen. Die App dreht und kontrastiert sie automatisch und erkennt
Gesamtbetrag und Rechnungsdatum. Voraussetzung unter Windows:

1. Tesseract-OCR installieren
   (github.com/UB-Mannheim/tesseract/wiki) und bei der Installation die
   Sprache **German** anhaken.
2. `pip install -r requirements.txt` (enthält pytesseract, Pillow und
   pillow-heif).

Ob alles bereit ist, zeigt **Einstellungen → Beleg-Erkennung**.

---

## 12. Grenzen

Diese Punkte bleiben beim Steuerberater:

* Zeilennummern des jeweiligen Vordrucks (siehe Abschnitt 8)
* Kontenzuordnung im DATEV-Export (siehe Abschnitt 9)
* Heizkosten werden nicht nach Heizkostenverordnung (verbrauchsabhängig)
  verteilt.
* Verbilligte Vermietung an Angehörige (§ 21 Abs. 2 EStG) wird nicht
  geprüft. Laut Angabe wird nur fremdvermietet.
