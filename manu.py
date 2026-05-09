import streamlit as st
import pandas as pd
import time
import json
import re
import hashlib
import datetime
from io import BytesIO
from pathlib import Path
import streamlit.components.v1 as components

# --- KONTROLLE & DESIGN ---
st.set_page_config(page_title="Manu Imperial OS", layout="centered", page_icon="🏛️")

# --- PERSISTENTER SPEICHER ---
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
METADATA_FILE = UPLOAD_DIR / "metadata.json"


def load_metadata():
    if METADATA_FILE.exists():
        try:
            return json.loads(METADATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
    return []


def save_metadata(data):
    METADATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(file_bytes))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception as exc:
        return f"[Fehler beim Lesen: {exc}]"


CATEGORY_KEYWORDS = {
    "Lebensmittel": ["rewe", "edeka", "lidl", "aldi", "kaufland", "penny", "netto", "supermarkt"],
    "Tankstelle": ["aral", "shell", "esso", "jet ", "tankstelle", "tank ", "total energies"],
    "Miete & Wohnen": ["miete", "kaltmiete", "warmmiete", "nebenkosten", "vermieter", "hausverwaltung"],
    "Restaurant & Café": ["restaurant", "pizza", "döner", "doener", "mcdonald", "burger", "café", "cafe", "bäcker", "baecker"],
    "Online-Shop": ["amazon", "ebay", "zalando", "otto ", "paypal", "cardmarket"],
    "Versicherung": ["versicherung", "allianz", "huk", "axa", "ergo"],
    "Strom & Energie": ["stadtwerke", "energie", "eon ", "vattenfall", "strom"],
    "Telekom & Internet": ["telekom", "vodafone", "1und1", "o2 ", "mobilfunk"],
    "Gehalt & Einnahmen": ["gehalt", "lohn", "bezuege", "bezüge", "honorar", "einnahme"],
    "Bargeld": ["geldautomat", "atm", "bargeldauszahlung"],
}

AMOUNT_RE = re.compile(r"([+-]?\s*\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})")


def categorize_line(line: str) -> str:
    lower = line.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return category
    return "Sonstiges"


def parse_amount(raw: str) -> float | None:
    cleaned = raw.replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def analyze_kontoauszug(text: str) -> dict:
    """Einfache regelbasierte 'KI'-Analyse: erkennt Beträge zeilenweise und ordnet sie Kategorien zu."""
    transactions = []
    counts: dict[str, int] = {}
    sums: dict[str, float] = {}

    for line in text.splitlines():
        match = AMOUNT_RE.search(line)
        if not match:
            continue
        amount = parse_amount(match.group(1))
        if amount is None:
            continue
        category = categorize_line(line)
        transactions.append({
            "line": line.strip(),
            "amount": amount,
            "category": category,
        })
        counts[category] = counts.get(category, 0) + 1
        sums[category] = round(sums.get(category, 0.0) + amount, 2)

    return {
        "transactions": transactions,
        "counts": counts,
        "sums": sums,
        "total": round(sum(sums.values()), 2),
    }


def store_uploaded_file(uploaded_file, kind: str) -> dict:
    """Speichert eine hochgeladene Datei und führt ggf. KI-Analyse durch."""
    file_bytes = uploaded_file.getbuffer().tobytes()
    file_hash = hashlib.sha1(file_bytes).hexdigest()[:10]
    safe_name = f"{file_hash}_{uploaded_file.name}"
    saved_path = UPLOAD_DIR / safe_name
    saved_path.write_bytes(file_bytes)

    text = ""
    name_lower = uploaded_file.name.lower()
    if name_lower.endswith(".pdf"):
        text = extract_pdf_text(file_bytes)
    elif name_lower.endswith(".txt"):
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            text = ""

    analysis = analyze_kontoauszug(text) if text else None

    return {
        "filename": uploaded_file.name,
        "stored_as": safe_name,
        "kind": kind,
        "uploaded_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "size": len(file_bytes),
        "analysis": analysis,
        "preview": text[:2000] if text else None,
    }


