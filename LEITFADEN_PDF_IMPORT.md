# Leitfaden: PDF-Import und Lernsystem

Dieser Leitfaden erklärt, **wie die App einen Kontoauszug auswertet**,
**woran man erkennt, dass die Auswertung wirklich vollständig ist**, und
**wie das Lernsystem mit der Zeit immer treffsicherer wird**. Er ist
das Referenzdokument für den Kern der App.

---

## 1. Wie ein Kontoauszug ausgelesen wird

### 1.1 Schritt 1 — PDF-Text gewinnen
`pdfplumber` liest den reinen Text Seite für Seite aus dem PDF. Bilder
oder gescannte Auszüge können **nicht** verarbeitet werden — das PDF
muss „digital" sein (Text markierbar im Adobe Reader).

### 1.2 Schritt 2 — Buchungen aus dem Text herausarbeiten
Der Parser kennt das Layout der **Emsländischen Volksbank eG** im
Detail (`src/logic/pdf_import.py`).

**Eine Buchung beginnt immer mit einer Zeile dieser Form:**

```
Bu-Tag  Wert    Vorgangstext                       Betrag  H|S
02.03.  02.03.  Dauerauftragsgutschr              4.000,00  H
03.03.  03.03.  Basislastschrift                     23,00  S
```

* `H` = Haben → **Gutschrift** (positiv)
* `S` = Soll → **Belastung** (negativ)
* Wert-Datum (Spalte 2) kann fehlen oder vom Bu-Tag abweichen — wir
  verwenden ausschließlich den **Bu-Tag** als Buchungsdatum.

**Folgezeilen** enthalten Empfänger und Verwendungszweck und werden
an die Buchung gehängt — bis die nächste Zeile mit einem `DD.MM.`
beginnt oder eine Saldo-/Rahmenzeile auftaucht.

### 1.3 Schritt 3 — Was bewusst ignoriert wird
Diese Zeilen sehen aus wie Buchungen, sind aber keine — sie werden
gezielt herausgefiltert:

| Schlüsselphrase                  | Bedeutung                          |
|----------------------------------|-------------------------------------|
| `alter Kontostand vom …`         | Anfangssaldo des Auszugs           |
| `neuer Kontostand vom …`         | Endsaldo des Auszugs               |
| `Übertrag auf Blatt N`           | Seitenübertrag (kein Vorgang)      |
| `Übertrag von Blatt N`           | Seitenübertrag (kein Vorgang)      |
| `Bu-Tag Wert Vorgang`            | Tabellenkopf (auf jeder Seite)     |
| `Abschluss vom DD.MM. bis DD.MM.` | Rahmentext der Kontoführungs-Buchung |
| Alles ab `Sehr geehrte Kundin`   | Juristischer Footer-Boilerplate    |

### 1.4 Schritt 4 — Selbst gestellte Falle: Beträge im Verwendungszweck
Verwendungszwecke enthalten oft Beträge oder Datumsangaben, z. B.:

```
STEUERNR 061/137/16930 EINK.ST 4VJ.25 23.400,00EUR EREF: …
Sudstrase 268, 49767 Twist 81,28 04.02.26 NR. 44012756
```

Diese werden **nie** als neue Buchung gelesen, weil der Parser eine
neue Buchung nur dann beginnt, wenn die Zeile mit `DD.MM.` **startet**
und am Ende ein Betrag mit `H` oder `S` steht. Beträge mitten im Text
oder am Ende einer Folgezeile ohne `H/S`-Suffix bleiben Teil der
Beschreibung.

---

## 2. Beweis, dass nichts fehlt: die Saldo-Prüfung

Beim Import zeigt die Vorschau einen grünen oder roten Balken:

> **Saldo stimmt: 62.595,79 + 5.575,37 = 68.171,16 €**

Dahinter steckt eine simple, aber unbestechliche Rechnung:

```
alter Kontostand  +  Σ aller erkannten Buchungen  =  neuer Kontostand
```

Stimmt diese Gleichung auf den Cent → **garantiert vollständig**. Stimmt
sie nicht → der Balken wird orange, mit der genauen Differenz. So
weißt du **vor** dem Übernehmen, ob auch nur eine Buchung fehlt.

Diese Prüfung ist im Code als `saldo_pruefen()` umgesetzt und wird in
den Selbsttests automatisch ausgeführt — die vier Beispiel-Auszüge
liefern aktuell **31 Buchungen, alle Salden auf den Cent korrekt**.

---

## 3. Wie das Lernsystem die Zuordnung übernimmt

Erkennt der Parser eine Buchung, **rät** das Lernsystem (`src/logic/
lernsystem.py`) Haus und Kategorie:

1. **Empfängertext normalisieren** — Sonderzeichen, Referenznummern und
   Umsatzsteuer-IDs werden entfernt, sodass „PayPal Europe S.a.r.l.
   …104860140602…" zum stabilen Muster „PayPal Europe" wird.