# --- SOUND-ENGINE (JavaScript für haptisches Feedback) ---
components.html(
    """
    <audio id="clickSound" src="https://www.soundjay.com/buttons/sounds/button-16.mp3" preload="auto"></audio>
    <script>
    const playSound = () => {
        const audio = window.parent.document.getElementById('clickSound');
        audio.play();
    }
    const buttons = window.parent.document.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', playSound);
    }
    </script>
    """,
    height=0,
)

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;700&display=swap');

    .stApp { background: radial-gradient(circle, #1a1a1a 0%, #050505 100%); font-family: 'Inter', sans-serif; }

    /* Imperialer Header */
    .header-gold {
        font-family: 'Cinzel', serif;
        color: #D4AF37;
        text-align: center;
        font-size: 3rem;
        text-shadow: 0px 0px 15px rgba(212, 175, 55, 0.6);
        margin-bottom: 30px;
    }

    /* Casino-Chip Buttons mit Schatten-Tiefe */
    div.stButton > button {
        background: linear-gradient(145deg, #D4AF37, #8A6D1D) !important;
        color: #000 !important;
        border-radius: 12px !important;
        border: 2px solid #FFD700 !important;
        height: 3.5rem !important;
        font-weight: 800 !important;
        box-shadow: 0 5px 0 #5C4914 !important;
        transition: 0.1s all;
        text-transform: uppercase;
        width: 100% !important;
    }

    /* Klick-Animation (Button geht nach unten) */
    div.stButton > button:active {
        transform: translateY(4px) !important;
        box-shadow: 0 1px 0 #5C4914 !important;
    }

    /* Oracle Card Design */
    .oracle-box {
        background: rgba(212, 175, 55, 0.1);
        border: 1px solid #D4AF37;
        padding: 20px;
        border-radius: 15px;
        color: #D4AF37;
        font-style: italic;
    }

    /* Datei-Uploader optisch anpassen */
    div[data-testid="stFileUploader"] {
        border: 2px dashed #D4AF37;
        border-radius: 12px;
        padding: 12px;
        background: rgba(212, 175, 55, 0.05);
    }
    </style>
    """, unsafe_allow_html=True)

# --- APP LOGIK ---
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

# --- SIMPLE LOGIN ---
if not st.session_state.logged_in:
    st.markdown("<div class='header-gold'>MARCUS AURELIUS FINANCE</div>", unsafe_allow_html=True)
    with st.container():
        st.text_input("Imperator Name")
        st.text_input("Vault Key", type="password")
        if st.button("BETRETE DEN PALAST"):
            st.session_state.logged_in = True
            st.rerun()
    st.stop()

# --- SIDEBAR NAVIGATION ---
with st.sidebar:
    st.markdown("<h2 style='color:#D4AF37;'>🏛️ PALAST-MENÜ</h2>", unsafe_allow_html=True)
    choice = st.radio(
        "Wohin gehst du?",
        [
            "Hauptsaal (Zentrale)",
            "Das Orakel (KI Tipps)",
            "Kontoauszug-Tresor",
            "Miet-Tresor",
        ],
    )
    st.markdown("---")
    if st.button("🚪 Palast verlassen"):
        st.session_state.logged_in = False
        st.rerun()

# --- HAUPTSAAL ---
if choice == "Hauptsaal (Zentrale)":
    st.markdown("<div class='header-gold'>ZENTRALE</div>", unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        if st.button("🏦 SÜDSTRASSE"): st.toast("Lade Südstraße...")
        if st.button("🏠 FINKENSTRASSE"): st.toast("Lade Finkenstraße...")
    with col2:
        if st.button("🌿 ANNAFEHN"): st.toast("Lade Annafehn...")
        if st.button("➕ NEUES HAUS"): st.info("Baupläne werden erstellt...")

    st.markdown("---")
    st.markdown("### 📸 KI BELEG SCAN — Multi-Upload")
    receipts = st.file_uploader(
        "Belege hochladen (Foto oder PDF, mehrere möglich)",
        type=["pdf", "jpg", "jpeg", "png", "webp"],
        accept_multiple_files=True,
        key="receipt_uploader",
    )
    if receipts and st.button("💰 IN DEN TRESOR LEGEN (JACKPOT)"):
        with st.spinner("KI berechnet Gewinn..."):
            metadata = load_metadata()
            for f in receipts:
                metadata.append(store_uploaded_file(f, kind="beleg"))
            save_metadata(metadata)
            time.sleep(0.8)
        st.balloons()
        st.audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3")
        st.success(f"{len(receipts)} Beleg(e) im Tresor gesichert!")
        st.rerun()

# --- DAS ORAKEL ---
elif choice == "Das Orakel (KI Tipps)":
    st.markdown("<div class='header-gold'>DAS ORAKEL</div>", unsafe_allow_html=True)
    st.markdown("""
        <div class='oracle-box'>
            "Ich sehe dunkle Wolken über deinem Goldvorrat... Deine Ausgaben bei 'Cardmarket' (290€)
            sind für einen Imperator nicht würdig. Investiere in Steine, nicht in Papier."
        </div>
    """, unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("""
        <div class='oracle-box'>
            "Deine morgendlichen Opfergaben beim Bäcker (20€ täglich) summieren sich zu einem Berg.
            Mäßigung führt zu Reichtum."
        </div>
    """, unsafe_allow_html=True)

# --- KONTOAUSZUG-TRESOR ---
elif choice == "Kontoauszug-Tresor":
    st.markdown("<div class='header-gold'>KONTOAUSZUG-TRESOR</div>", unsafe_allow_html=True)

    st.markdown(
        "Lade Deine Kontoauszüge hoch (PDF, Word, Text oder Bild). "
        "Die KI sortiert die Buchungen in Kategorien und legt die Datei sicher im Tresor ab."
    )

    statements = st.file_uploader(
        "📑 Kontoauszüge hochladen",
        type=["pdf", "docx", "doc", "txt", "jpg", "jpeg", "png"],
        accept_multiple_files=True,
        key="statement_uploader",
    )

    if statements:
        st.info(f"{len(statements)} Datei(en) bereit zum Einlagern.")
        if st.button("💾 IM TRESOR EINSCHLIESSEN & ANALYSIEREN"):
            metadata = load_metadata()
            with st.spinner("KI ordnet die Buchungen..."):
                for f in statements:
                    metadata.append(store_uploaded_file(f, kind="kontoauszug"))
                save_metadata(metadata)
                time.sleep(0.5)
            st.balloons()
            st.success(f"{len(statements)} Kontoauszug/-züge gespeichert und analysiert!")
            st.rerun()

    st.markdown("---")
    st.markdown("### 📚 Tresor-Archiv")

    metadata = load_metadata()
    statements_archive = [m for m in metadata if m.get("kind") == "kontoauszug"]
    receipts_archive = [m for m in metadata if m.get("kind") == "beleg"]

    tab1, tab2 = st.tabs([f"Kontoauszüge ({len(statements_archive)})", f"Belege ({len(receipts_archive)})"])

    def render_archive(entries: list[dict]):
        if not entries:
            st.info("Noch nichts im Tresor.")
            return
        for entry in reversed(entries):
            with st.expander(f"📄 {entry['filename']} — {entry['uploaded_at']}"):
                size_kb = entry.get("size", 0) / 1024
                st.caption(f"Größe: {size_kb:,.1f} KB")

                analysis = entry.get("analysis")
                if analysis and analysis.get("sums"):
                    st.markdown(
                        f"**KI-Analyse:** {len(analysis['transactions'])} Buchungen erkannt "
                        f"(Saldo der erkannten Beträge: {analysis['total']:,.2f} €)"
                    )
                    df = pd.DataFrame(
                        [
                            (cat, analysis["counts"][cat], analysis["sums"][cat])
                            for cat in analysis["sums"]
                        ],
                        columns=["Kategorie", "Anzahl", "Summe (EUR)"],
                    ).sort_values("Summe (EUR)")
                    st.dataframe(df, use_container_width=True, hide_index=True)
                elif analysis is not None:
                    st.warning(
                        "Kein Text aus der Datei extrahiert (vermutlich gescanntes Bild). "
                        "Datei ist trotzdem sicher abgelegt."
                    )
                else:
                    st.caption("Für diesen Dateityp wird keine Text-KI-Analyse ausgeführt.")

                stored_path = UPLOAD_DIR / entry["stored_as"]
                if stored_path.exists():
                    st.download_button(
                        "⬇️ Datei herunterladen",
                        stored_path.read_bytes(),
                        file_name=entry["filename"],
                        key=f"dl_{entry['stored_as']}",
                    )
                else:
                    st.error("Datei fehlt im Tresor.")

                if entry.get("preview"):
                    with st.expander("Text-Vorschau anzeigen"):
                        st.text(entry["preview"])

                if st.button("🗑️ Aus Tresor entfernen", key=f"del_{entry['stored_as']}"):
                    if stored_path.exists():
                        stored_path.unlink()
                    new_meta = [m for m in load_metadata() if m["stored_as"] != entry["stored_as"]]
                    save_metadata(new_meta)
                    st.rerun()

    with tab1:
        render_archive(statements_archive)
    with tab2:
        render_archive(receipts_archive)

# --- MIET-TRESOR ---
elif choice == "Miet-Tresor":
    st.markdown("<div class='header-gold'>MIET-TRESOR</div>", unsafe_allow_html=True)
    st.info("Dieser Bereich wird in Kürze eröffnet.")