2. **In den gelernten Mustern nachsehen** — gibt es schon einen Eintrag
   für dieses normalisierte Muster, wird automatisch Haus und
   Kategorie übernommen.
3. **Sicherheitscheck** — wenn der Betrag stark vom üblichen Bereich
   abweicht, wird die Zeile gelb statt grün markiert („unsicher").
4. **Neu** — gibt es das Muster nicht, bleibt die Zeile gelb stehen und
   du wählst Haus + Kategorie selbst.

**So lernt das System weiter:**
* Jede Zeile, die du in der Vorschau zuordnest und übernimmst, wird
  als neues Muster gespeichert.
* Beim nächsten Import wird derselbe Empfänger sofort automatisch
  zugeordnet — grün.
* Gelernte Muster kannst du jederzeit in *Stammdaten → Muster* prüfen,
  ändern oder löschen.

Faustregel: Nach 2–3 abgerechneten Monaten sind die wiederkehrenden
Empfänger (Miete, Versicherungen, Müll, Stadtwerke …) automatisch
zugeordnet — nur Neue erscheinen noch gelb.

---

## 4. Wenn doch mal eine Buchung fehlt

Sollte der Saldo-Balken einmal NICHT stimmen, ist das ein Hinweis, dass
das Layout dieses Auszugs vom bekannten Muster abweicht. Vorgehen:

1. **Rohtext herausziehen** — in der Eingabeaufforderung im App-Ordner:
   ```
   python rohtext_dump.py auszug.pdf
   ```
   → liefert `auszug.txt`.
2. **Stelle finden** — der mit der Differenz im Saldo-Balken passende
   Betrag steht in der `.txt`. Markiere dir die ganze Buchung
   (Startzeile + alle Folgezeilen).
3. **Schick mir den Ausschnitt** — ich erweitere den Parser gezielt
   um genau dieses Muster und füge einen Selbsttest hinzu, damit es
   nicht wieder passiert.

Der Parser ist mit Absicht **konservativ**: lieber eine Zeile zu wenig
erkennen (du siehst es sofort an der Saldo-Prüfung) als eine erfundene
zu viel produzieren.

---

## 5. So bringt man der App eine zweite Bank bei

Sollte später ein zweites Konto bei einer anderen Bank dazukommen,
ist das Vorgehen wie folgt:

1. Beispiel-PDFs sammeln (3–4 Auszüge reichen).
2. `python rohtext_dump.py auszug.pdf` für jeden Auszug ausführen.
3. Die Saldo-Marker identifizieren (das Pendant zu „alter Kontostand"
   und „neuer Kontostand").
4. Die Buchungs-Startzeile bestimmen — woran erkennt man, wo eine
   Buchung anfängt? Meist eine Kombination aus Datum, Betrag und einem
   Vorzeichen (S/H, +/-, oder die Spalten-Position).
5. Im Code (`src/logic/pdf_import.py`) ein zweites Profil neben dem
   Volksbank-Profil ergänzen und über einen Header-Marker (z. B. den
   Banknamen) automatisch auswählen.
6. Selbsttest mit allen Beispiel-Auszügen — wenn alle Salden stimmen,
   ist das neue Profil produktiv einsetzbar.

---

## 6. Selbsttests laufen lassen

Die Auswertungs-Logik ist mit drei automatisierten Tests abgesichert:

| Test                    | Zweck                                       |
|-------------------------|---------------------------------------------|
| `buchungszeilen_aus_text` | Parser liefert die richtige Anzahl Buchungen |
| `saldo_pruefen`         | Σ Buchungen + Anfangssaldo = Endsaldo       |
| End-to-End mit PDFs     | Echte Auszüge werden zu 100 % erkannt       |

Wenn du den Parser einmal erweitert hast, prüfst du den Erfolg mit
genau diesen Tests — alle drei müssen grün sein.

---

## 7. Was die App heute schon kann (Stand)

* **Mehrseitige PDFs** mit Übertrag zwischen Blättern
* **Buchungs- und Wertdatum** korrekt unterscheiden (Buchungs-Tag wird
  verwendet)
* **Beträge bis sechsstellig** im deutschen Format (`1.234,56`)
* **Soll/Haben** über das `S/H`-Suffix oder `+/-`-Vorzeichen
* **Verwendungszweck-Beträge** als Beschreibung statt als Buchung
* **Abschluss-Buchung** (Kontoführungs-Gebühr) ohne den
  Abrechnungs-Rahmentext fälschlich zu importieren
* **Automatische Zuordnung** wiederkehrender Empfänger über das
  Lernsystem
* **Saldo-Plausibilitätsprüfung** als sofortiges Erfolgs-/Fehler-Signal

So bleibt die App auf Dauer beherrschbar und vertrauenswürdig: jeder
neue Auszug fällt entweder zu 100 % korrekt durch — oder du merkst es
sofort.
